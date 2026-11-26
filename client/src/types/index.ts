export interface User {
  id: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  role: string;
}

export interface GitAccountSummary {
  id: string;
  gitUsername: string;
  gitAvatar?: string | null;
  authType?: 'OAUTH' | 'PAT';
  scopes?: string[];
  hasExcessiveScopes?: boolean;
  tokenStatus?: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'NEEDS_REAUTH';
  expiresAt?: string | null;
  lastSyncAt?: string | null;
  isActive: boolean;
}

export interface GitStatus {
  connected: boolean;
  activeAccountId?: string;
  gitUsername?: string;
  gitAvatar?: string;
  authType?: 'OAUTH' | 'PAT';
  scopes?: string[];
  hasExcessiveScopes?: boolean;
  tokenStatus?: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'NEEDS_REAUTH';
  expiresAt?: string | null;
  lastSyncAt?: string;
  accounts?: GitAccountSummary[];
}

export type PrState = 'draft' | 'open' | 'merged' | 'closed' | 'direct_commits';
export type RepoOwnerType = 'personal' | 'organization';
export type ActivityType = 'pr' | 'direct_commits';

export interface PrLabelItem {
  name: string;
  color?: string;
}

export interface CommitItem {
  sha: string;
  message: string;
  date: string;
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

export interface UserSettingsResponse {
  language: string;
  autoCopyToClipboard: boolean;
  customPrompt?: string;
  fetchPreferences: FetchPreferences;
}

export type TaskColor = 'sky' | 'indigo' | 'emerald' | 'amber' | 'rose';

export interface TrackingTaskItem {
  id: string;
  taskId: string;
  repo: string;
  prNumber: number;
  title: string;
  prUrl: string;
  state: string;
  ownerType: string;
  addedAt: string;
}

export interface TrackingTask {
  id: string;
  title: string;
  color: TaskColor;
  isCompleted: boolean;
  completedAt: string | null;
  items: TrackingTaskItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ReportItem {
  id: string;
  summaryText: string;
  prCount: number;
  commitCount: number;
  aiEngineUsed: 'GITHUB_MODELS' | 'GOOGLE_GEMINI' | 'GROQ' | 'WEB_LLM' | 'MCP_AGENT';
  modelName: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  createdAt: string;
}

export type McpScope =
  | 'read:activity'
  | 'write:activity'
  | 'read:tasks'
  | 'write:tasks'
  | 'ai:summarize'
  | 'read:reports'
  | 'write:reports'
  | 'read:settings'
  | 'write:settings'
  | 'write:parabol';

export interface McpKeySummary {
  id: string;
  label: string;
  maskedPrefix: string;
  scopes: McpScope[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreateMcpKeyResponse {
  key: McpKeySummary;
  token: string;
}

export type AiEngine = 'GITHUB_MODELS' | 'GOOGLE_GEMINI' | 'GROQ';
export type AiProviderType = 'GOOGLE_GEMINI' | 'GROQ';

export interface AiModelOption {
  id: string;
  label: string;
  description?: string;
}

export interface AiConnectionSummary {
  id: string;
  provider: AiProviderType;
  label: string;
  maskedKey: string;
  availableModels: AiModelOption[];
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'NEEDS_REAUTH';
  expiresAt?: string | null;
  lastVerifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AiAvailabilityStatus = 'idle' | 'checking' | 'available' | 'unavailable';

export interface AiAvailabilityState {
  status: AiAvailabilityStatus;
  available: boolean;
  latencyMs?: number;
  reasonCode?: string;
  reason?: string;
}

export interface ParabolConnectionSummary {
  id: string;
  label: string;
  parabolUserId: string;
  parabolName: string | null;
  parabolEmail: string | null;
  maskedPrefix: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'NEEDS_REAUTH';
  isActive: boolean;
  expiresAt?: string | null;
  lastVerifiedAt?: string | null;
  lastUsedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ParabolPromptOption {
  id: string;
  question: string;
  description: string;
  sortOrder: string;
}

export interface ParabolExistingResponseSummary {
  id: string;
  promptId: string;
  sharedAt: string | null;
}

export interface ParabolStandupMeeting {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  createdAt: string;
  prompts: ParabolPromptOption[];
  viewerResponses: ParabolExistingResponseSummary[];
}

export interface ParabolStandupsResponse {
  connected: boolean;
  connection: ParabolConnectionSummary | null;
  meetings: ParabolStandupMeeting[];
}

export interface SubmitParabolStandupResponse {
  success: boolean;
  responseId: string;
  meetingId: string;
  meetingName: string;
  meetingUrl: string;
  promptId: string;
  shared: boolean;
  sharedAt: string | null;
}
