import {
  AiConnectionSummary,
  AiEngine,
  AiProviderType,
  FetchPreferences,
  GitHubWorkspacesResponse,
  GitStatus,
  PrActivity,
  ReportItem,
  TaskColor,
  TrackingTask,
  User,
  UserSettingsResponse,
} from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6101/api/v1';

async function fetchJson<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => ({}))) as {
      message?: string | string[];
    };
    const errorMsg = Array.isArray(errorBody.message)
      ? errorBody.message.join(', ')
      : errorBody.message || `Request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }

  return (await res.json()) as T;
}

export const api = {
  auth: {
    me: () => fetchJson<{ user: User }>('/auth/me'),
    login: (username: string, password?: string) =>
      fetchJson<{ message: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password, devBypass: !password }),
      }),
    register: (username: string, email: string, password: string) =>
      fetchJson<{ message: string; user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
      }),
    forgotPassword: (email: string) =>
      fetchJson<{ success: boolean; message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    googleLogin: (dto: { email?: string; name?: string; credential?: string; googleId?: string }) =>
      fetchJson<{ user: User }>('/auth/google', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    ssoCallback: (code: string, codeVerifier: string) =>
      fetchJson<{ message: string; user: User }>('/auth/sso/callback', {
        method: 'POST',
        body: JSON.stringify({ code, code_verifier: codeVerifier }),
      }),
    getDevUsers: () =>
      fetchJson<
        Array<{
          id: string;
          username: string;
          email: string | null;
          role: string;
          avatarUrl?: string | null;
        }>
      >('/auth/dev/users'),
    logout: () => fetchJson<{ success: boolean }>('/auth/logout', { method: 'POST' }),
  },
  github: {
    getStatus: () => fetchJson<GitStatus>('/github/status'),
    savePat: (token: string) =>
      fetchJson<{
        success: boolean;
        id?: string;
        username: string;
        avatarUrl: string;
        authType: string;
      }>('/github/pat', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
    switchAccount: (accountId: string) =>
      fetchJson<GitStatus>(`/github/accounts/${encodeURIComponent(accountId)}/active`, {
        method: 'PATCH',
      }),
    disconnect: (accountId?: string) =>
      fetchJson<GitStatus>(
        accountId ? `/github/accounts/${encodeURIComponent(accountId)}` : '/github/disconnect',
        {
          method: 'DELETE',
        },
      ),
    getWorkspaces: () => fetchJson<GitHubWorkspacesResponse>('/github/workspaces'),
    getActivity: (since?: string) => {
      const q = since ? `?since=${encodeURIComponent(since)}` : '';
      return fetchJson<PrActivity[]>(`/github/activity${q}`);
    },
  },
  settings: {
    get: () => fetchJson<UserSettingsResponse>('/settings'),
    update: (dto: {
      language?: 'vi' | 'en';
      autoCopyToClipboard?: boolean;
      fetchPreferences?: Partial<FetchPreferences>;
    }) =>
      fetchJson<UserSettingsResponse>('/settings', {
        method: 'PATCH',
        body: JSON.stringify(dto),
      }),
  },
  tasks: {
    list: () => fetchJson<TrackingTask[]>('/tasks'),
    create: (dto: {
      title: string;
      color?: TaskColor;
      items?: Array<{
        repo: string;
        prNumber: number;
        title: string;
        prUrl: string;
        state?: string;
        ownerType?: string;
      }>;
    }) =>
      fetchJson<TrackingTask>('/tasks', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    update: (id: string, dto: { title?: string; color?: TaskColor; isCompleted?: boolean }) =>
      fetchJson<TrackingTask>(`/tasks/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(dto),
      }),
    delete: (id: string) =>
      fetchJson<{ success: boolean }>(`/tasks/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
    addItems: (
      id: string,
      items: Array<{
        repo: string;
        prNumber: number;
        title: string;
        prUrl: string;
        state?: string;
        ownerType?: string;
      }>,
    ) =>
      fetchJson<TrackingTask>(`/tasks/${encodeURIComponent(id)}/items`, {
        method: 'POST',
        body: JSON.stringify({ items }),
      }),
    removeItem: (id: string, repo: string, prNumber: number) =>
      fetchJson<TrackingTask>(
        `/tasks/${encodeURIComponent(id)}/items?repo=${encodeURIComponent(repo)}&prNumber=${prNumber}`,
        {
          method: 'DELETE',
        },
      ),
  },
  ai: {
    listConnections: () => fetchJson<AiConnectionSummary[]>('/ai/connections'),
    createConnection: (dto: { provider: AiProviderType; apiKey: string; label?: string }) =>
      fetchJson<AiConnectionSummary>('/ai/connections', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    updateConnection: (
      id: string,
      dto: { provider: AiProviderType; apiKey: string; label?: string },
    ) =>
      fetchJson<AiConnectionSummary>(`/ai/connections/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(dto),
      }),
    deleteConnection: (id: string) =>
      fetchJson<{ success: boolean }>(`/ai/connections/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
    checkAvailability: (dto: { engine: AiEngine; connectionId?: string; model: string }) =>
      fetchJson<{
        available: boolean;
        engine: AiEngine;
        model: string;
        latencyMs: number;
        reasonCode?: string;
        reason?: string;
      }>('/ai/check-availability', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    summarize: (dto: {
      prs: Array<{ repo: string; title: string; commits: string[] }>;
      engine: AiEngine;
      connectionId?: string;
      model?: string;
      language?: string;
      tone?: string;
      customPrompt?: string;
    }) =>
      fetchJson<{
        bullets: string[];
        rawText: string;
        modelUsed: string;
        engine: AiEngine;
      }>('/ai/summarize', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
  },
  reports: {
    list: () => fetchJson<ReportItem[]>('/reports'),
    delete: (id: string) => fetchJson<{ success: boolean }>(`/reports/${id}`, { method: 'DELETE' }),
  },
};
