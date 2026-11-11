import { User, GitStatus, PrActivity, ReportItem, AiEngine } from "../types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:6101/api/v1";

async function fetchJson<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => ({}))) as {
      message?: string | string[];
    };
    const errorMsg = Array.isArray(errorBody.message)
      ? errorBody.message.join(", ")
      : errorBody.message || `Request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }

  return (await res.json()) as T;
}

export const api = {
  auth: {
    me: () => fetchJson<{ user: User }>("/auth/me"),
    login: (username: string, password?: string) =>
      fetchJson<{ message: string; user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password, devBypass: !password }),
      }),
    register: (username: string, email: string, password: string) =>
      fetchJson<{ message: string; user: User }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, email, password }),
      }),
    forgotPassword: (email: string) =>
      fetchJson<{ success: boolean; message: string }>(
        "/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({ email }),
        },
      ),
    googleLogin: (dto: {
      email?: string;
      name?: string;
      credential?: string;
      googleId?: string;
    }) =>
      fetchJson<{ user: User }>("/auth/google", {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    ssoCallback: (code: string, codeVerifier: string) =>
      fetchJson<{ message: string; user: User }>("/auth/sso/callback", {
        method: "POST",
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
      >("/auth/dev/users"),
    logout: () =>
      fetchJson<{ success: boolean }>("/auth/logout", { method: "POST" }),
  },
  github: {
    getStatus: () => fetchJson<GitStatus>("/github/status"),
    savePat: (token: string) =>
      fetchJson<{
        success: boolean;
        username: string;
        avatarUrl: string;
        authType: string;
      }>("/github/pat", {
        method: "POST",
        body: JSON.stringify({ token }),
      }),
    disconnect: () =>
      fetchJson<{ success: boolean }>("/github/disconnect", {
        method: "DELETE",
      }),
    getActivity: (since?: string) => {
      const q = since ? `?since=${encodeURIComponent(since)}` : "";
      return fetchJson<PrActivity[]>(`/github/activity${q}`);
    },
  },
  ai: {
    summarizeWithGitHubModels: (dto: {
      prs: Array<{ repo: string; title: string; commits: string[] }>;
      model?: string;
      language?: string;
      tone?: string;
      customPrompt?: string;
    }) =>
      fetchJson<{
        bullets: string[];
        rawText: string;
        modelUsed: string;
        engine: string;
      }>("/ai/summarize", {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    saveClientSummary: (body: {
      summary: string[];
      modelName: string;
      prCount: number;
      commitCount: number;
      engine: AiEngine;
      metadata?: Record<string, unknown>;
    }) =>
      fetchJson<ReportItem>("/ai/save-client-summary", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },
  reports: {
    list: () => fetchJson<ReportItem[]>("/reports"),
    delete: (id: string) =>
      fetchJson<{ success: boolean }>(`/reports/${id}`, { method: "DELETE" }),
  },
};
