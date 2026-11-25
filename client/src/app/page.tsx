'use client';

import React, { startTransition, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  AiAvailabilityState,
  AiConnectionSummary,
  AiEngine,
  AiModelOption,
  FetchPreferences,
  GitHubWorkspacesResponse,
  GitStatus,
  GroupingMode,
  ParabolConnectionSummary,
  PrActivity,
  TaskColor,
  TrackingTask,
} from '../types';
import { DEFAULT_AI_PROMPT } from '../lib/ai-prompt.constants';
import { api } from '../lib/api';
import { toTaskItemInput } from '../lib/activity-utils';
import { useAuth } from '../lib/auth-context';
import { useTranslation } from '../i18n';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { IntroScreen } from '../components/layout/IntroScreen';
import { ActivitySummaryStrip } from '../components/dashboard/ActivitySummaryStrip';
import { ActivityScanner, getPrKey } from '../components/dashboard/ActivityScanner';
import { BUILTIN_GITHUB_TOOL_KEY, CockpitAiConsole } from '../components/ai/CockpitAiConsole';
import { StandupOutputDock } from '../components/standup/StandupOutputDock';
import { AuthModal } from '../components/auth/AuthModal';
import type { SettingsSectionAnchor, SettingsTabKey } from '../components/settings/SettingsModal';
import { WorkspaceSkeleton } from '../components/ui/Skeleton';
import { ShowcaseCard } from '../components/ui/ShowcaseCard';
import { useToast } from '../components/ui/Toast';
import { useAmbientMotionPreference } from '../lib/motion-preference';
import { CheckCircle2, GitBranch, Pause, RefreshCw, Sparkles } from 'lucide-react';

// Lazy-load secondary modal overlays to keep initial page JS lean
const GitHubConnectModal = dynamic(
  () => import('../components/github/GitHubConnectBanner').then((m) => m.GitHubConnectModal),
  { ssr: false },
);

const AiConnectModal = dynamic(
  () => import('../components/ai/AiConnectModal').then((m) => m.AiConnectModal),
  { ssr: false },
);

const ReportHistoryModal = dynamic(
  () => import('../components/history/ReportHistoryModal').then((m) => m.ReportHistoryModal),
  { ssr: false },
);

const GoogleAccountChooserModal = dynamic(
  () =>
    import('../components/auth/GoogleAccountChooserModal').then((m) => m.GoogleAccountChooserModal),
  { ssr: false },
);

const CommandPalette = dynamic(
  () => import('../components/ui/CommandPalette').then((m) => m.CommandPalette),
  { ssr: false },
);

const SettingsModal = dynamic(
  () => import('../components/settings/SettingsModal').then((m) => m.SettingsModal),
  { ssr: false },
);

const CommitSelectionModal = dynamic(
  () => import('../components/ai/CommitSelectionModal').then((m) => m.CommitSelectionModal),
  { ssr: false },
);

const ParabolSubmitModal = dynamic(
  () => import('../components/parabol/ParabolSubmitModal').then((m) => m.ParabolSubmitModal),
  { ssr: false },
);

const ReportPlatformConnectModal = dynamic(
  () =>
    import('../components/standup/ReportPlatformConnectModal').then(
      (m) => m.ReportPlatformConnectModal,
    ),
  { ssr: false },
);
import type { SelectableCommit } from '../components/ai/CommitSelectionModal';

const ACTIVITY_CACHE_TTL_MS = 10 * 60 * 1000;

const DEFAULT_FETCH_PREFERENCES: FetchPreferences = {
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

interface CachedActivityPayload {
  timestamp: number;
  activities: PrActivity[];
}

const memoryActivityCache = new Map<string, CachedActivityPayload>();

function getCacheKey(
  userId: string,
  accountKey: string,
  sinceOption: 'today' | '24h' | '7d',
): string {
  return `git_pulse_activity_cache:${userId}:${accountKey}:${sinceOption}`;
}

function readCachedActivities(
  userId: string,
  accountKey: string,
  sinceOption: 'today' | '24h' | '7d',
): PrActivity[] | null {
  const key = getCacheKey(userId, accountKey, sinceOption);
  const mem = memoryActivityCache.get(key);
  if (mem) {
    if (Date.now() - mem.timestamp <= ACTIVITY_CACHE_TTL_MS) {
      return mem.activities;
    }
    memoryActivityCache.delete(key);
  }

  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedActivityPayload;
    if (!parsed || !Array.isArray(parsed.activities)) return null;
    if (Date.now() - parsed.timestamp > ACTIVITY_CACHE_TTL_MS) return null;
    memoryActivityCache.set(key, parsed);
    return parsed.activities;
  } catch {
    return null;
  }
}

function writeCachedActivities(
  userId: string,
  accountKey: string,
  sinceOption: 'today' | '24h' | '7d',
  activities: PrActivity[],
): void {
  const key = getCacheKey(userId, accountKey, sinceOption);
  const payload: CachedActivityPayload = {
    timestamp: Date.now(),
    activities,
  };
  memoryActivityCache.set(key, payload);

  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

function clearAllActivityCache(): void {
  memoryActivityCache.clear();
  if (typeof window === 'undefined') return;
  try {
    for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith('git_pulse_activity_cache:')) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage errors
  }
}

