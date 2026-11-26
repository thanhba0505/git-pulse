import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto.service';
import { SettingsService } from '../settings/settings.service';
import { FetchPreferences, normalizeFetchPreferences } from '../settings/settings.types';
import {
  buildGitHubHeaders,
  buildPrSearchQueryString,
  CommitItem,
  computeQueryDateFloor,
  GITHUB_GRAPHQL_URL,
  GitHubOrganizationWorkspace,
  GitHubWorkspacesResponse,
  GraphQlSearchPrNode,
  GraphQlViewerWorkspacesData,
  matchesWorkspacePreferences,
  normalizePrNode,
  parsePullRequestRef,
  PrActivity,
  PrState,
  RepoOwnerType,
  resolveOwnerType,
  resolvePrState,
} from './github-activity.helpers';

export type { CommitItem, PrActivity, GitHubWorkspacesResponse, RepoOwnerType };

export interface GitHubUserResponse {
  login: string;
  id: number;
  avatar_url: string;
  name: string;
}

export interface RequestMetadata {
  ip?: string;
  userAgent?: string;
}

export interface GitAccountSummaryResponse {
  id: string;
  gitUsername: string;
  gitAvatar: string | null;
  authType: 'OAUTH' | 'PAT';
  scopes: string[];
  hasExcessiveScopes: boolean;
  tokenStatus: string;
  expiresAt: Date | null;
  lastSyncAt: Date | null;
  isActive: boolean;
}

