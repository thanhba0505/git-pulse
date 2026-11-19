export type GroupingMode = 'owner' | 'task' | 'repo' | 'flat';
export type FetchTimeRange = 'today' | '24h' | '7d';
export type PrStateFilter = 'draft' | 'open' | 'merged' | 'closed';
export type FetchRoleScope = 'author' | 'involves';

export interface FetchPreferences {
  defaultGroupBy: GroupingMode;
  defaultTimeRange: FetchTimeRange;
  includePersonal: boolean;
  includedOrgs: string[];
  prStates: PrStateFilter[];
  fetchRole: FetchRoleScope;
  includeDirectCommits: boolean;
  includePrWithoutCommitsInRange: boolean;
  compactCommits: boolean;
}

export const VALID_GROUPING_MODES: readonly GroupingMode[] = ['owner', 'task', 'repo', 'flat'];
export const VALID_TIME_RANGES: readonly FetchTimeRange[] = ['today', '24h', '7d'];
export const VALID_PR_STATES: readonly PrStateFilter[] = ['draft', 'open', 'merged', 'closed'];
export const VALID_FETCH_ROLES: readonly FetchRoleScope[] = ['author', 'involves'];

export const DEFAULT_FETCH_PREFERENCES: FetchPreferences = {
  defaultGroupBy: 'owner',
  defaultTimeRange: 'today',
  includePersonal: true,
  includedOrgs: [],
  prStates: ['draft', 'open', 'merged', 'closed'],
  fetchRole: 'author',
  includeDirectCommits: true,
  includePrWithoutCommitsInRange: true,
  compactCommits: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

export function normalizeFetchPreferences(raw: unknown): FetchPreferences {
  if (!isRecord(raw)) {
    return {
      ...DEFAULT_FETCH_PREFERENCES,
      includedOrgs: [...DEFAULT_FETCH_PREFERENCES.includedOrgs],
      prStates: [...DEFAULT_FETCH_PREFERENCES.prStates],
    };
  }

  const includedOrgs = Array.isArray(raw.includedOrgs)
    ? Array.from(
        new Set(
          raw.includedOrgs
            .filter((item): item is string => typeof item === 'string')
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      )
    : [...DEFAULT_FETCH_PREFERENCES.includedOrgs];

  const prStatesRaw = Array.isArray(raw.prStates)
    ? Array.from(
        new Set(
          raw.prStates.filter((item): item is PrStateFilter => isOneOf(item, VALID_PR_STATES)),
        ),
      )
    : [...DEFAULT_FETCH_PREFERENCES.prStates];

  return {
    defaultGroupBy: isOneOf(raw.defaultGroupBy, VALID_GROUPING_MODES)
      ? raw.defaultGroupBy
      : DEFAULT_FETCH_PREFERENCES.defaultGroupBy,
    defaultTimeRange: isOneOf(raw.defaultTimeRange, VALID_TIME_RANGES)
      ? raw.defaultTimeRange
      : DEFAULT_FETCH_PREFERENCES.defaultTimeRange,
    includePersonal:
      typeof raw.includePersonal === 'boolean'
        ? raw.includePersonal
        : DEFAULT_FETCH_PREFERENCES.includePersonal,
    includedOrgs,
    prStates: prStatesRaw,
    fetchRole: isOneOf(raw.fetchRole, VALID_FETCH_ROLES)
      ? raw.fetchRole
      : DEFAULT_FETCH_PREFERENCES.fetchRole,
    includeDirectCommits:
      typeof raw.includeDirectCommits === 'boolean'
        ? raw.includeDirectCommits
        : DEFAULT_FETCH_PREFERENCES.includeDirectCommits,
    includePrWithoutCommitsInRange:
      typeof raw.includePrWithoutCommitsInRange === 'boolean'
        ? raw.includePrWithoutCommitsInRange
        : DEFAULT_FETCH_PREFERENCES.includePrWithoutCommitsInRange,
    compactCommits:
      typeof raw.compactCommits === 'boolean'
        ? raw.compactCommits
        : DEFAULT_FETCH_PREFERENCES.compactCommits,
  };
}
