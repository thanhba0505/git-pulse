import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CryptoService } from "../common/crypto.service";

export interface GitHubUserResponse {
  login: string;
  id: number;
  avatar_url: string;
  name: string;
}

export interface CommitItem {
  sha: string;
  message: string;
  date: string;
}

export interface PrActivity {
  repo: string;
  number: number;
  title: string;
  prUrl: string;
  state: string;
  commits: string[];
  commitDetails: CommitItem[];
}

export interface RequestMetadata {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  /**
   * Persists an audit log entry for token operations
   */
  async recordAuditLog(
    userId: string,
    action: string,
    status: "SUCCESS" | "FAILED",
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
      this.logger.warn(
        `Could not record token audit log: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Validates and saves a GitHub Personal Access Token (PAT) with HKDF encryption
   */
  async savePersonalAccessToken(
    userId: string,
    token: string,
    authType: "PAT" | "OAUTH" = "PAT",
    meta?: RequestMetadata,
  ) {
    const cleanToken = token.trim();
    if (!cleanToken) {
      throw new BadRequestException("Token không được để trống.");
    }

    // Verify token with GitHub API
    let userRes: Response;
    try {
      userRes = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "GitPulse-Agent/1.0",
        },
      });
    } catch {
      await this.recordAuditLog(
        userId,
        authType === "OAUTH" ? "OAUTH_SAVE" : "PAT_SAVE",
        "FAILED",
        "Network connection to GitHub failed",
        meta,
      );
      throw new BadRequestException("Không thể kết nối tới GitHub API.");
    }

    if (!userRes.ok) {
      await this.recordAuditLog(
        userId,
        authType === "OAUTH" ? "OAUTH_SAVE" : "PAT_SAVE",
        "FAILED",
        `GitHub API returned ${userRes.status}`,
        meta,
      );
      const err = await userRes.json().catch(() => ({}));
      throw new BadRequestException(
        `Xác thực Personal Access Token thất bại: ${err.message || userRes.statusText}`,
      );
    }

    const ghUser = (await userRes.json()) as GitHubUserResponse;
    const scopesHeader = userRes.headers.get("x-oauth-scopes") || "";
    const scopes = scopesHeader
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // 1. Detect Over-privileged Scopes
    const DANGEROUS_SCOPES = [
      "delete_repo",
      "admin:org",
      "admin:repo_hook",
      "admin:org_hook",
      "workflow",
      "admin:enterprise",
    ];
    const hasExcessiveScopes = scopes.some((s) => DANGEROUS_SCOPES.includes(s));

    // 2. Extract Token Expiration if provided by GitHub header
    const expHeader = userRes.headers.get(
      "github-authentication-token-expiration",
    );
    let expiresAt: Date | null = null;
    if (expHeader) {
      const parsed = new Date(expHeader);
      if (!isNaN(parsed.getTime())) {
        expiresAt = parsed;
      }
    }

    // 3. Encrypt token with Per-User HKDF Key Derivation
    const encrypted = this.crypto.encrypt(cleanToken, userId);

    const account = await this.prisma.gitAccount.upsert({
      where: { userId },
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
        tokenStatus: "ACTIVE",
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
        tokenStatus: "ACTIVE",
        expiresAt,
        lastSyncAt: new Date(),
      },
    });

    await this.recordAuditLog(
      userId,
      authType === "OAUTH" ? "OAUTH_SAVE" : "PAT_SAVE",
      "SUCCESS",
      `Scopes: ${scopes.join(", ") || "fine-grained"}${hasExcessiveScopes ? " [EXCESSIVE_SCOPES_DETECTED]" : ""}`,
      meta,
    );

    return {
      success: true,
      username: account.gitUsername,
      avatarUrl: account.gitAvatar,
      authType: account.authType,
      scopes: account.scopes,
      hasExcessiveScopes: account.hasExcessiveScopes,
      tokenStatus: account.tokenStatus,
      expiresAt: account.expiresAt,
    };
  }

  async exchangeOAuthCode(
    userId: string,
    code: string,
    meta?: RequestMetadata,
  ) {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        "GitHub OAuth chưa được cấu hình Client ID & Secret trên server. Bạn có thể sử dụng Personal Access Token (PAT) ngay.",
      );
    }

    const tokenRes = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      },
    );

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
    };
    if (!tokenData.access_token) {
      await this.recordAuditLog(
        userId,
        "OAUTH_SAVE",
        "FAILED",
        `OAuth token exchange failed: ${tokenData.error || "No token"}`,
        meta,
      );
      throw new BadRequestException(
        `Trao đổi OAuth code thất bại: ${tokenData.error || "Token không hợp lệ"}`,
      );
    }

    return this.savePersonalAccessToken(
      userId,
      tokenData.access_token,
      "OAUTH",
      meta,
    );
  }

  async getStatus(userId: string) {
    const account = await this.prisma.gitAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      return { connected: false };
    }

    return {
      connected: true,
      gitUsername: account.gitUsername,
      gitAvatar: account.gitAvatar,
      authType: account.authType,
      scopes: account.scopes,
      hasExcessiveScopes: account.hasExcessiveScopes,
      tokenStatus: account.tokenStatus,
      expiresAt: account.expiresAt,
      lastSyncAt: account.lastSyncAt,
    };
  }

  async disconnect(userId: string, meta?: RequestMetadata) {
    await this.prisma.gitAccount.deleteMany({
      where: { userId },
    });
    await this.recordAuditLog(
      userId,
      "DISCONNECT",
      "SUCCESS",
      "Purged GitHub tokens from database",
      meta,
    );
    return { success: true };
  }

  async getDecryptedToken(
    userId: string,
    action = "TOKEN_DECRYPT",
    meta?: RequestMetadata,
  ): Promise<{ token: string; username: string }> {
    const account = await this.prisma.gitAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      throw new NotFoundException("Tài khoản chưa được kết nối với GitHub.");
    }

    if (
      account.tokenStatus === "REVOKED" ||
      account.tokenStatus === "EXPIRED"
    ) {
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

      await this.recordAuditLog(userId, action, "SUCCESS", undefined, meta);
      return { token, username: account.gitUsername };
    } catch (err: unknown) {
      await this.recordAuditLog(
        userId,
        action,
        "FAILED",
        "Decryption error",
        meta,
      );
      throw err;
    }
  }

  async fetchActivity(
    userId: string,
    sinceIso?: string,
    meta?: RequestMetadata,
  ): Promise<PrActivity[]> {
    const { token, username } = await this.getDecryptedToken(
      userId,
      "ACTIVITY_FETCH",
      meta,
    );

    // Calculate beginning of today in UTC if not provided
    let since: Date;
    if (sinceIso) {
      since = new Date(sinceIso);
    } else {
      since = new Date();
      since.setHours(0, 0, 0, 0);
    }

    const sinceDateStr = since.toISOString().slice(0, 10);
    const searchUrl = `https://api.github.com/search/issues?q=is:pr+author:${username}+updated:>=${sinceDateStr}&sort=updated&order=desc&per_page=50`;

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "GitPulse-Agent/1.0",
    };

    const searchRes = await fetch(searchUrl, { headers });
    if (!searchRes.ok) {
      if (searchRes.status === 401) {
        await this.prisma.gitAccount.updateMany({
          where: { userId },
          data: { tokenStatus: "REVOKED" },
        });
        await this.recordAuditLog(
          userId,
          "TOKEN_REVOKED",
          "SUCCESS",
          "GitHub API search returned 401 Bad credentials",
          meta,
        );
        throw new BadRequestException(
          "GitHub Token đã hết hạn hoặc bị thu hồi trên GitHub. Vui lòng kết nối lại.",
        );
      }

      const err = await searchRes.json().catch(() => ({}));
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
        repository_url: string;
        updated_at: string;
      }>;
    };

