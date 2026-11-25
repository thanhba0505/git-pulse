import {
  AiConnectionSummary,
  AiEngine,
  AiModelOption,
  AiProviderType,
  FetchPreferences,
  GitHubWorkspacesResponse,
  GitStatus,
  ParabolConnectionSummary,
  ParabolStandupsResponse,
  PrActivity,
  ReportItem,
  SubmitParabolStandupResponse,
  TaskColor,
  TrackingTask,
  User,
  UserSettingsResponse,
} from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6101/api/v1';

const TOKEN_STORAGE_KEY = 'git_pulse_token';

let memoryToken: string | null = null;

export function getStoredToken(): string | null {
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY) || memoryToken;
    } catch {
      return memoryToken;
    }
  }
  return memoryToken;
}

export function setStoredToken(token: string | null): void {
  memoryToken = token;
  if (typeof window !== 'undefined') {
    try {
      if (token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    } catch {
      // Ignore storage quota errors
    }
  }
}

async function fetchJson<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token && !headers['Authorization'] && !headers['authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (!res.ok) {
    if (res.status === 401 && endpoint === '/auth/me') {
      setStoredToken(null);
    }
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
    login: async (username: string, password?: string) => {
      const res = await fetchJson<{ message: string; user: User; token?: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password, devBypass: !password }),
      });
      if (res.token) {
        setStoredToken(res.token);
      }
      return res;
    },
    register: async (username: string, email: string, password: string) => {
      const res = await fetchJson<{ message: string; user: User; token?: string }>(
        '/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({ username, email, password }),
        },
      );
      if (res.token) {
        setStoredToken(res.token);
      }
      return res;
    },
    forgotPassword: (email: string) =>
      fetchJson<{ success: boolean; message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    googleLogin: async (dto: {
      email?: string;
      name?: string;
      credential?: string;
      googleId?: string;
    }) => {
      const res = await fetchJson<{ message?: string; user: User; token?: string }>(
        '/auth/google',
        {
          method: 'POST',
          body: JSON.stringify(dto),
        },
      );
      if (res.token) {
        setStoredToken(res.token);
      }
      return res;
    },
    ssoCallback: async (code: string, codeVerifier: string) => {
      const res = await fetchJson<{ message: string; user: User; token?: string }>(
        '/auth/sso/callback',
        {
          method: 'POST',
          body: JSON.stringify({ code, code_verifier: codeVerifier }),
        },
      );
      if (res.token) {
        setStoredToken(res.token);
      }
      return res;
    },
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
    logout: async () => {
      try {
        return await fetchJson<{ success: boolean }>('/auth/logout', { method: 'POST' });
      } finally {
        setStoredToken(null);
      }
    },
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
      customPrompt?: string;
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
    previewModels: (dto: { provider: AiProviderType; apiKey: string }) =>
      fetchJson<{
        valid: boolean;
        maskedKey: string;
        suggestedLabel: string;
        expiresAt: string | null;
        models: AiModelOption[];
      }>('/ai/preview-models', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    refreshConnectionModels: (id: string) =>
      fetchJson<AiConnectionSummary>(`/ai/connections/${encodeURIComponent(id)}/refresh-models`, {
        method: 'POST',
      }),
    createConnection: (dto: {
      provider: AiProviderType;
      apiKey: string;
      label?: string;
      expiresAt?: string | null;
    }) =>
      fetchJson<AiConnectionSummary>('/ai/connections', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    updateConnection: (
      id: string,
      dto: {
        provider: AiProviderType;
        apiKey: string;
        label?: string;
        expiresAt?: string | null;
      },
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
        availableModels?: AiModelOption[];
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
  parabol: {
    listConnections: () => fetchJson<ParabolConnectionSummary[]>('/parabol/connections'),
    verifyToken: (token: string) =>
      fetchJson<{
        valid: boolean;
        suggestedLabel: string;
        name: string | null;
        email: string | null;
        maskedPrefix: string;
        expiresAt: string | null;
        teams: Array<{ id: string; name: string }>;
      }>('/parabol/verify-token', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
    saveConnection: (dto: { token: string; label?: string }) =>
      fetchJson<ParabolConnectionSummary>('/parabol/connections', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    switchActiveConnection: (id: string) =>
      fetchJson<ParabolConnectionSummary[]>(
        `/parabol/connections/${encodeURIComponent(id)}/active`,
        {
          method: 'PATCH',
        },
      ),
    deleteConnection: (id: string) =>
      fetchJson<{ success: boolean }>(`/parabol/connections/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
    listStandups: (options?: { connectionId?: string; meetingUrl?: string; refresh?: boolean }) => {
      const params = new URLSearchParams();
      if (options?.connectionId) params.set('connectionId', options.connectionId);
      if (options?.meetingUrl) params.set('meetingUrl', options.meetingUrl);
      if (options?.refresh) params.set('refresh', 'true');
      const q = params.toString();
      return fetchJson<ParabolStandupsResponse>(`/parabol/standups${q ? `?${q}` : ''}`);
    },
    submitStandup: (dto: {
      connectionId?: string;
      meetingId: string;
      promptId: string;
      bullets: string[];
      shareImmediately?: boolean;
      includeTodayHeader?: boolean;
    }) =>
      fetchJson<SubmitParabolStandupResponse>('/parabol/standups/submit', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
  },
};