export default function HomePage() {
  const { locale, setLocale, dict, t } = useTranslation();
  const { showToast } = useToast();
  const {
    user,
    isLoading: isAuthLoading,
    isGoogleChooserOpen,
    openGoogleChooser,
    closeGoogleChooser,
    loginWithGoogle,
    logout,
  } = useAuth();

  const [isIntroComplete, setIsIntroComplete] = useState(false);
  const [gitStatus, setGitStatus] = useState<GitStatus>({ connected: false, accounts: [] });
  const [gitModalMode, setGitModalMode] = useState<'connect' | 'add' | 'manage'>('connect');
  const [isGitModalOpen, setIsGitModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsModalTab, setSettingsModalTab] = useState<SettingsTabKey>('general');
  const [settingsModalSection, setSettingsModalSection] = useState<SettingsSectionAnchor | null>(
    null,
  );
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  const [fetchPrefs, setFetchPrefs] = useState<FetchPreferences>(DEFAULT_FETCH_PREFERENCES);
  const [groupBy, setGroupBy] = useState<GroupingMode>('owner');
  const [workspaces, setWorkspaces] = useState<GitHubWorkspacesResponse | null>(null);
  const [tasks, setTasks] = useState<TrackingTask[]>([]);

  const [activities, setActivities] = useState<PrActivity[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [sinceOption, setSinceOption] = useState<'today' | '24h' | '7d'>('today');
  const [repoFilter, setRepoFilter] = useState<string>('ALL');

  const [aiConnections, setAiConnections] = useState<AiConnectionSummary[]>([]);
  const aiConnectionsRef = useRef<AiConnectionSummary[]>(aiConnections);
  aiConnectionsRef.current = aiConnections;
  const [githubModels, setGithubModels] = useState<AiModelOption[]>([]);
  const [selectedToolKey, setSelectedToolKey] = useState<string>(BUILTIN_GITHUB_TOOL_KEY);
  const [selectedModel, setSelectedModel] = useState<string>('openai/gpt-4o-mini');
  const [customPrompt, setCustomPrompt] = useState('');
  const [availability, setAvailability] = useState<AiAvailabilityState>({
    status: 'idle',
    available: false,
  });
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [editingAiConnection, setEditingAiConnection] = useState<AiConnectionSummary | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [bullets, setBullets] = useState<string[]>([]);
  const [parabolConnections, setParabolConnections] = useState<ParabolConnectionSummary[]>([]);
  const [isParabolModalOpen, setIsParabolModalOpen] = useState(false);
  const [isReportConnectModalOpen, setIsReportConnectModalOpen] = useState(false);
  const [parabolEnabled, setParabolEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = window.localStorage.getItem('gitpulse:report_platform:parabol:enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const availabilityCheckIdRef = useRef(0);

  // Persistent Commit Filter state (Personal / Organization)
  const [includePersonalCommits, setIncludePersonalCommits] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const val = localStorage.getItem('gitpulse:commit_filter:personal');
      return val !== null ? val === 'true' : true;
    } catch {
      return true;
    }
  });

  const [includeOrgCommits, setIncludeOrgCommits] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const val = localStorage.getItem('gitpulse:commit_filter:org');
      return val !== null ? val === 'true' : true;
    } catch {
      return true;
    }
  });

  const [selectedCommitIds, setSelectedCommitIds] = useState<Set<string>>(() => new Set());
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);

  // Derive individual selectable commits from current activities
  const allSelectableCommits = useMemo<SelectableCommit[]>(() => {
    const list: SelectableCommit[] = [];
    for (const act of activities) {
      const prKey = getPrKey(act);
      act.commits.forEach((msg, idx) => {
        const trimmed = msg.trim();
        if (!trimmed) return;
        list.push({
          id: `${prKey}::${idx}`,
          prKey,
          repo: act.repo,
          prNumber: act.number,
          prTitle: act.title,
          prUrl: act.prUrl,
          ownerType: act.ownerType,
          owner: act.owner,
          message: trimmed,
        });
      });
    }
    return list;
  }, [activities]);

  const selectedCommitCount = selectedCommitIds.size;

  const selectedPrCount = useMemo(() => {
    const prKeys = new Set<string>();
    for (const id of selectedCommitIds) {
      const idx = id.lastIndexOf('::');
      if (idx !== -1) prKeys.add(id.slice(0, idx));
    }
    return prKeys.size;
  }, [selectedCommitIds]);

  const applyScannedActivities = useCallback(
    (nextActivities: PrActivity[]) => {
      setActivities(nextActivities);
      setRepoFilter('ALL');

      const initialSelected = new Set<string>();
      for (const act of nextActivities) {
        const isPersonal = act.ownerType === 'personal';
        const shouldSelect = isPersonal ? includePersonalCommits : includeOrgCommits;
        if (shouldSelect) {
          const prKey = getPrKey(act);
          act.commits.forEach((msg, idx) => {
            if (msg.trim()) {
              initialSelected.add(`${prKey}::${idx}`);
            }
          });
        }
      }
      setSelectedCommitIds(initialSelected);
    },
    [includePersonalCommits, includeOrgCommits],
  );

  // Initialize commit selection on first activity load if set is empty
  const hasInitializedCommitsRef = useRef(false);
  useEffect(() => {
    if (activities.length > 0 && !hasInitializedCommitsRef.current) {
      hasInitializedCommitsRef.current = true;
      const initialSelected = new Set<string>();
      for (const act of activities) {
        const isPersonal = act.ownerType === 'personal';
        const shouldSelect = isPersonal ? includePersonalCommits : includeOrgCommits;
        if (shouldSelect) {
          const prKey = getPrKey(act);
          act.commits.forEach((msg, idx) => {
            if (msg.trim()) {
              initialSelected.add(`${prKey}::${idx}`);
            }
          });
        }
      }
      setSelectedCommitIds(initialSelected);
    }
  }, [activities, includePersonalCommits, includeOrgCommits]);

  const handleTogglePersonalCommits = useCallback(
    (checked: boolean) => {
      setIncludePersonalCommits(checked);
      try {
        localStorage.setItem('gitpulse:commit_filter:personal', String(checked));
      } catch {
        // ignore
      }
      setSelectedCommitIds((prev) => {
        const next = new Set(prev);
        for (const c of allSelectableCommits) {
          if (c.ownerType === 'personal') {
            if (checked) next.add(c.id);
            else next.delete(c.id);
          }
        }
        return next;
      });
    },
    [allSelectableCommits],
  );

  const handleToggleOrgCommits = useCallback(
    (checked: boolean) => {
      setIncludeOrgCommits(checked);
      try {
        localStorage.setItem('gitpulse:commit_filter:org', String(checked));
      } catch {
        // ignore
      }
      setSelectedCommitIds((prev) => {
        const next = new Set(prev);
        for (const c of allSelectableCommits) {
          if (c.ownerType === 'organization') {
            if (checked) next.add(c.id);
            else next.delete(c.id);
          }
        }
        return next;
      });
    },
    [allSelectableCommits],
  );

  const handleToggleCommit = useCallback((commitId: string) => {
    setAiError(null);
    setSelectedCommitIds((prev) => {
      const next = new Set(prev);
      if (next.has(commitId)) next.delete(commitId);
      else next.add(commitId);
      return next;
    });
  }, []);

  const handleSelectAllCommits = useCallback(() => {
    setSelectedCommitIds(new Set(allSelectableCommits.map((c) => c.id)));
  }, [allSelectableCommits]);

  const handleDeselectAllCommits = useCallback(() => {
    setSelectedCommitIds(new Set());
  }, []);

  const gitStatusRef = useRef<GitStatus>(gitStatus);
  const isScanningRef = useRef(false);
  useEffect(() => {
    gitStatusRef.current = gitStatus;
  }, [gitStatus]);

  const loadGitStatus = useCallback(async () => {
    try {
      const status = await api.github.getStatus();
      setGitStatus(status);
      return status;
    } catch {
      const empty: GitStatus = { connected: false, accounts: [] };
      setGitStatus(empty);
      return empty;
    }
  }, []);

  const loadWorkspaces = useCallback(async () => {
    try {
      const ws = await api.github.getWorkspaces();
      setWorkspaces(ws);
      return ws;
    } catch {
      setWorkspaces(null);
      return null;
    }
  }, []);

  const handleScanActivity = useCallback(
    async (
      overrideRange?: 'today' | '24h' | '7d',
      notifyToast = true,
      statusOverride?: GitStatus,
      forceRefresh = false,
    ) => {
      if (isScanningRef.current) return;

      const activeStatus = statusOverride ?? gitStatusRef.current;
      const accountKey = activeStatus.activeAccountId || activeStatus.gitUsername || 'default';
      const targetRange = overrideRange ?? sinceOption;
      if (overrideRange && overrideRange !== sinceOption) {
        setSinceOption(overrideRange);
      }

      if (!forceRefresh && user) {
        const cached = readCachedActivities(user.id, accountKey, targetRange);
        if (cached) {
          startTransition(() => {
            applyScannedActivities(cached);
          });
          return;
        }
      }

      if (forceRefresh) {
        clearAllActivityCache();
      }

      isScanningRef.current = true;
      setIsScanning(true);
      setScanError(null);
      try {
        let sinceDate: string | undefined;
        const now = new Date();
        if (targetRange === 'today') {
          const today = new Date(now);
          today.setHours(0, 0, 0, 0);
          sinceDate = today.toISOString();
        } else if (targetRange === '24h') {
          const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          sinceDate = past.toISOString();
        } else if (targetRange === '7d') {
          const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          sinceDate = past.toISOString();
        }

        const data = await api.github.getActivity(sinceDate);
        startTransition(() => {
          applyScannedActivities(data);
        });

        if (user) {
          writeCachedActivities(user.id, accountKey, targetRange, data);
        }

        if (notifyToast) {
          const commitSum = data.reduce((sum, item) => sum + item.commits.length, 0);
          showToast({
            title: t('toasts.syncSuccess', { prs: data.length, commits: commitSum }),
            variant: 'info',
          });
        }
      } catch (err) {
        setScanError((err as Error).message || dict.scanner.scanError);
      } finally {
        isScanningRef.current = false;
        setIsScanning(false);
      }
    },
    [sinceOption, user, applyScannedActivities, dict.scanner.scanError, showToast, t],
  );

  const scanRef = useRef(handleScanActivity);
  useEffect(() => {
    scanRef.current = handleScanActivity;
  }, [handleScanActivity]);

  const resolveDefaultModelForTool = useCallback(
    (
      toolKey: string,
      conns: readonly AiConnectionSummary[],
      ghModels: readonly AiModelOption[] = [],
    ): string => {
      if (toolKey.startsWith('conn:')) {
        const targetId = toolKey.slice(5);
        const conn = conns.find((c) => c.id === targetId);
        return (
          conn?.availableModels[0]?.id ||
          (conn?.provider === 'GROQ' ? 'llama-3.3-70b-versatile' : 'gemini-2.5-flash')
        );
      }
      return ghModels[0]?.id || 'openai/gpt-4o-mini';
    },
    [],
  );

  const persistAiSelection = useCallback(
    (uid: string | undefined, toolKey: string, model: string) => {
      if (!uid || typeof window === 'undefined') return;
      try {
        window.localStorage.setItem(
          `git_pulse_ai_selection:${uid}`,
          JSON.stringify({ toolKey, model }),
        );
      } catch {
        // Ignore storage quota errors
      }
    },
    [],
  );

  const checkModelAvailability = useCallback(
    async (
      toolKey: string,
      model: string,
      allowModelAutoFallback = true,
    ): Promise<{ availableModels?: AiModelOption[] } | null> => {
      const checkId = ++availabilityCheckIdRef.current;
      setAvailability({ status: 'checking', available: false });

      const isConn = toolKey.startsWith('conn:');
      const connectionId = isConn ? toolKey.slice(5) : undefined;
      const activeConn = connectionId
        ? aiConnectionsRef.current.find((c) => c.id === connectionId)
        : undefined;
      const engine: AiEngine = activeConn ? activeConn.provider : isConn ? 'GROQ' : 'GITHUB_MODELS';

      try {
        const res = await api.ai.checkAvailability({ engine, connectionId, model });
        if (checkId !== availabilityCheckIdRef.current) return null;

        if (engine === 'GITHUB_MODELS' && res.availableModels && res.availableModels.length > 0) {
          setGithubModels(res.availableModels);
          const hasModel = res.availableModels.some((m) => m.id === model);
          if (!hasModel && allowModelAutoFallback) {
            const fallbackModel = res.availableModels[0].id;
            setSelectedModel(fallbackModel);
            persistAiSelection(user?.id, toolKey, fallbackModel);
            return checkModelAvailability(toolKey, fallbackModel, false);
          }
        }

        setAvailability({
          status: res.available ? 'available' : 'unavailable',
          available: res.available,
          latencyMs: res.latencyMs,
          reasonCode: res.reasonCode,
          reason: res.reason,
        });

        if (connectionId) {
          if (res.reasonCode === 'INVALID_KEY') {
            setAiConnections((prev) =>
              prev.map((c) => (c.id === connectionId ? { ...c, status: 'REVOKED' } : c)),
            );
          } else if (res.available) {
            setAiConnections((prev) =>
              prev.map((c) => (c.id === connectionId ? { ...c, status: 'ACTIVE' } : c)),
            );
          }
        }

        return { availableModels: res.availableModels };
      } catch (err) {
        if (checkId !== availabilityCheckIdRef.current) return null;
        setAvailability({
          status: 'unavailable',
          available: false,
          reason: (err as Error).message || dict.aiConsole.generateFailed,
        });
        return null;
      }
    },
    [dict.aiConsole.generateFailed, persistAiSelection, user?.id],
  );

  const userId = user?.id;
  useEffect(() => {
    if (!userId) {
      setGitStatus({ connected: false, accounts: [] });
      setWorkspaces(null);
      setTasks([]);
      setAiConnections([]);
      setParabolConnections([]);
      setGithubModels([]);
      setAvailability({ status: 'idle', available: false });
      setCustomPrompt('');
      setIsSettingsModalOpen(false);
      setIsParabolModalOpen(false);
      setIsReportConnectModalOpen(false);
      return;
    }

    Promise.all([
      loadGitStatus(),
      api.settings.get().catch(() => null),
      api.tasks.list().catch(() => [] as TrackingTask[]),
      api.ai.listConnections().catch(() => [] as AiConnectionSummary[]),
      api.parabol.listConnections().catch(() => [] as ParabolConnectionSummary[]),
    ]).then(([status, settingsRes, loadedTasks, loadedConns, loadedParabolConns]) => {
      let targetRange: 'today' | '24h' | '7d' = 'today';
      if (settingsRes?.fetchPreferences) {
        setFetchPrefs(settingsRes.fetchPreferences);
        setGroupBy(settingsRes.fetchPreferences.defaultGroupBy);
        setSinceOption(settingsRes.fetchPreferences.defaultTimeRange);
        targetRange = settingsRes.fetchPreferences.defaultTimeRange;
      }
      if (settingsRes) {
        setCustomPrompt(settingsRes.customPrompt ?? '');
      }
      setTasks(loadedTasks);
      setAiConnections(loadedConns);
      setParabolConnections(loadedParabolConns);

      let initialToolKey = BUILTIN_GITHUB_TOOL_KEY;
      let initialModel = 'openai/gpt-4o-mini';

      if (typeof window !== 'undefined') {
        try {
          const rawSaved = window.localStorage.getItem(`git_pulse_ai_selection:${userId}`);
          if (rawSaved) {
            const parsed = JSON.parse(rawSaved) as { toolKey?: string; model?: string };
            if (parsed.toolKey === BUILTIN_GITHUB_TOOL_KEY) {
              initialToolKey = BUILTIN_GITHUB_TOOL_KEY;
              if (
                parsed.model === 'openai/gpt-4o-mini' ||
                parsed.model === 'meta/llama-3.3-70b-instruct'
              ) {
                initialModel = parsed.model;
              }
            } else if (parsed.toolKey?.startsWith('conn:')) {
              const targetId = parsed.toolKey.slice(5);
              const matched = loadedConns.find((c) => c.id === targetId);
              if (matched) {
                initialToolKey = parsed.toolKey;
                const hasModel = matched.availableModels.some((m) => m.id === parsed.model);
                initialModel =
                  hasModel && parsed.model
                    ? parsed.model
                    : resolveDefaultModelForTool(initialToolKey, loadedConns);
              }
            }
          } else {
            const firstActive = loadedConns.find((c) => c.status === 'ACTIVE');
            if (firstActive) {
              initialToolKey = `conn:${firstActive.id}`;
              initialModel = resolveDefaultModelForTool(initialToolKey, loadedConns);
            }
          }
        } catch {
          // Ignore invalid localStorage entry
        }
      }

      setSelectedToolKey(initialToolKey);
      setSelectedModel(initialModel);

      if (status.connected) {
        void loadWorkspaces();
        void scanRef.current(targetRange, false, status, false);
        if (initialToolKey.startsWith('conn:')) {
          const targetId = initialToolKey.slice(5);
          const matched = loadedConns.find((c) => c.id === targetId);
          if (matched && matched.status === 'ACTIVE' && matched.availableModels.length > 0) {
            setAvailability({
              status: 'available',
              available: true,
              latencyMs: undefined,
            });
          } else {
            void checkModelAvailability(initialToolKey, initialModel);
          }
        } else {
          void checkModelAvailability(initialToolKey, initialModel);
        }
      }
    });
  }, [userId, loadGitStatus, loadWorkspaces, resolveDefaultModelForTool, checkModelAvailability]);

  const handleAccountSelect = async (account: {
    username: string;
    email: string;
    name: string;
    googleId?: string;
  }) => {
    setAuthError(null);
    const result = await loginWithGoogle({
      email: account.email,
      name: account.name,
      googleId: account.googleId || `google_${Date.now()}`,
    });

    if (!result.success) {
      setAuthError(result.error || dict.auth.googleAuthFailed);
    }
  };

  const handleSavePat = async (token: string) => {
    await api.github.savePat(token);
    clearAllActivityCache();
    const nextStatus = await loadGitStatus();
    setBullets([]);
    setScanError(null);
    setAiError(null);
    void loadWorkspaces();
    await handleScanActivity(undefined, false, nextStatus, true);
    if (selectedToolKey === BUILTIN_GITHUB_TOOL_KEY) {
      void checkModelAvailability(selectedToolKey, selectedModel);
    }
    showToast({ title: dict.toasts.gitConnected, variant: 'success' });
  };

  const handleSelectGitAccount = async (accountId: string) => {
    const nextStatus = await api.github.switchAccount(accountId);
    setGitStatus(nextStatus);
    applyScannedActivities([]);
    setBullets([]);
    setScanError(null);
    setAiError(null);
    if (nextStatus.gitUsername) {
      showToast({
        title: t('toasts.gitSwitched', { username: nextStatus.gitUsername }),
        variant: 'info',
      });
    }
    if (nextStatus.connected) {
      void loadWorkspaces();
      await handleScanActivity(undefined, false, nextStatus, false);
      if (selectedToolKey === BUILTIN_GITHUB_TOOL_KEY) {
        void checkModelAvailability(selectedToolKey, selectedModel);
      }
    }
  };

  const handleDisconnectGit = async (accountId?: string) => {
    const nextStatus = await api.github.disconnect(accountId);
    clearAllActivityCache();
    applyScannedActivities([]);
    setBullets([]);
    setWorkspaces(null);
    setGitStatus(nextStatus);
    showToast({ title: dict.toasts.gitDisconnected, variant: 'info' });
    if (nextStatus.connected) {
      void loadWorkspaces();
      await handleScanActivity(undefined, false, nextStatus, true);
    }
  };

  const openSettingsTab = (tab: SettingsTabKey, section: SettingsSectionAnchor | null = null) => {
    setSettingsModalTab(tab);
    setSettingsModalSection(section);
    setIsSettingsModalOpen(true);
  };

  const handleSaveFetchPreferences = async (nextPrefs: FetchPreferences) => {
    const saved = await api.settings.update({ fetchPreferences: nextPrefs });
    setFetchPrefs(saved.fetchPreferences);
    setGroupBy(saved.fetchPreferences.defaultGroupBy);
    setSinceOption(saved.fetchPreferences.defaultTimeRange);
    clearAllActivityCache();
    showToast({ title: dict.toasts.settingsSaved, variant: 'success' });
    if (gitStatus.connected) {
      await handleScanActivity(saved.fetchPreferences.defaultTimeRange, false, undefined, true);
    }
  };

  const handleSaveAiPrompt = async (nextCustomPrompt: string) => {
    const saved = await api.settings.update({
      customPrompt: nextCustomPrompt,
    });
    setCustomPrompt(saved.customPrompt ?? '');
    showToast({ title: dict.toasts.aiSettingsSaved, variant: 'success' });
  };

  const handleCreateTask = async (title: string, color: TaskColor, prs: PrActivity[]) => {
    const created = await api.tasks.create({
      title,
      color,
      items: prs.map(toTaskItemInput),
    });
    setTasks((prev) => [created, ...prev]);
    showToast({ title: t('toasts.taskCreated', { title: created.title }), variant: 'success' });
  };

  const handleRenameTask = async (taskId: string, title: string, color: TaskColor) => {
    const updated = await api.tasks.update(taskId, { title, color });
    setTasks((prev) => prev.map((tk) => (tk.id === taskId ? updated : tk)));
    showToast({ title: t('toasts.taskUpdated', { title: updated.title }), variant: 'info' });
  };

  const handleToggleTaskComplete = async (taskId: string, isCompleted: boolean) => {
    const previous = tasks.find((tk) => tk.id === taskId);
    setTasks((prev) =>
      prev.map((tk) =>
        tk.id === taskId
          ? {
              ...tk,
              isCompleted,
              completedAt: isCompleted ? new Date().toISOString() : null,
            }
          : tk,
      ),
    );
    try {
      const updated = await api.tasks.update(taskId, { isCompleted });
      setTasks((prev) => prev.map((tk) => (tk.id === taskId ? updated : tk)));
      showToast({
        title: t(isCompleted ? 'toasts.taskCompleted' : 'toasts.taskReopened', {
          title: updated.title,
        }),
        variant: isCompleted ? 'success' : 'info',
      });
    } catch (err) {
      if (previous) {
        setTasks((prev) => prev.map((tk) => (tk.id === taskId ? previous : tk)));
      }
      showToast({ title: dict.toasts.taskUpdateError, variant: 'error' });
      throw err;
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    await api.tasks.delete(taskId);
    setTasks((prev) => prev.filter((tk) => tk.id !== taskId));
    showToast({ title: dict.toasts.taskDeleted, variant: 'info' });
  };

  const handleSaveParabolConnection = async (token: string, label?: string) => {
    const saved = await api.parabol.saveConnection({ token, label });
    const nextList = await api.parabol.listConnections().catch(() => [saved]);
    setParabolConnections(nextList);
    showToast({
      title: t('toasts.parabolConnected', { label: saved.label }),
      variant: 'success',
    });
  };

  const handleSwitchParabolConnection = async (connectionId: string) => {
    const nextList = await api.parabol.switchActiveConnection(connectionId);
    setParabolConnections(nextList);
    showToast({ title: dict.toasts.parabolSwitched, variant: 'info' });
  };

  const handleDeleteParabolConnection = async (connectionId: string) => {
    await api.parabol.deleteConnection(connectionId);
    const nextList = await api.parabol.listConnections().catch(() => []);
    setParabolConnections(nextList);
    showToast({ title: dict.toasts.parabolDisconnected, variant: 'info' });
  };

  const handleToggleParabolEnabled = (enabled: boolean) => {
    setParabolEnabled(enabled);
    try {
      window.localStorage.setItem('gitpulse:report_platform:parabol:enabled', String(enabled));
    } catch {
      // ignore storage errors
    }
  };

  const handleToggleTaskAssignment = async (
    taskId: string,
    pr: PrActivity,
    isAssigned: boolean,
  ) => {
    const updated = isAssigned
      ? await api.tasks.removeItem(taskId, pr.repo, pr.number)
      : await api.tasks.addItems(taskId, [toTaskItemInput(pr)]);
    setTasks((prev) => prev.map((tk) => (tk.id === taskId ? updated : tk)));
    showToast({ title: dict.toasts.taskItemUpdated, variant: 'info' });
  };

  const handleRemoveTaskItem = async (taskId: string, repo: string, prNumber: number) => {
    const updated = await api.tasks.removeItem(taskId, repo, prNumber);
    setTasks((prev) => prev.map((tk) => (tk.id === taskId ? updated : tk)));
    showToast({ title: dict.toasts.taskItemUpdated, variant: 'info' });
  };

  const openGitConnectModal = (mode: 'connect' | 'add' | 'manage') => {
    setGitModalMode(mode);
    setIsGitModalOpen(true);
  };

  const handleLogout = async () => {
    clearAllActivityCache();
    await logout();
  };

  const handleSelectAiTool = useCallback(
    (nextToolKey: string) => {
      const nextModel = resolveDefaultModelForTool(nextToolKey, aiConnections, githubModels);
      setSelectedToolKey(nextToolKey);
      setSelectedModel(nextModel);
      setAiError(null);
      persistAiSelection(userId, nextToolKey, nextModel);

      if (nextToolKey.startsWith('conn:')) {
        const targetId = nextToolKey.slice(5);
        const matched = aiConnections.find((c) => c.id === targetId);
        if (matched && matched.status === 'ACTIVE' && matched.availableModels.length > 0) {
          setAvailability({
            status: 'available',
            available: true,
            latencyMs: undefined,
          });
          return;
        }
      }
      void checkModelAvailability(nextToolKey, nextModel);
    },
    [
      aiConnections,
      checkModelAvailability,
      githubModels,
      persistAiSelection,
      resolveDefaultModelForTool,
      userId,
    ],
  );

  const handleSelectAiModel = useCallback(
    (nextModel: string) => {
      setSelectedModel(nextModel);
      setAiError(null);
      persistAiSelection(userId, selectedToolKey, nextModel);

      if (selectedToolKey.startsWith('conn:')) {
        const targetId = selectedToolKey.slice(5);
        const matched = aiConnections.find((c) => c.id === targetId);
        if (
          matched &&
          matched.status === 'ACTIVE' &&
          matched.availableModels.some((m) => m.id === nextModel)
        ) {
          setAvailability({
            status: 'available',
            available: true,
            latencyMs: undefined,
          });
          return;
        }
      }
      void checkModelAvailability(selectedToolKey, nextModel);
    },
    [aiConnections, checkModelAvailability, persistAiSelection, selectedToolKey, userId],
  );

  const handleAiConnectionSaved = useCallback(
    (savedConn: AiConnectionSummary, isUpdate: boolean, preferredModel?: string) => {
      setAiConnections((prev) => {
        const exists = prev.some((c) => c.id === savedConn.id);
        return exists
          ? prev.map((c) => (c.id === savedConn.id ? savedConn : c))
          : [savedConn, ...prev];
      });
      const nextToolKey = `conn:${savedConn.id}`;
      const hasPreferred =
        Boolean(preferredModel) && savedConn.availableModels.some((m) => m.id === preferredModel);
      const nextModel =
        (hasPreferred ? preferredModel : savedConn.availableModels[0]?.id) || 'gemini-2.5-flash';
      setSelectedToolKey(nextToolKey);
      setSelectedModel(nextModel);
      setAiError(null);
      persistAiSelection(userId, nextToolKey, nextModel);
      void checkModelAvailability(nextToolKey, nextModel);
      showToast({
        title: t(isUpdate ? 'toasts.aiUpdated' : 'toasts.aiConnected', { label: savedConn.label }),
        variant: 'success',
      });
    },
    [checkModelAvailability, persistAiSelection, showToast, t, userId],
  );

  const handleRefreshAiConnection = useCallback(
    async (connectionId: string) => {
      setIsRefreshingModels(true);
      try {
        const refreshed = await api.ai.refreshConnectionModels(connectionId);
        setAiConnections((prev) => prev.map((c) => (c.id === connectionId ? refreshed : c)));

        if (selectedToolKey === `conn:${connectionId}`) {
          const stillExists = refreshed.availableModels.some((m) => m.id === selectedModel);
          const nextModel = stillExists
            ? selectedModel
            : refreshed.availableModels[0]?.id || 'gemini-2.5-flash';
          if (nextModel !== selectedModel) {
            setSelectedModel(nextModel);
            persistAiSelection(userId, selectedToolKey, nextModel);
          }
          void checkModelAvailability(selectedToolKey, nextModel);
        }

        showToast({
          title: t('toasts.aiModelsRefreshed', { count: refreshed.availableModels.length }),
          variant: 'success',
        });
      } catch (err) {
        setAiConnections((prev) =>
          prev.map((c) => (c.id === connectionId ? { ...c, status: 'REVOKED' } : c)),
        );
        showToast({
          title: (err as Error).message || dict.toasts.aiModelsRefreshError,
          variant: 'error',
        });
        if (selectedToolKey === `conn:${connectionId}`) {
          void checkModelAvailability(selectedToolKey, selectedModel);
        }
        throw err;
      } finally {
        setIsRefreshingModels(false);
      }
    },
    [
      checkModelAvailability,
      dict.toasts.aiModelsRefreshError,
      persistAiSelection,
      selectedModel,
      selectedToolKey,
      showToast,
      t,
      userId,
    ],
  );

  const handleRefreshActiveModels = useCallback(async () => {
    if (selectedToolKey.startsWith('conn:')) {
      const connId = selectedToolKey.slice(5);
      await handleRefreshAiConnection(connId).catch(() => {
        // Error toast & availability update already handled inside handleRefreshAiConnection
      });
      return;
    }

    setIsRefreshingModels(true);
    try {
      const result = await checkModelAvailability(BUILTIN_GITHUB_TOOL_KEY, selectedModel);
      if (result?.availableModels && result.availableModels.length > 0) {
        showToast({
          title: t('toasts.aiModelsRefreshed', { count: result.availableModels.length }),
          variant: 'success',
        });
      }
    } finally {
      setIsRefreshingModels(false);
    }
  }, [
    checkModelAvailability,
    handleRefreshAiConnection,
    selectedModel,
    selectedToolKey,
    showToast,
    t,
  ]);

  const handleDeleteAiConnection = useCallback(
    async (connectionId: string) => {
      await api.ai.deleteConnection(connectionId);
      const remaining = aiConnections.filter((c) => c.id !== connectionId);
      setAiConnections(remaining);
      showToast({ title: dict.toasts.aiDeleted, variant: 'info' });

      if (selectedToolKey === `conn:${connectionId}`) {
        const fallback = remaining[0];
        const nextToolKey = fallback ? `conn:${fallback.id}` : BUILTIN_GITHUB_TOOL_KEY;
        const nextModel = resolveDefaultModelForTool(nextToolKey, remaining, githubModels);
        setSelectedToolKey(nextToolKey);
        setSelectedModel(nextModel);
        persistAiSelection(userId, nextToolKey, nextModel);
        void checkModelAvailability(nextToolKey, nextModel);
      }
    },
    [
      aiConnections,
      checkModelAvailability,
      dict.toasts.aiDeleted,
      githubModels,
      persistAiSelection,
      resolveDefaultModelForTool,
      selectedToolKey,
      showToast,
      userId,
    ],
  );

  const handleGenerateSummary = useCallback(async () => {
    if (activities.length === 0) {
      setAiError(dict.aiConsole.noActivitiesError);
      return;
    }

    const filteredPrs = activities
      .map((act) => {
        const prKey = getPrKey(act);
        const selectedForThisPr = act.commits.filter((msg, idx) => {
          if (!msg.trim()) return false;
          return selectedCommitIds.has(`${prKey}::${idx}`);
        });
        return {
          repo: act.repo,
          title: act.title,
          commits: selectedForThisPr,
        };
      })
      .filter((p) => p.commits.length > 0);

    if (filteredPrs.length === 0) {
      setAiError(dict.aiConsole.noSelectedCommitsError);
      return;
    }

    const isConn = selectedToolKey.startsWith('conn:');
    const connectionId = isConn ? selectedToolKey.slice(5) : undefined;
    const activeConn = connectionId ? aiConnections.find((c) => c.id === connectionId) : undefined;
    const engine: AiEngine = activeConn ? activeConn.provider : isConn ? 'GROQ' : 'GITHUB_MODELS';

    setAiError(null);
    setIsGenerating(true);
    setBullets([]);

    try {
      const res = await api.ai.summarize({
        prs: filteredPrs,
        engine,
        connectionId,
        model: selectedModel,
        customPrompt: customPrompt.trim() || undefined,
      });

      setBullets(res.bullets);
      showToast({ title: dict.toasts.standupReady, variant: 'success' });
    } catch (err) {
      setAiError((err as Error).message || dict.aiConsole.generateFailed);
    } finally {
      setIsGenerating(false);
    }
  }, [
    activities,
    selectedCommitIds,
    selectedToolKey,
    aiConnections,
    selectedModel,
    customPrompt,
    dict,
    showToast,
  ]);

  const generateRef = useRef(handleGenerateSummary);
  useEffect(() => {
    generateRef.current = handleGenerateSummary;
  }, [handleGenerateSummary]);

  // Global keyboard shortcuts (⌘K / Ctrl+K for Command Palette, ⌘Enter for Generate when connected)
  useEffect(() => {
    if (!user || !gitStatus.connected) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        const blockedByAvailability =
          availability.status === 'checking' || availability.status === 'unavailable';
        if (selectedCommitCount > 0 && !isGenerating && !blockedByAvailability) {
          e.preventDefault();
          void generateRef.current();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [user, gitStatus.connected, selectedCommitCount, isGenerating, availability.status]);

  if (!isIntroComplete) {
    return <IntroScreen onComplete={() => setIsIntroComplete(true)} />;
  }

  if (isAuthLoading) {
    return <WorkspaceSkeleton />;
  }

  if (!user) {
    return (
      <AuthLandingWrapper
        dictBrand={dict.header.brand}
        dictTagline={dict.auth.brandTagline}
        dictPauseLabel={dict.header.toggleMotionPause}
        dictPlayLabel={dict.header.toggleMotionPlay}
        authError={authError}
        isGoogleChooserOpen={isGoogleChooserOpen}
        onOpenGoogleChooser={openGoogleChooser}
        onCloseGoogleChooser={closeGoogleChooser}
        onSelectAccount={handleAccountSelect}
      />
    );
  }

  return (
    <>
      <Header
        user={user}
        gitStatus={gitStatus}
        onSelectGitAccount={(accountId) => void handleSelectGitAccount(accountId)}
        onOpenAddGitAccount={() => openGitConnectModal(gitStatus.connected ? 'add' : 'connect')}
        onOpenCommandPalette={() => setIsPaletteOpen(true)}
        onOpenHistory={() => setIsHistoryModalOpen(true)}
        onOpenSettings={() => openSettingsTab('general')}
        onLogout={handleLogout}
      />

      {/* Unified Scrollable Container: Main content and Footer scroll together */}
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar">
        <main className="flex-1 flex flex-col max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
          {!gitStatus.connected ? (
            /* Clean Focused Onboarding When GitHub Is Not Linked Yet (No empty panels or dead buttons) */
            <div className="flex-1 flex flex-col items-center justify-center py-10 sm:py-16">
              <ShowcaseCard tiltStrength={0.75} className="w-full max-w-xl p-6 sm:p-8 gp-fade-in">
                <div className="flex flex-col items-center text-center space-y-5">
                  <div
                    className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-400/35 flex items-center justify-center text-sky-400 shadow-[0_0_24px_rgba(56,189,248,0.2)]"
                    aria-hidden="true"
                  >
                    <GitBranch className="w-6 h-6" />
                  </div>

                  <div className="space-y-2 max-w-md">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">
                      {dict.onboarding.title}
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                      {dict.onboarding.description}
                    </p>
                  </div>

                  <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-left">
                    <div className="p-3 rounded-xl bg-[#253349]/65 border border-slate-600/75 space-y-1.5">
                      <RefreshCw className="w-4 h-4 text-sky-400" aria-hidden="true" />
                      <p className="text-xs text-slate-200 leading-snug">
                        {dict.onboarding.featureSync}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#253349]/65 border border-slate-600/75 space-y-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-400" aria-hidden="true" />
                      <p className="text-xs text-slate-200 leading-snug">
                        {dict.onboarding.featureAi}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#253349]/65 border border-slate-600/75 space-y-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                      <p className="text-xs text-slate-200 leading-snug">
                        {dict.onboarding.featureExport}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => openGitConnectModal('connect')}
                    className="gp-cta-shimmer inline-flex items-center justify-center gap-2 min-h-[42px] px-6 py-2.5 rounded-xl text-sm font-semibold text-slate-950 bg-sky-500 hover:bg-sky-400 active:scale-[0.98] transition-all cursor-pointer shadow-[0_8px_24px_-6px_rgba(14,165,233,0.45)]"
                  >
                    <GitBranch className="w-4 h-4" aria-hidden="true" />
                    <span>{dict.onboarding.connectNow}</span>
                  </button>
                </div>
              </ShowcaseCard>
            </div>
          ) : (
            /* Active Workspace (Rendered Only When At Least One GitHub Account Is Connected) */
            <>
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">
                  {dict.workspace.title}
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 font-mono">
                  {gitStatus.gitUsername
                    ? t('workspace.activeAccountContext', { username: gitStatus.gitUsername })
                    : dict.workspace.subtitle}
                </p>
              </div>

              <ActivitySummaryStrip activities={activities} />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 xl:col-span-8 min-w-0">
                  <ActivityScanner
                    activities={activities}
                    isLoading={isScanning}
                    error={scanError}
                    onScan={() => handleScanActivity(undefined, true, undefined, true)}
                    sinceOption={sinceOption}
                    onSinceOptionChange={(opt) => {
                      setScanError(null);
                      void handleScanActivity(opt, true, undefined, false);
                    }}
                    repoFilter={repoFilter}
                    onRepoFilterChange={setRepoFilter}
                    groupBy={groupBy}
                    onGroupByChange={setGroupBy}
                    compactCommits={fetchPrefs.compactCommits}
                    workspaces={workspaces}
                    includePersonalEnabled={fetchPrefs.includePersonal}
                    onOpenFetchSettings={() => openSettingsTab('fetch')}
                    tasks={tasks}
                    onCreateTask={handleCreateTask}
                    onRenameTask={handleRenameTask}
                    onToggleTaskComplete={handleToggleTaskComplete}
                    onDeleteTask={handleDeleteTask}
                    onToggleTaskAssignment={handleToggleTaskAssignment}
                    onRemoveTaskItem={handleRemoveTaskItem}
                  />
                </div>

                <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-6 space-y-6 min-w-0">
                  <CockpitAiConsole
                    selectedToolKey={selectedToolKey}
                    onSelectToolKey={handleSelectAiTool}
                    connections={aiConnections}
                    githubModels={githubModels}
                    gitTokenExpiresAt={gitStatus.expiresAt}
                    selectedModel={selectedModel}
                    onModelChange={handleSelectAiModel}
                    hasCustomPrompt={Boolean(
                      customPrompt.trim() && customPrompt.trim() !== DEFAULT_AI_PROMPT.trim(),
                    )}
                    onOpenAiSettings={() => openSettingsTab('reports', 'ai-prompt')}
                    availability={availability}
                    onRecheckAvailability={() =>
                      void checkModelAvailability(selectedToolKey, selectedModel)
                    }
                    onRefreshModels={() => void handleRefreshActiveModels()}
                    isRefreshingModels={isRefreshingModels}
                    onOpenAddAiModal={() => {
                      setEditingAiConnection(null);
                      setIsAiModalOpen(true);
                    }}
                    onOpenUpdateAiModal={(conn) => {
                      setEditingAiConnection(conn);
                      setIsAiModalOpen(true);
                    }}
                    onGenerate={handleGenerateSummary}
                    isGenerating={isGenerating}
                    error={aiError}
                    selectedPrCount={selectedPrCount}
                    selectedCommitCount={selectedCommitCount}
                    totalCommitCount={allSelectableCommits.length}
                    onOpenCommitSelector={() => setIsCommitModalOpen(true)}
                  />

                  <StandupOutputDock
                    bullets={bullets}
                    isGenerating={isGenerating}
                    onUpdateBullets={setBullets}
                    onOpenReportSettings={() => openSettingsTab('reports', 'report-delivery')}
                    onOpenParabolSubmit={() => setIsParabolModalOpen(true)}
                    showParabolAction={
                      parabolEnabled && parabolConnections.some((c) => c.status === 'ACTIVE')
                    }
                  />
                </div>
              </div>
            </>
          )}
        </main>
        <Footer />
      </div>

      <GitHubConnectModal
        isOpen={isGitModalOpen}
        onClose={() => setIsGitModalOpen(false)}
        status={gitStatus}
        mode={gitModalMode}
        onSavePat={handleSavePat}
        onDisconnect={handleDisconnectGit}
      />

      <AiConnectModal
        isOpen={isAiModalOpen}
        onClose={() => {
          setIsAiModalOpen(false);
          setEditingAiConnection(null);
        }}
        defaultUsername={user.username}
        editingConnection={editingAiConnection}
        onSaved={handleAiConnectionSaved}
      />

      <ReportHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        initialTab={settingsModalTab}
        initialSection={settingsModalSection}
        onClose={() => setIsSettingsModalOpen(false)}
        accounts={gitStatus.accounts ?? []}
        aiConnections={aiConnections}
        workspaces={workspaces}
        preferences={fetchPrefs}
        customPrompt={customPrompt}
        parabolConnections={parabolConnections}
        parabolEnabled={parabolEnabled}
        onSavePreferences={handleSaveFetchPreferences}
        onSaveAiPrompt={handleSaveAiPrompt}
        onSwitchAccount={handleSelectGitAccount}
        onDisconnectAccount={handleDisconnectGit}
        onOpenAddAccount={() => openGitConnectModal(gitStatus.connected ? 'add' : 'connect')}
        onOpenAddAi={() => {
          setEditingAiConnection(null);
          setIsAiModalOpen(true);
        }}
        onOpenUpdateAi={(conn) => {
          setEditingAiConnection(conn);
          setIsAiModalOpen(true);
        }}
        onRefreshAiModels={handleRefreshAiConnection}
        onDeleteAiConnection={handleDeleteAiConnection}
        onOpenAddReportPlatform={() => setIsReportConnectModalOpen(true)}
        onToggleParabolEnabled={handleToggleParabolEnabled}
        onSwitchParabolConnection={handleSwitchParabolConnection}
        onDeleteParabolConnection={handleDeleteParabolConnection}
      />

      <ReportPlatformConnectModal
        isOpen={isReportConnectModalOpen}
        onClose={() => setIsReportConnectModalOpen(false)}
        onSaveParabolConnection={handleSaveParabolConnection}
      />

      <ParabolSubmitModal
        isOpen={isParabolModalOpen}
        onClose={() => setIsParabolModalOpen(false)}
        bullets={bullets}
        connections={parabolConnections}
        onConnectionsChanged={setParabolConnections}
      />

      <CommitSelectionModal
        isOpen={isCommitModalOpen}
        onClose={() => setIsCommitModalOpen(false)}
        commits={allSelectableCommits}
        selectedCommitIds={selectedCommitIds}
        onToggleCommit={handleToggleCommit}
        onSelectAll={handleSelectAllCommits}
        onDeselectAll={handleDeselectAllCommits}
        includePersonal={includePersonalCommits}
        onTogglePersonal={handleTogglePersonalCommits}
        includeOrg={includeOrgCommits}
        onToggleOrg={handleToggleOrgCommits}
      />

      {gitStatus.connected && (
        <CommandPalette
          isOpen={isPaletteOpen}
          onClose={() => setIsPaletteOpen(false)}
          canGenerate={
            selectedCommitCount > 0 &&
            !isGenerating &&
            availability.status !== 'checking' &&
            availability.status !== 'unavailable'
          }
          hasSelectableCommits={allSelectableCommits.length > 0}
          showParabolAction={
            parabolEnabled && parabolConnections.some((c) => c.status === 'ACTIVE')
          }
          canSendToParabol={
            parabolEnabled &&
            parabolConnections.some((c) => c.status === 'ACTIVE') &&
            bullets.length > 0
          }
          aiConnections={aiConnections}
          onSyncRange={(range) => void handleScanActivity(range, true, undefined, false)}
          onOpenCommitSelector={() => setIsCommitModalOpen(true)}
          onGenerate={() => void handleGenerateSummary()}
          onSelectAiTool={handleSelectAiTool}
          onOpenAddAiModal={() => {
            setEditingAiConnection(null);
            setIsAiModalOpen(true);
          }}
          onOpenParabolSubmit={() => setIsParabolModalOpen(true)}
          onOpenAddReportPlatform={() => setIsReportConnectModalOpen(true)}
          onOpenHistory={() => setIsHistoryModalOpen(true)}
          onOpenSettings={() => openSettingsTab('fetch')}
          onOpenReportSettings={() => openSettingsTab('reports')}
          onOpenGitModal={() => openGitConnectModal('manage')}
          onToggleLanguage={() => setLocale(locale === 'vi' ? 'en' : 'vi')}
        />
      )}
    </>
  );
}

interface AuthLandingWrapperProps {
  dictBrand: string;
  dictTagline: string;
  dictPauseLabel: string;
  dictPlayLabel: string;
  authError: string | null;
  isGoogleChooserOpen: boolean;
  onOpenGoogleChooser: () => void;
  onCloseGoogleChooser: () => void;
  onSelectAccount: (account: {
    username: string;
    email: string;
    name: string;
    googleId?: string;
  }) => Promise<void>;
}

function AuthLandingWrapper({
  dictBrand,
  dictTagline,
  dictPauseLabel,
  dictPlayLabel,
  authError,
  isGoogleChooserOpen,
  onOpenGoogleChooser,
  onCloseGoogleChooser,
  onSelectAccount,
}: AuthLandingWrapperProps) {
  const { isPaused: isMotionPaused, toggleMotion } = useAmbientMotionPreference();
  const motionLabel = isMotionPaused ? dictPlayLabel : dictPauseLabel;

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar">
      <main className="relative flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
        <button
          type="button"
          onClick={toggleMotion}
          title={motionLabel}
          aria-label={motionLabel}
          className={`fixed top-4 right-4 z-30 inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
            isMotionPaused
              ? 'bg-[#1E293B]/90 border-slate-600/80 text-slate-300 hover:text-white hover:border-slate-500'
              : 'bg-sky-500/10 border-sky-500/25 text-sky-400 hover:bg-sky-500/15 hover:border-sky-500/40'
          }`}
        >
          {isMotionPaused ? (
            <Pause className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          )}
        </button>

        <div className="mb-6 text-center max-w-sm">
          <p className="text-xs font-mono uppercase tracking-wider text-sky-400 font-semibold">
            {dictBrand}
          </p>
          <p className="text-xs text-slate-400 mt-1">{dictTagline}</p>
        </div>

        <AuthModal
          isOpen={true}
          onClose={() => {}}
          variant="inline"
          onOpenGoogleChooser={onOpenGoogleChooser}
          externalError={authError}
        />

        <GoogleAccountChooserModal
          isOpen={isGoogleChooserOpen}
          onClose={onCloseGoogleChooser}
          onSelectAccount={onSelectAccount}
          appName="Git Pulse"
        />
      </main>
      <Footer />
    </div>
  );
}