export interface GitStatusResponse {
  connected: boolean;
  success?: boolean;
  activeAccountId?: string;
  gitUsername?: string;
  gitAvatar?: string | null;
  authType?: 'OAUTH' | 'PAT';
  scopes?: string[];
  hasExcessiveScopes?: boolean;
  tokenStatus?: string;
  expiresAt?: Date | null;
  lastSyncAt?: Date | null;
  accounts: GitAccountSummaryResponse[];
}

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    @Optional() private readonly settingsService?: SettingsService,
  ) {}

  /**
   * Persists an audit log entry for token operations
   */
  async recordAuditLog(
    userId: string,
    action: string,
    status: 'SUCCESS' | 'FAILED',
    details?: string,
    meta?: RequestMetadata,
  ) {
    try {
      await this.prisma.tokenAuditLog.create({
        data: {
          userId,
          action,
          status,
          details: details ? details.slice(0, 500) : undefined,
          ipAddress: meta?.ip,
          userAgent: meta?.userAgent ? meta.userAgent.slice(0, 255) : undefined,
        },
      });
    } catch (err: unknown) {
      this.logger.warn(`Could not record token audit log: ${(err as Error).message}`);
    }
  }

  /**
   * Validates and saves a GitHub Personal Access Token (PAT) with HKDF encryption
   */
  async savePersonalAccessToken(
    userId: string,
    token: string,
    authType: 'PAT' | 'OAUTH' = 'PAT',
    meta?: RequestMetadata,
  ) {
    const cleanToken = token.trim();
    if (!cleanToken) {
      throw new BadRequestException('Token không được để trống.');
    }

    // Verify token with GitHub API
    let userRes: Response;
    try {
      userRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'GitPulse-Agent/1.0',
        },
      });
    } catch {
      await this.recordAuditLog(
        userId,
        authType === 'OAUTH' ? 'OAUTH_SAVE' : 'PAT_SAVE',
        'FAILED',
        'Network connection to GitHub failed',
        meta,
      );
      throw new BadRequestException('Không thể kết nối tới GitHub API.');
    }

    if (!userRes.ok) {
      await this.recordAuditLog(
        userId,
        authType === 'OAUTH' ? 'OAUTH_SAVE' : 'PAT_SAVE',
        'FAILED',
        `GitHub API returned ${userRes.status}`,
        meta,
      );
      const err = await userRes.json().catch(() => ({}));
      throw new BadRequestException(
        `Xác thực Personal Access Token thất bại: ${err.message || userRes.statusText}`,
      );
    }

    const ghUser = (await userRes.json()) as GitHubUserResponse;
    const scopesHeader = userRes.headers.get('x-oauth-scopes') || '';
    const scopes = scopesHeader
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // 1. Detect Over-privileged Scopes
    const DANGEROUS_SCOPES = [
      'delete_repo',
      'admin:org',
      'admin:repo_hook',
      'admin:org_hook',
      'workflow',
      'admin:enterprise',
    ];
    const hasExcessiveScopes = scopes.some((s) => DANGEROUS_SCOPES.includes(s));

    // 2. Extract Token Expiration if provided by GitHub header
    const expHeader = userRes.headers.get('github-authentication-token-expiration');
    let expiresAt: Date | null = null;
    if (expHeader) {
      const parsed = new Date(expHeader);
      if (!isNaN(parsed.getTime())) {
        expiresAt = parsed;
      }
    }

    // 3. Encrypt token with Per-User HKDF Key Derivation
    const encrypted = this.crypto.encrypt(cleanToken, userId);

    const account = await this.prisma.$transaction(async (tx) => {
      await tx.gitAccount.updateMany({
        where: { userId },
        data: { isActive: false },
      });

      return tx.gitAccount.upsert({
        where: {
          userId_gitUsername: {
            userId,
            gitUsername: ghUser.login,
          },
        },
        update: {
          authType,
          encryptedToken: encrypted.encryptedText,
          tokenIv: encrypted.iv,
          tokenTag: encrypted.tag,
          keyVersion: encrypted.keyVersion,
          gitUsername: ghUser.login,
          gitId: String(ghUser.id),
          gitAvatar: ghUser.avatar_url,
          scopes,
          hasExcessiveScopes,
          tokenStatus: 'ACTIVE',
          isActive: true,
          expiresAt,
          lastSyncAt: new Date(),
        },
        create: {
          userId,
          authType,
          encryptedToken: encrypted.encryptedText,
          tokenIv: encrypted.iv,
          tokenTag: encrypted.tag,
          keyVersion: encrypted.keyVersion,
          gitUsername: ghUser.login,
          gitId: String(ghUser.id),
          gitAvatar: ghUser.avatar_url,
          scopes,
          hasExcessiveScopes,
          tokenStatus: 'ACTIVE',
          isActive: true,
          expiresAt,
          lastSyncAt: new Date(),
        },
      });
    });

    await this.recordAuditLog(
      userId,
      authType === 'OAUTH' ? 'OAUTH_SAVE' : 'PAT_SAVE',
      'SUCCESS',
      `Account: @${ghUser.login} | Scopes: ${scopes.join(', ') || 'fine-grained'}${hasExcessiveScopes ? ' [EXCESSIVE_SCOPES_DETECTED]' : ''}`,
      meta,
    );

    return {
      success: true,
      id: account.id,
      username: account.gitUsername,
      avatarUrl: account.gitAvatar,
      authType: account.authType,
      scopes: account.scopes,
      hasExcessiveScopes: account.hasExcessiveScopes,
      tokenStatus: account.tokenStatus,
      expiresAt: account.expiresAt,
      isActive: account.isActive,
    };
  }

  async exchangeOAuthCode(userId: string, code: string, meta?: RequestMetadata) {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'GitHub OAuth chưa được cấu hình Client ID & Secret trên server. Bạn có thể sử dụng Personal Access Token (PAT) ngay.',
      );
    }

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
    };
    if (!tokenData.access_token) {
      await this.recordAuditLog(
        userId,
        'OAUTH_SAVE',
        'FAILED',
        `OAuth token exchange failed: ${tokenData.error || 'No token'}`,
        meta,
      );
      throw new BadRequestException(
        `Trao đổi OAuth code thất bại: ${tokenData.error || 'Token không hợp lệ'}`,
      );
    }

    return this.savePersonalAccessToken(userId, tokenData.access_token, 'OAUTH', meta);
  }

  async getStatus(userId: string): Promise<GitStatusResponse> {
    const accounts = await this.prisma.gitAccount.findMany({
      where: { userId },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    });

    if (accounts.length === 0) {
      return { connected: false, accounts: [] };
    }

    const active = accounts.find((a) => a.isActive) ?? accounts[0];

    const mappedAccounts = accounts.map((acc) => ({
      id: acc.id,
      gitUsername: acc.gitUsername,
      gitAvatar: acc.gitAvatar,
      authType: acc.authType,
      scopes: acc.scopes,
      hasExcessiveScopes: acc.hasExcessiveScopes,
      tokenStatus: acc.tokenStatus,
      expiresAt: acc.expiresAt,
      lastSyncAt: acc.lastSyncAt,
      isActive: acc.id === active.id,
    }));

    return {
      connected: true,
      activeAccountId: active.id,
      gitUsername: active.gitUsername,
      gitAvatar: active.gitAvatar,
      authType: active.authType,
      scopes: active.scopes,
      hasExcessiveScopes: active.hasExcessiveScopes,
      tokenStatus: active.tokenStatus,
      expiresAt: active.expiresAt,
      lastSyncAt: active.lastSyncAt,
      accounts: mappedAccounts,
    };
  }

  async switchActiveAccount(
    userId: string,
    accountId: string,
    meta?: RequestMetadata,
  ): Promise<GitStatusResponse> {
    const target = await this.prisma.gitAccount.findFirst({
      where: { id: accountId, userId },
    });

    if (!target) {
      throw new NotFoundException('Không tìm thấy tài khoản GitHub đã liên kết.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.gitAccount.updateMany({
        where: { userId },
        data: { isActive: false },
      });
      await tx.gitAccount.updateMany({
        where: { id: accountId, userId },
        data: { isActive: true },
      });
    });

    await this.recordAuditLog(
      userId,
      'ACCOUNT_SWITCH',
      'SUCCESS',
      `Switched active GitHub account to @${target.gitUsername}`,
      meta,
    );

    return this.getStatus(userId);
  }

  async disconnect(
    userId: string,
    meta?: RequestMetadata,
    accountId?: string,
  ): Promise<GitStatusResponse> {
    if (accountId) {
      const target = await this.prisma.gitAccount.findFirst({
        where: { id: accountId, userId },
      });
      if (!target) {
        throw new NotFoundException('Không tìm thấy tài khoản GitHub đã liên kết.');
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.gitAccount.deleteMany({
          where: { id: accountId, userId },
        });

        const remaining = await tx.gitAccount.findMany({
          where: { userId },
          orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
        });

        if (remaining.length > 0 && !remaining.some((a) => a.isActive)) {
          await tx.gitAccount.updateMany({
            where: { id: remaining[0].id, userId },
            data: { isActive: true },
          });
        }
      });

      await this.recordAuditLog(
        userId,
        'DISCONNECT',
        'SUCCESS',
        `Purged GitHub account @${target.gitUsername} from database`,
        meta,
      );
      return this.getStatus(userId);
    }

    await this.prisma.gitAccount.deleteMany({
      where: { userId },
    });
    await this.recordAuditLog(
      userId,
      'DISCONNECT',
      'SUCCESS',
      'Purged all GitHub tokens from database',
      meta,
    );
    return { success: true, connected: false, accounts: [] };
  }

  async getDecryptedToken(
    userId: string,
    action = 'TOKEN_DECRYPT',
    meta?: RequestMetadata,
  ): Promise<{ token: string; username: string; accountId: string }> {
    const account = await this.prisma.gitAccount.findFirst({
      where: { userId },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    });

    if (!account) {
      throw new NotFoundException('Tài khoản chưa được kết nối với GitHub.');
    }

    if (account.tokenStatus === 'REVOKED' || account.tokenStatus === 'EXPIRED') {
      throw new BadRequestException(
        `GitHub token hiện ở trạng thái ${account.tokenStatus}. Vui lòng kết nối lại tài khoản.`,
      );
    }

    try {
      const token = this.crypto.decrypt(
        account.encryptedToken,
        account.tokenIv,
        account.tokenTag,
        userId,
      );

      await this.recordAuditLog(userId, action, 'SUCCESS', undefined, meta);
      return { token, username: account.gitUsername, accountId: account.id };
    } catch (err: unknown) {
      await this.recordAuditLog(userId, action, 'FAILED', 'Decryption error', meta);
      throw err;
    }
  }

  async getWorkspaces(userId: string): Promise<GitHubWorkspacesResponse> {
    const { token, username, accountId } = await this.getDecryptedToken(userId, 'ACTIVITY_FETCH');
    const headers = {
      ...buildGitHubHeaders(token),
      'Content-Type': 'application/json',
    };

    const query = `
      query {
        viewer {
          login
          avatarUrl
          organizations(first: 50) {
            nodes {
              login
              name
              avatarUrl
            }
          }
          repositories(first: 1, ownerAffiliations: [OWNER]) {
            totalCount
          }
        }
      }
    `;

    try {
      const gqlRes = await fetch(GITHUB_GRAPHQL_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query }),
      });

      if (gqlRes.status === 401) {
        await this.markAccountRevoked(userId, accountId);
        throw new BadRequestException(
          'GitHub Token đã hết hạn hoặc bị thu hồi trên GitHub. Vui lòng kết nối lại.',
        );
      }

      if (gqlRes.ok) {
        const json = (await gqlRes.json()) as { data?: GraphQlViewerWorkspacesData };
        const viewer = json.data?.viewer;
        if (viewer) {
          const organizations: GitHubOrganizationWorkspace[] = (viewer.organizations?.nodes ?? [])
            .filter((o): o is { login: string; name?: string | null; avatarUrl?: string | null } =>
              Boolean(o?.login),
            )
            .map((o) => ({
              login: o.login,
              name: o.name || o.login,
              avatarUrl: o.avatarUrl ?? null,
            }));

          return {
            personal: {
              login: viewer.login || username,
              avatarUrl: viewer.avatarUrl ?? null,
              accessibleRepoCount: viewer.repositories?.totalCount ?? 0,
            },
            organizations,
          };
        }
      }
    } catch (err: unknown) {
      if (err instanceof BadRequestException) throw err;
      this.logger.warn(`GraphQL workspaces lookup failed: ${(err as Error).message}`);
    }

    // REST fallback
    const [userRes, orgsRes] = await Promise.all([
      fetch('https://api.github.com/user', { headers }),
      fetch('https://api.github.com/user/orgs?per_page=50', { headers }),
    ]);

    if (userRes.status === 401) {
      await this.markAccountRevoked(userId, accountId);
      throw new BadRequestException(
        'GitHub Token đã hết hạn hoặc bị thu hồi trên GitHub. Vui lòng kết nối lại.',
      );
    }

    const ghUser = userRes.ok
      ? ((await userRes.json()) as {
          login?: string;
          avatar_url?: string;
          public_repos?: number;
          total_private_repos?: number;
        })
      : null;
    const ghOrgs = orgsRes.ok
      ? ((await orgsRes.json()) as Array<{ login?: string; avatar_url?: string }>)
      : [];

    return {
      personal: {
        login: ghUser?.login || username,
        avatarUrl: ghUser?.avatar_url ?? null,
        accessibleRepoCount: (ghUser?.public_repos ?? 0) + (ghUser?.total_private_repos ?? 0),
      },
      organizations: ghOrgs
        .filter((o): o is { login: string; avatar_url?: string } => Boolean(o.login))
        .map((o) => ({
          login: o.login,
          name: o.login,
          avatarUrl: o.avatar_url ?? null,
        })),
    };
  }

  async fetchActivity(
    userId: string,
    sinceIso?: string,
    meta?: RequestMetadata,
  ): Promise<PrActivity[]> {
    const { token, username, accountId } = await this.getDecryptedToken(
      userId,
      'ACTIVITY_FETCH',
      meta,
    );

    const prefs = this.settingsService
      ? (await this.settingsService.getSettings(userId)).fetchPreferences
      : normalizeFetchPreferences(null);

    let since: Date;
    if (sinceIso) {
      since = new Date(sinceIso);
    } else {
      since = new Date();
      since.setHours(0, 0, 0, 0);
    }

    const seenPrCommitShas = new Set<string>();
    const prActivities = await this.fetchPrActivities(
      userId,
      accountId,
      token,
      username,
      since,
      prefs,
      seenPrCommitShas,
      meta,
    );

    const directActivities = prefs.includeDirectCommits
      ? await this.fetchDirectCommits(token, username, since, prefs, seenPrCommitShas)
      : [];

    const combined = [...prActivities, ...directActivities].sort((a, b) => {
      const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return tB - tA;
    });

    await this.prisma.gitAccount.updateMany({
      where: { id: accountId, userId },
      data: { lastSyncAt: new Date() },
    });

    return combined;
  }

  private async markAccountRevoked(
    userId: string,
    accountId: string,
    meta?: RequestMetadata,
  ): Promise<void> {
    await this.prisma.gitAccount.updateMany({
      where: { id: accountId, userId },
      data: { tokenStatus: 'REVOKED' },
    });
    await this.recordAuditLog(
      userId,
      'TOKEN_REVOKED',
      'SUCCESS',
      'GitHub API returned 401 Bad credentials',
      meta,
    );
  }

  private async fetchPrActivities(
    userId: string,
    accountId: string,
    token: string,
    username: string,
    since: Date,
    prefs: FetchPreferences,
    seenPrCommitShas: Set<string>,
    meta?: RequestMetadata,
  ): Promise<PrActivity[]> {
    const sinceDateFloor = computeQueryDateFloor(since);
    const searchQuery = buildPrSearchQueryString(username, sinceDateFloor, prefs);
    const headers = buildGitHubHeaders(token);

    const graphqlQuery = `
      query($q: String!) {
        search(query: $q, type: ISSUE, first: 60) {
          nodes {
            ... on PullRequest {
              number
              title
              url
              state
              isDraft
              merged
              mergedAt
              createdAt
              updatedAt
              headRefName
              baseRefName
              labels(first: 8) {
                nodes {
                  name
                  color
                }
              }
              repository {
                nameWithOwner
                isPrivate
                owner {
                  login
                  __typename
                  avatarUrl
                }
              }
              commits(last: 100) {
                nodes {
                  commit {
                    oid
                    messageHeadline
                    committedDate
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const gqlRes = await fetch(GITHUB_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: graphqlQuery,
          variables: { q: searchQuery },
        }),
      });

      if (gqlRes.status === 401) {
        await this.markAccountRevoked(userId, accountId, meta);
        throw new BadRequestException(
          'GitHub Token đã hết hạn hoặc bị thu hồi trên GitHub. Vui lòng kết nối lại.',
        );
      }

      if (gqlRes.ok) {
        const body = (await gqlRes.json()) as {
          data?: { search?: { nodes?: GraphQlSearchPrNode[] } };
          errors?: Array<{ message?: string }>;
        };

        if (body.data?.search?.nodes && !body.errors?.length) {
          const results: PrActivity[] = [];
          for (const node of body.data.search.nodes) {
            const normalized = normalizePrNode(node, since, username, prefs, seenPrCommitShas);
            if (normalized) {
              results.push(normalized);
            }
          }
          return results;
        }
      }
    } catch (err: unknown) {
      if (err instanceof BadRequestException) throw err;
      this.logger.warn(`GraphQL PR search fallback to REST: ${(err as Error).message}`);
    }

    return this.fetchPrActivitiesViaRest(
      userId,
      accountId,
      headers,
      username,
      since,
      sinceDateFloor,
      prefs,
      seenPrCommitShas,
      meta,
    );
  }

  private async fetchPrActivitiesViaRest(
    userId: string,
    accountId: string,
    headers: Record<string, string>,
    username: string,
    since: Date,
    sinceDateFloor: string,
    prefs: FetchPreferences,
    seenPrCommitShas: Set<string>,
    meta?: RequestMetadata,
  ): Promise<PrActivity[]> {
    const roleQualifier =
      prefs.fetchRole === 'involves' ? `involves:${username}` : `author:${username}`;
    const q = encodeURIComponent(`is:pr ${roleQualifier} updated:>=${sinceDateFloor}`);
    const searchUrl = `https://api.github.com/search/issues?q=${q}&sort=updated&order=desc&per_page=50`;

    const searchRes = await fetch(searchUrl, { headers });
    if (!searchRes.ok) {
      if (searchRes.status === 401) {
        await this.markAccountRevoked(userId, accountId, meta);
        throw new BadRequestException(
          'GitHub Token đã hết hạn hoặc bị thu hồi trên GitHub. Vui lòng kết nối lại.',
        );
      }

      const err = (await searchRes.json().catch(() => ({}))) as { message?: string };
      throw new BadRequestException(
        `Lỗi khi truy vấn PR từ GitHub: ${err.message || searchRes.statusText}`,
      );
    }

    const searchData = (await searchRes.json()) as {
      items?: Array<{
        number: number;
        title: string;
        html_url: string;
        state: string;
        draft?: boolean;
        pull_request?: { merged_at?: string | null };
        repository_url: string;
        created_at: string;
        updated_at: string;
      }>;
    };

    const items = searchData.items || [];
    const activities: PrActivity[] = [];

    for (const pr of items) {
      const repoFullName = pr.repository_url.replace('https://api.github.com/repos/', '');
      const ownerLogin = repoFullName.split('/')[0] || '';
      const ownerType: RepoOwnerType =
        ownerLogin.toLowerCase() === username.toLowerCase() ? 'personal' : 'organization';

      if (!matchesWorkspacePreferences(ownerType, ownerLogin, prefs)) {
        continue;
      }

      const resolvedState = resolvePrState({
        state: pr.state,
        isDraft: pr.draft,
        mergedAt: pr.pull_request?.merged_at,
      });

      if (!prefs.prStates.includes(resolvedState)) {
        continue;
      }

      const commitsUrl = `https://api.github.com/repos/${repoFullName}/pulls/${pr.number}/commits?per_page=100`;
      const recentCommits: CommitItem[] = [];
      const allCommits: CommitItem[] = [];

      try {
        const commitsRes = await fetch(commitsUrl, { headers });
        if (commitsRes.ok) {
          const commitsJson = (await commitsRes.json()) as Array<{
            sha: string;
            commit: {
              message: string;
              committer: { date: string };
            };
          }>;

          for (const c of commitsJson) {
            seenPrCommitShas.add(c.sha);
            const commitDate = new Date(c.commit.committer.date);
            const headline = c.commit.message.split('\n')[0].trim();
            const item: CommitItem = {
              sha: c.sha.slice(0, 7),
              message: headline,
              date: c.commit.committer.date,
            };
            allCommits.push(item);

            if (commitDate >= since) {
              recentCommits.push(item);
            }
          }
        }
      } catch (err: unknown) {
        this.logger.warn(
          `Could not fetch commits for ${repoFullName}#${pr.number}: ${(err as Error).message}`,
        );
      }

      const touchedInWindow =
        new Date(pr.updated_at) >= since ||
        new Date(pr.created_at) >= since ||
        Boolean(pr.pull_request?.merged_at && new Date(pr.pull_request.merged_at) >= since);

      if (
        recentCommits.length === 0 &&
        (!prefs.includePrWithoutCommitsInRange || !touchedInWindow)
      ) {
        continue;
      }

      const effectiveCommits = recentCommits.length > 0 ? recentCommits : allCommits.slice(-3);

      activities.push({
        repo: repoFullName,
        owner: ownerLogin,
        ownerType,
        number: pr.number,
        title: pr.title,
        prUrl: pr.html_url,
        state: resolvedState,
        activityType: 'pr',
        updatedAt: pr.updated_at,
        commits: effectiveCommits.map((c) => c.message),
        commitDetails: effectiveCommits,
      });
    }

    return activities;
  }

  private async fetchDirectCommits(
    token: string,
    username: string,
    since: Date,
    prefs: FetchPreferences,
    seenPrCommitShas: Set<string>,
  ): Promise<PrActivity[]> {
    const headers = buildGitHubHeaders(token);
    const usernameLower = username.toLowerCase();

    const reposQuery = `
      query {
        viewer {
          repositories(
            first: 35
            affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
            orderBy: { field: PUSHED_AT, direction: DESC }
          ) {
            nodes {
              nameWithOwner
              isPrivate
              isFork
              pushedAt
              defaultBranchRef { name }
              owner {
                login
                __typename
                avatarUrl
              }
            }
          }
        }
      }
    `;

    interface CandidateRepo {
      repo: string;
      owner: string;
      ownerType: RepoOwnerType;
      ownerAvatar?: string;
      isPrivate: boolean;
      defaultBranch?: string;
      branches: Set<string>;
      eventCommits: Array<{ branch: string; sha: string; message: string; date: string }>;
      eventCommitShas: Set<string>;
    }

    const candidateMap = new Map<string, CandidateRepo>();

    const ensureCandidate = (
      repo: string,
      owner: string,
      ownerType: RepoOwnerType,
      ownerAvatar?: string,
      isPrivate = false,
      defaultBranch?: string,
    ): CandidateRepo | null => {
      if (!matchesWorkspacePreferences(ownerType, owner, prefs)) {
        return null;
      }
      const existing = candidateMap.get(repo);
      if (existing) return existing;
      const created: CandidateRepo = {
        repo,
        owner,
        ownerType,
        ownerAvatar,
        isPrivate,
        defaultBranch,
        branches: new Set(defaultBranch ? [defaultBranch] : []),
        eventCommits: [],
        eventCommitShas: new Set(),
      };
      candidateMap.set(repo, created);
      return created;
    };

    try {
      const [gqlRes, eventsRes] = await Promise.all([
        fetch(GITHUB_GRAPHQL_URL, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: reposQuery }),
        }).catch(() => null),
        fetch(`https://api.github.com/users/${encodeURIComponent(username)}/events?per_page=100`, {
          headers,
        }).catch(() => null),
      ]);

      if (gqlRes?.ok) {
        const gqlBody = (await gqlRes.json()) as { data?: GraphQlViewerWorkspacesData };
        const repoNodes = gqlBody.data?.viewer?.repositories?.nodes ?? [];
        for (const r of repoNodes) {
          if (!r?.nameWithOwner || !r.pushedAt) continue;
          if (new Date(r.pushedAt) < since) continue;

          const ownerLogin = r.owner?.login || r.nameWithOwner.split('/')[0] || '';
          const ownerType = resolveOwnerType(r.owner?.__typename, ownerLogin, username);
          ensureCandidate(
            r.nameWithOwner,
            ownerLogin,
            ownerType,
            r.owner?.avatarUrl ?? undefined,
            Boolean(r.isPrivate),
            r.defaultBranchRef?.name,
          );
        }
      }

      if (eventsRes?.ok) {
        const events = (await eventsRes.json()) as Array<{
          type?: string;
          created_at?: string;
          actor?: { login?: string };
          repo?: { name?: string };
          payload?: {
            ref?: string;
            commits?: Array<{ sha?: string; message?: string }>;
          };
        }>;

        for (const ev of events) {
          if (ev.type !== 'PushEvent' || !ev.repo?.name || !ev.created_at) continue;
          if (new Date(ev.created_at) < since) continue;

          const repoFullName = ev.repo.name;
          const ownerLogin = repoFullName.split('/')[0] || '';
          const existingCandidate = candidateMap.get(repoFullName);
          const ownerType =
            existingCandidate?.ownerType ??
            (ownerLogin.toLowerCase() === usernameLower ? 'personal' : 'organization');

          const entry = existingCandidate ?? ensureCandidate(repoFullName, ownerLogin, ownerType);
          if (!entry) continue;

          const branchName =
            ev.payload?.ref?.replace(/^refs\/heads\//, '') || entry.defaultBranch || 'main';
          entry.branches.add(branchName);

          for (const commit of ev.payload?.commits ?? []) {
            if (!commit.sha) continue;
            entry.eventCommitShas.add(commit.sha);
            entry.eventCommits.push({
              branch: branchName,
              sha: commit.sha.slice(0, 7),
              message: (commit.message || '').split('\n')[0].trim(),
              date: ev.created_at,
            });
          }
        }
      }
    } catch (err: unknown) {
      this.logger.warn(`Direct commit discovery error: ${(err as Error).message}`);
    }

    const candidates = Array.from(candidateMap.values()).slice(0, 15);
    const directActivities: PrActivity[] = [];

    // Fetch recent commits per candidate repo with capped concurrency
    const BATCH_SIZE = 5;
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (cand) => {
          // If no PushEvent branches were discovered for a recently pushed repo, list top branches cleanly
          if (cand.branches.size <= 1) {
            try {
              const branchesRes = await fetch(
                `https://api.github.com/repos/${cand.repo}/branches?per_page=10`,
                { headers },
              );
              if (branchesRes.ok) {
                const branchesJson = (await branchesRes.json()) as Array<{ name?: string }>;
                for (const b of branchesJson) {
                  if (b.name) cand.branches.add(b.name);
                }
              }
            } catch {
              // Ignore branch enumeration failures
            }
          }

          const branchList = Array.from(cand.branches).slice(0, 4);
          const branchCommitsMap = new Map<string, Map<string, CommitItem>>();

          for (const evCommit of cand.eventCommits) {
            if (seenPrCommitShas.has(evCommit.sha)) continue;
            const branchMap =
              branchCommitsMap.get(evCommit.branch) ?? new Map<string, CommitItem>();
            branchMap.set(evCommit.sha, {
              sha: evCommit.sha.slice(0, 7),
              message: evCommit.message,
              date: evCommit.date,
            });
            branchCommitsMap.set(evCommit.branch, branchMap);
          }

          await Promise.all(
            branchList.map(async (branch) => {
              try {
                const url = `https://api.github.com/repos/${cand.repo}/commits?sha=${encodeURIComponent(
                  branch,
                )}&since=${encodeURIComponent(since.toISOString())}&per_page=40`;
                const res = await fetch(url, { headers });
                if (!res.ok) return;

                const commits = (await res.json()) as Array<{
                  sha: string;
                  commit: {
                    message: string;
                    author?: { date?: string };
                    committer?: { date?: string };
                  };
                  author?: { login?: string } | null;
                  committer?: { login?: string } | null;
                }>;

                for (const c of commits) {
                  if (seenPrCommitShas.has(c.sha)) continue;
                  const authorMatch = c.author?.login?.toLowerCase() === usernameLower;
                  const committerMatch = c.committer?.login?.toLowerCase() === usernameLower;
                  const eventMatch = cand.eventCommitShas.has(c.sha);

                  // On personal owned repos, if local git email isn't linked on GitHub (author === null), also accept when no external login owns it
                  const personalFallback =
                    cand.ownerType === 'personal' &&
                    cand.owner.toLowerCase() === usernameLower &&
                    !c.author?.login;

                  if (!authorMatch && !committerMatch && !eventMatch && !personalFallback) {
                    continue;
                  }

                  const commitDate =
                    c.commit.committer?.date || c.commit.author?.date || since.toISOString();
                  if (new Date(commitDate) < since) continue;

                  const branchMap = branchCommitsMap.get(branch) ?? new Map<string, CommitItem>();
                  branchMap.set(c.sha, {
                    sha: c.sha.slice(0, 7),
                    message: c.commit.message.split('\n')[0].trim(),
                    date: commitDate,
                  });
                  branchCommitsMap.set(branch, branchMap);
                }
              } catch {
                // Ignore individual branch lookup failures
              }
            }),
          );

          const repoActivities: PrActivity[] = [];
          const dedupGlobalForRepo = new Set<string>();

          for (const [branch, commitMap] of branchCommitsMap.entries()) {
            const uniqueItems: CommitItem[] = [];
            for (const [fullSha, item] of commitMap.entries()) {
              if (dedupGlobalForRepo.has(fullSha)) continue;
              dedupGlobalForRepo.add(fullSha);
              uniqueItems.push(item);
            }

            if (uniqueItems.length === 0) continue;

            uniqueItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            repoActivities.push({
              repo: cand.repo,
              owner: cand.owner,
              ownerType: cand.ownerType,
              ownerAvatar: cand.ownerAvatar,
              repoPrivate: cand.isPrivate,
              number: 0,
              title: branch,
              prUrl: `https://github.com/${cand.repo}/commits/${encodeURIComponent(branch)}`,
              state: 'direct_commits',
              activityType: 'direct_commits',
              headBranch: branch,
              updatedAt: uniqueItems[0]?.date,
              commits: uniqueItems.map((c) => c.message),
              commitDetails: uniqueItems,
            });
          }

          return repoActivities;
        }),
      );

      for (const items of batchResults) {
        directActivities.push(...items);
      }
    }

    return directActivities;
  }

  async resolvePullRequest(userId: string, rawRef: string): Promise<PrActivity> {
    const parsed = parsePullRequestRef(rawRef);
    if (!parsed) {
      throw new BadRequestException(
        'Định dạng PR không hợp lệ. Vui lòng nhập URL GitHub PR (https://github.com/owner/repo/pull/123) hoặc owner/repo#123.',
      );
    }

    const { token, username } = await this.getDecryptedToken(userId, 'ACTIVITY_FETCH');
    const headers = buildGitHubHeaders(token);
    const repoPath = `${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`;
    const prRes = await fetch(`https://api.github.com/repos/${repoPath}/pulls/${parsed.number}`, {
      headers,
    });

    if (prRes.status === 404) {
      throw new NotFoundException(
        'Không tìm thấy Pull Request này hoặc token GitHub hiện tại không có quyền truy cập.',
      );
    }

    if (!prRes.ok) {
      const err = (await prRes.json().catch(() => ({}))) as { message?: string };
      throw new BadRequestException(
        `Không thể tải thông tin PR từ GitHub: ${err.message || prRes.statusText}`,
      );
    }

    const prData = (await prRes.json()) as {
      number: number;
      title: string;
      html_url: string;
      state: string;
      draft?: boolean;
      merged?: boolean;
      merged_at?: string | null;
      updated_at?: string;
      created_at?: string;
      head?: { ref?: string };
      base?: {
        ref?: string;
        repo?: {
          full_name?: string;
          private?: boolean;
          owner?: { login?: string; type?: string; avatar_url?: string };
        };
      };
      labels?: Array<{ name?: string; color?: string }>;
    };

    const repoFullName = prData.base?.repo?.full_name || `${parsed.owner}/${parsed.repo}`;
    const ownerLogin =
      prData.base?.repo?.owner?.login || repoFullName.split('/')[0] || parsed.owner;
    const ownerType = resolveOwnerType(
      ownerLogin,
      username,
      prData.base?.repo?.owner?.type === 'Organization' ? 'Organization' : 'User',
    );
    const state = resolvePrState({
      state: prData.state || 'OPEN',
      isDraft: prData.draft,
      merged: prData.merged,
      mergedAt: prData.merged_at,
    });

    const commitDetails: CommitItem[] = [];
    try {
      const commitsRes = await fetch(
        `https://api.github.com/repos/${repoPath}/pulls/${parsed.number}/commits?per_page=100`,
        { headers },
      );
      if (commitsRes.ok) {
        const commitsJson = (await commitsRes.json()) as Array<{
          sha: string;
          commit?: { message?: string; committer?: { date?: string }; author?: { date?: string } };
        }>;
        for (const c of commitsJson) {
          const message = (c.commit?.message || '').split('\n')[0]?.trim() || '';
          if (!c.sha || !message) continue;
          commitDetails.push({
            sha: c.sha.slice(0, 7),
            message,
            date: c.commit?.committer?.date || c.commit?.author?.date || prData.updated_at || '',
          });
        }
      }
    } catch {
      // Non-fatal: metadata alone is enough for tracking task assignment
    }

    return {
      repo: repoFullName,
      owner: ownerLogin,
      ownerType,
      ownerAvatar: prData.base?.repo?.owner?.avatar_url,
      repoPrivate: Boolean(prData.base?.repo?.private),
      number: prData.number ?? parsed.number,
      title: prData.title || `${repoFullName}#${parsed.number}`,
      prUrl: prData.html_url || `https://github.com/${repoFullName}/pull/${parsed.number}`,
      state,
      activityType: 'pr',
      headBranch: prData.head?.ref,
      baseBranch: prData.base?.ref,
      labels: (prData.labels ?? [])
        .filter((l): l is { name: string; color?: string } => Boolean(l?.name))
        .map((l) => ({ name: l.name, color: l.color })),
      updatedAt: prData.updated_at || prData.created_at,
      commits: commitDetails.map((c) => c.message),
      commitDetails,
    };
  }

  /** Batch-resolve current PR state and title for stored tracking items (even outside active scan window). */
  async syncPullRequestStates(
    userId: string,
    refs: Array<{ repo: string; prNumber: number }>,
  ): Promise<Map<string, { state: PrState; title: string }>> {
    const resolved = new Map<string, { state: PrState; title: string }>();
    const uniqueRefs = new Map<
      string,
      { owner: string; name: string; repo: string; number: number }
    >();

    for (const ref of refs) {
      if (!Number.isInteger(ref.prNumber) || ref.prNumber <= 0) continue;
      const parts = ref.repo.trim().split('/');
      if (parts.length !== 2) continue;
      const [owner, name] = parts;
      if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(name)) continue;
      const repo = `${owner}/${name}`;
      uniqueRefs.set(`${repo.toLowerCase()}#${ref.prNumber}`, {
        owner,
        name,
        repo,
        number: ref.prNumber,
      });
    }

    if (uniqueRefs.size === 0) {
      return resolved;
    }

    let token: string;
    try {
      const creds = await this.getDecryptedToken(userId, 'ACTIVITY_FETCH');
      token = creds.token;
    } catch {
      return resolved;
    }

    const entries = Array.from(uniqueRefs.entries());
    const BATCH_SIZE = 30;

    for (let offset = 0; offset < entries.length; offset += BATCH_SIZE) {
      const chunk = entries.slice(offset, offset + BATCH_SIZE);
      const varDecls: string[] = [];
      const fields: string[] = [];
      const variables: Record<string, string | number> = {};

      chunk.forEach(([lookupKey, info], idx) => {
        const oVar = `o${idx}`;
        const nVar = `n${idx}`;
        const pVar = `p${idx}`;
        varDecls.push(`$${oVar}: String!`, `$${nVar}: String!`, `$${pVar}: Int!`);
        variables[oVar] = info.owner;
        variables[nVar] = info.name;
        variables[pVar] = info.number;
        fields.push(
          `pr${idx}: repository(owner: $${oVar}, name: $${nVar}) { pullRequest(number: $${pVar}) { title state isDraft merged mergedAt } }`,
        );
        void lookupKey;
      });

      const query = `query(${varDecls.join(', ')}) { ${fields.join(' ')} }`;

      try {
        const res = await fetch(GITHUB_GRAPHQL_URL, {
          method: 'POST',
          headers: {
            ...buildGitHubHeaders(token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query, variables }),
        });

        if (!res.ok) continue;

        const payload = (await res.json()) as {
          data?: Record<
            string,
            {
              pullRequest?: {
                title?: string;
                state?: string;
                isDraft?: boolean;
                merged?: boolean;
                mergedAt?: string | null;
              } | null;
            } | null
          >;
        };

        if (!payload.data) continue;

        chunk.forEach(([lookupKey], idx) => {
          const pr = payload.data?.[`pr${idx}`]?.pullRequest;
          if (!pr?.state) return;
          const state = resolvePrState({
            state: pr.state,
            isDraft: pr.isDraft,
            merged: pr.merged,
            mergedAt: pr.mergedAt,
          });
          resolved.set(lookupKey, {
            state,
            title: (pr.title || '').trim(),
          });
        });
      } catch {
        // Ignore transient network errors during background state sync
      }
    }

    return resolved;
  }
}
