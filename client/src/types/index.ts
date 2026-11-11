export interface User {
  id: string;
  gatewayUserId: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  role: string;
}

export interface GitStatus {
  connected: boolean;
  gitUsername?: string;
  gitAvatar?: string;
  authType?: "OAUTH" | "PAT";
  scopes?: string[];
  lastSyncAt?: string;
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

export interface ReportItem {
  id: string;
  summaryText: string;
  prCount: number;
  commitCount: number;
  aiEngineUsed: "GITHUB_MODELS" | "WEB_LLM";
  modelName: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  createdAt: string;
}

export type AiEngine = "GITHUB_MODELS" | "WEB_LLM";
