import { FetchPreferences } from '../settings/settings.types';

export type PrState = 'draft' | 'open' | 'merged' | 'closed' | 'direct_commits';
export type RepoOwnerType = 'personal' | 'organization';
export type ActivityType = 'pr' | 'direct_commits';

export interface CommitItem {
  sha: string;
  message: string;
  date: string;
}

export interface PrLabelItem {
  name: string;
  color?: string;
}

export interface PrActivity {
  repo: string;
  owner: string;
  ownerType: RepoOwnerType;
  ownerAvatar?: string;
  repoPrivate?: boolean;
  number: number;
  title: string;
  prUrl: string;
  state: PrState;
  activityType: ActivityType;
  headBranch?: string;
  baseBranch?: string;
  labels?: PrLabelItem[];
  updatedAt?: string;
  commits: string[];
  commitDetails: CommitItem[];
}

export interface GitHubOrganizationWorkspace {
  login: string;
  name: string;
  avatarUrl: string | null;
}

export interface GitHubWorkspacesResponse {
  personal: {
    login: string;
    avatarUrl: string | null;
    accessibleRepoCount: number;
  };
  organizations: GitHubOrganizationWorkspace[];
}

export interface GraphQlSearchPrNode {
  __typename?: string;
  number?: number;
  title?: string;
  url?: string;
  state?: string;
  isDraft?: boolean;
  merged?: boolean;
  mergedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  headRefName?: string;
  baseRefName?: string;
  labels?: {
    nodes?: Array<{ name?: string; color?: string }>;
  };
  repository?: {
    nameWithOwner?: string;
    isPrivate?: boolean;
    owner?: {
      login?: string;
      __typename?: string;
      avatarUrl?: string;
    };
  };
  commits?: {
    nodes?: Array<{
      commit?: {
        oid?: string;
        messageHeadline?: string;
        committedDate?: string;
      };
    }>;
  };
}

export interface GraphQlViewerWorkspacesData {
  viewer?: {
    login?: string;
    avatarUrl?: string;
    organizations?: {
      nodes?: Array<{
        login?: string;
        name?: string | null;
        avatarUrl?: string | null;
      }>;
    };
    repositories?: {
      totalCount?: number;
      nodes?: Array<{
        nameWithOwner?: string;
        isPrivate?: boolean;
        isFork?: boolean;
        pushedAt?: string | null;
        defaultBranchRef?: { name?: string } | null;
        owner?: {
          login?: string;
          __typename?: string;
          avatarUrl?: string | null;
        };
      }>;
    };
  };
}

export const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

export function buildGitHubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'GitPulse-Agent/1.0',
  };
}

export function resolvePrState(input: {
  state: string;
  isDraft?: boolean;
  merged?: boolean;
  mergedAt?: string | null;
}): Exclude<PrState, 'direct_commits'> {
  if (input.isDraft) return 'draft';
  if (input.merged || Boolean(input.mergedAt)) return 'merged';
  if (input.state.toUpperCase() === 'OPEN') return 'open';
  return 'closed';
}

export function resolveOwnerType(
  ownerTypename: string | undefined,
  ownerLogin: string,
  currentUsername: string,
): RepoOwnerType {
  if (ownerTypename === 'Organization') return 'organization';
  if (ownerTypename === 'User') return 'personal';
  return ownerLogin.toLowerCase() === currentUsername.toLowerCase() ? 'personal' : 'organization';
}

export function matchesWorkspacePreferences(
  ownerType: RepoOwnerType,
  ownerLogin: string,
  prefs: FetchPreferences,
): boolean {
  if (ownerType === 'personal') {
    return prefs.includePersonal;
  }
  if (prefs.includedOrgs.length === 0) {
    return true;
  }
  return prefs.includedOrgs.some((org) => org.toLowerCase() === ownerLogin.toLowerCase());
}

export function computeQueryDateFloor(since: Date): string {
  // Subtract 1 day buffer so UTC vs local timezone differences never miss PRs updated near midnight
  const buffered = new Date(since.getTime() - 24 * 60 * 60 * 1000);
  return buffered.toISOString().slice(0, 10);
}

export function buildPrSearchQueryString(
  username: string,
  sinceDateFloor: string,
  prefs: FetchPreferences,
): string {
  const roleQualifier =
    prefs.fetchRole === 'involves' ? `involves:${username}` : `author:${username}`;
  return `is:pr ${roleQualifier} updated:>=${sinceDateFloor} sort:updated-desc`;
}

export function normalizePrNode(
  node: GraphQlSearchPrNode,
  since: Date,
  currentUsername: string,
  prefs: FetchPreferences,
  seenPrCommitShas: Set<string>,
): PrActivity | null {
  if (!node.number || !node.repository?.nameWithOwner || !node.title || !node.url) {
    return null;
  }

  const repoFullName = node.repository.nameWithOwner;
  const ownerLogin = node.repository.owner?.login || repoFullName.split('/')[0] || '';
  const ownerType = resolveOwnerType(
    node.repository.owner?.__typename,
    ownerLogin,
    currentUsername,
  );

  if (!matchesWorkspacePreferences(ownerType, ownerLogin, prefs)) {
    return null;
  }

  const resolvedState = resolvePrState({
    state: node.state || 'OPEN',
    isDraft: node.isDraft,
    merged: node.merged,
    mergedAt: node.mergedAt,
  });

  if (!prefs.prStates.includes(resolvedState)) {
    return null;
  }

  const commitNodes = node.commits?.nodes ?? [];
  const inWindowCommits: CommitItem[] = [];
  const allLoadedCommits: CommitItem[] = [];

  for (const wrapper of commitNodes) {
    const c = wrapper?.commit;
    if (!c?.oid) continue;
    seenPrCommitShas.add(c.oid);

    const headline = (c.messageHeadline || '').trim();
    const dateStr = c.committedDate || node.updatedAt || '';
    const item: CommitItem = {
      sha: c.oid.slice(0, 7),
      message: headline,
      date: dateStr,
    };
    allLoadedCommits.push(item);

    if (dateStr && new Date(dateStr) >= since) {
      inWindowCommits.push(item);
    }
  }

  const touchedInWindow =
    (node.updatedAt && new Date(node.updatedAt) >= since) ||
    (node.createdAt && new Date(node.createdAt) >= since) ||
    (node.mergedAt && new Date(node.mergedAt) >= since);

  if (inWindowCommits.length === 0) {
    if (!prefs.includePrWithoutCommitsInRange || !touchedInWindow) {
      return null;
    }
  }

  const effectiveCommits =
    inWindowCommits.length > 0 ? inWindowCommits : allLoadedCommits.slice(-3);

  const labels = (node.labels?.nodes ?? [])
    .filter((l): l is { name: string; color?: string } => Boolean(l?.name))
    .map((l) => ({ name: l.name, color: l.color }));

  return {
    repo: repoFullName,
    owner: ownerLogin,
    ownerType,
    ownerAvatar: node.repository.owner?.avatarUrl,
    repoPrivate: Boolean(node.repository.isPrivate),
    number: node.number,
    title: node.title,
    prUrl: node.url,
    state: resolvedState,
    activityType: 'pr',
    headBranch: node.headRefName,
    baseBranch: node.baseRefName,
    labels,
    updatedAt: node.updatedAt || node.createdAt,
    commits: effectiveCommits.map((c) => c.message),
    commitDetails: effectiveCommits,
  };
}