    const items = searchData.items || [];
    const activities: PrActivity[] = [];

    for (const pr of items) {
      const repoFullName = pr.repository_url.replace(
        "https://api.github.com/repos/",
        "",
      );
      const commitsUrl = `https://api.github.com/repos/${repoFullName}/pulls/${pr.number}/commits?per_page=100`;

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

          const recentCommits: CommitItem[] = [];
          const commitHeadlines: string[] = [];

          for (const c of commitsJson) {
            const commitDate = new Date(c.commit.committer.date);
            if (commitDate >= since) {
              const headline = c.commit.message.split("\n")[0].trim();
              commitHeadlines.push(headline);
              recentCommits.push({
                sha: c.sha.slice(0, 7),
                message: headline,
                date: c.commit.committer.date,
              });
            }
          }

          if (recentCommits.length > 0) {
            activities.push({
              repo: repoFullName,
              number: pr.number,
              title: pr.title,
              prUrl: pr.html_url,
              state: pr.state,
              commits: commitHeadlines,
              commitDetails: recentCommits,
            });
          }
        }
      } catch (err) {
        this.logger.warn(
          `Could not fetch commits for ${repoFullName}#${pr.number}: ${(err as Error).message}`,
        );
      }
    }

    // Update last sync
    await this.prisma.gitAccount.updateMany({
      where: { userId },
      data: { lastSyncAt: new Date() },
    });

    return activities;
  }
}
