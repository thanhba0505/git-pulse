'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { GitStatus, PrActivity, AiEngine } from '../types';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useTranslation } from '../i18n';
import { Header } from '../components/layout/Header';
import { IntroScreen } from '../components/layout/IntroScreen';
import { ActivitySummaryStrip } from '../components/dashboard/ActivitySummaryStrip';
import { ActivityScanner, getPrKey } from '../components/dashboard/ActivityScanner';
import { CockpitAiConsole } from '../components/ai/CockpitAiConsole';
import { StandupOutputDock } from '../components/standup/StandupOutputDock';
import { AuthModal } from '../components/auth/AuthModal';
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

const ACTIVITY_CACHE_TTL_MS = 10 * 60 * 1000;

interface CachedActivityPayload {
  timestamp: number;
  activities: PrActivity[];
}

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
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(getCacheKey(userId, accountKey, sinceOption));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedActivityPayload;
    if (!parsed || !Array.isArray(parsed.activities)) return null;
    if (Date.now() - parsed.timestamp > ACTIVITY_CACHE_TTL_MS) return null;
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
  if (typeof window === 'undefined') return;
  try {
    const payload: CachedActivityPayload = {
      timestamp: Date.now(),
      activities,
    };
    window.sessionStorage.setItem(
      getCacheKey(userId, accountKey, sinceOption),
      JSON.stringify(payload),
    );
  } catch {
    // Ignore storage quota errors
  }
}

function clearAllActivityCache(): void {
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
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  const [activities, setActivities] = useState<PrActivity[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [sinceOption, setSinceOption] = useState<'today' | '24h' | '7d'>('today');
  const [repoFilter, setRepoFilter] = useState<string>('ALL');
  const [selectedPrKeys, setSelectedPrKeys] = useState<Set<string>>(() => new Set());

  const [aiEngine, setAiEngine] = useState<AiEngine>('GITHUB_MODELS');
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o-mini');
  const [reportLanguage, setReportLanguage] = useState<'vi' | 'en'>('vi');

  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [webLlmProgressText, setWebLlmProgressText] = useState<string>('');
  const [webLlmProgressPercent, setWebLlmProgressPercent] = useState<number>(0);

  const [bullets, setBullets] = useState<string[]>([]);
  const [modelUsed, setModelUsed] = useState<string>('');
  const [generatedLanguage, setGeneratedLanguage] = useState<'vi' | 'en'>('vi');

  const selectedActivities = useMemo(() => {
    const base =
      repoFilter === 'ALL' ? activities : activities.filter((a) => a.repo === repoFilter);
    return base.filter((pr) => selectedPrKeys.has(getPrKey(pr)));
  }, [activities, repoFilter, selectedPrKeys]);

  const applyScannedActivities = useCallback((nextActivities: PrActivity[]) => {
    setActivities(nextActivities);
    setRepoFilter('ALL');
    setSelectedPrKeys(new Set(nextActivities.map(getPrKey)));
  }, []);

  const gitStatusRef = useRef<GitStatus>(gitStatus);
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

  const handleScanActivity = useCallback(
    async (
      overrideRange?: 'today' | '24h' | '7d',
      notifyToast = true,
      statusOverride?: GitStatus,
    ) => {
      const activeStatus = statusOverride ?? gitStatusRef.current;
      const accountKey = activeStatus.activeAccountId || activeStatus.gitUsername || 'default';
      const targetRange = overrideRange ?? sinceOption;
      if (overrideRange && overrideRange !== sinceOption) {
        setSinceOption(overrideRange);
      }

      if (user) {
        const cached = readCachedActivities(user.id, accountKey, targetRange);
        if (cached) {
          applyScannedActivities(cached);
        }
      }

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
        applyScannedActivities(data);

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
        setIsScanning(false);
      }
    },
    [sinceOption, user, applyScannedActivities, dict.scanner.scanError, showToast, t],
  );

  const scanRef = useRef(handleScanActivity);
  useEffect(() => {
    scanRef.current = handleScanActivity;
  }, [handleScanActivity]);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) {
      setGitStatus({ connected: false, accounts: [] });
      return;
    }

    loadGitStatus().then((status) => {
      if (status.connected) {
        void scanRef.current(undefined, false, status);
      }
    });
  }, [userId, loadGitStatus]);

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
    const nextStatus = await loadGitStatus();
    setBullets([]);
    setModelUsed('');
    setScanError(null);
    setAiError(null);
    await handleScanActivity(undefined, false, nextStatus);
    showToast({ title: dict.toasts.gitConnected, variant: 'success' });
  };

  const handleSelectGitAccount = async (accountId: string) => {
    const nextStatus = await api.github.switchAccount(accountId);
    setGitStatus(nextStatus);
    applyScannedActivities([]);
    setBullets([]);
    setModelUsed('');
    setScanError(null);
    setAiError(null);
    if (nextStatus.gitUsername) {
      showToast({
        title: t('toasts.gitSwitched', { username: nextStatus.gitUsername }),
        variant: 'info',
      });
    }
    if (nextStatus.connected) {
      await handleScanActivity(undefined, false, nextStatus);
    }
  };

  const handleDisconnectGit = async (accountId?: string) => {
    const nextStatus = await api.github.disconnect(accountId);
    clearAllActivityCache();
    applyScannedActivities([]);
    setBullets([]);
    setModelUsed('');
    setGitStatus(nextStatus);
    showToast({ title: dict.toasts.gitDisconnected, variant: 'info' });
    if (nextStatus.connected) {
      await handleScanActivity(undefined, false, nextStatus);
    }
  };

  const openGitConnectModal = (mode: 'connect' | 'add' | 'manage') => {
    setGitModalMode(mode);
    setIsGitModalOpen(true);
  };

  const handleLogout = async () => {
    clearAllActivityCache();
    await logout();
  };

  const handleGenerateSummary = useCallback(async () => {
    if (activities.length === 0) {
      setAiError(dict.aiConsole.noActivitiesError);
      return;
    }

    if (selectedActivities.length === 0) {
      setAiError(dict.aiConsole.noSelectedPrsError);
      return;
    }

    setAiError(null);
    setIsGenerating(true);
    setBullets([]);

    try {
      if (aiEngine === 'GITHUB_MODELS') {
        const res = await api.ai.summarizeWithGitHubModels({
          prs: selectedActivities.map((a) => ({
            repo: a.repo,
            title: a.title,
            commits: a.commits,
          })),
          model: selectedModel,
          language: reportLanguage,
        });
        setBullets(res.bullets);
        setModelUsed(`GitHub Models (${res.modelUsed})`);
        setGeneratedLanguage(reportLanguage);
        showToast({ title: dict.toasts.standupReady, variant: 'success' });
      } else {
        // Dynamically load WebLLM runtime only on explicit WebGPU execution
        const { runWebLLMSummary, isWebGPUSupported } = await import('../lib/webllm');

        const supported = await isWebGPUSupported();
        if (!supported) {
          setAiError(dict.aiConsole.webgpuUnsupported);
          setIsGenerating(false);
          return;
        }

        const lines = await runWebLLMSummary(
          selectedModel,
          selectedActivities.map((a) => ({
            repo: a.repo,
            title: a.title,
            commits: a.commits,
          })),
          reportLanguage,
          (prog) => {
            setWebLlmProgressText(prog.text);
            setWebLlmProgressPercent(prog.progress);
          },
        );

        setBullets(lines);
        setModelUsed(`WebGPU (${selectedModel.split('-')[0]})`);
        setGeneratedLanguage(reportLanguage);
        showToast({ title: dict.toasts.standupReady, variant: 'success' });

        const totalCommits = selectedActivities.reduce((sum, pr) => sum + pr.commits.length, 0);
        await api.ai.saveClientSummary({
          summary: lines,
          modelName: selectedModel,
          prCount: selectedActivities.length,
          commitCount: totalCommits,
          engine: 'WEB_LLM',
          metadata: { prs: selectedActivities },
        });
      }
    } catch (err) {
      setAiError((err as Error).message || dict.aiConsole.generateFailed);
    } finally {
      setIsGenerating(false);
    }
  }, [
    activities.length,
    selectedActivities,
    aiEngine,
    selectedModel,
    reportLanguage,
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
        if (selectedActivities.length > 0 && !isGenerating) {
          e.preventDefault();
          void generateRef.current();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [user, gitStatus.connected, selectedActivities.length, isGenerating]);

  const handleTogglePrSelection = (key: string) => {
    setAiError(null);
    setSelectedPrKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSelectAllVisiblePrs = () => {
    setAiError(null);
    const visible =
      repoFilter === 'ALL' ? activities : activities.filter((a) => a.repo === repoFilter);
    setSelectedPrKeys((prev) => {
      const next = new Set(prev);
      for (const pr of visible) {
        next.add(getPrKey(pr));
      }
      return next;
    });
  };

  const handleClearVisiblePrSelection = () => {
    const visible =
      repoFilter === 'ALL' ? activities : activities.filter((a) => a.repo === repoFilter);
    setSelectedPrKeys((prev) => {
      const next = new Set(prev);
      for (const pr of visible) {
        next.delete(getPrKey(pr));
      }
      return next;
    });
  };

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
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
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
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07] space-y-1.5">
                    <RefreshCw className="w-4 h-4 text-sky-400" aria-hidden="true" />
                    <p className="text-xs text-slate-300 leading-snug">
                      {dict.onboarding.featureSync}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07] space-y-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-400" aria-hidden="true" />
                    <p className="text-xs text-slate-300 leading-snug">
                      {dict.onboarding.featureAi}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07] space-y-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                    <p className="text-xs text-slate-300 leading-snug">
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
              <div className="lg:col-span-7 min-w-0">
                <ActivityScanner
                  activities={activities}
                  isLoading={isScanning}
                  error={scanError}
                  onScan={() => handleScanActivity(undefined, true)}
                  sinceOption={sinceOption}
                  onSinceOptionChange={(opt) => {
                    setScanError(null);
                    void handleScanActivity(opt, true);
                  }}
                  repoFilter={repoFilter}
                  onRepoFilterChange={setRepoFilter}
                  selectedPrKeys={selectedPrKeys}
                  onTogglePrSelection={handleTogglePrSelection}
                  onSelectAllPrs={handleSelectAllVisiblePrs}
                  onClearPrSelection={handleClearVisiblePrSelection}
                />
              </div>

              <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6 min-w-0">
                <CockpitAiConsole
                  engine={aiEngine}
                  onEngineChange={(next) => {
                    setAiEngine(next);
                    setAiError(null);
                  }}
                  selectedModel={selectedModel}
                  onModelChange={setSelectedModel}
                  language={reportLanguage}
                  onLanguageChange={setReportLanguage}
                  onGenerate={handleGenerateSummary}
                  isGenerating={isGenerating}
                  error={aiError}
                  webLlmProgressText={webLlmProgressText}
                  webLlmProgressPercent={webLlmProgressPercent}
                  selectedPrCount={selectedActivities.length}
                />

                <StandupOutputDock
                  bullets={bullets}
                  isGenerating={isGenerating}
                  modelUsed={modelUsed}
                  reportLanguage={generatedLanguage}
                  onUpdateBullets={setBullets}
                />
              </div>
            </div>
          </>
        )}
      </main>

      <GitHubConnectModal
        isOpen={isGitModalOpen}
        onClose={() => setIsGitModalOpen(false)}
        status={gitStatus}
        mode={gitModalMode}
        onSavePat={handleSavePat}
        onDisconnect={handleDisconnectGit}
      />

      <ReportHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        accounts={gitStatus.accounts ?? []}
        onSwitchAccount={handleSelectGitAccount}
        onDisconnectAccount={handleDisconnectGit}
        onOpenAddAccount={() => openGitConnectModal(gitStatus.connected ? 'add' : 'connect')}
      />

      {gitStatus.connected && (
        <CommandPalette
          isOpen={isPaletteOpen}
          onClose={() => setIsPaletteOpen(false)}
          canGenerate={selectedActivities.length > 0 && !isGenerating}
          onSyncRange={(range) => void handleScanActivity(range, true)}
          onGenerate={() => void handleGenerateSummary()}
          onSwitchEngine={(eng) => {
            setAiEngine(eng);
            setSelectedModel(
              eng === 'WEB_LLM' ? 'Llama-3.2-1B-Instruct-q4f16_1-MLC' : 'gpt-4o-mini',
            );
            setAiError(null);
          }}
          onOpenHistory={() => setIsHistoryModalOpen(true)}
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
    <main className="relative flex-1 flex flex-col items-center justify-center p-4 sm:p-6 min-h-dvh">
      <button
        type="button"
        onClick={toggleMotion}
        title={motionLabel}
        aria-label={motionLabel}
        className={`fixed top-4 right-4 z-30 inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
          isMotionPaused
            ? 'bg-[#11141C]/90 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
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
  );
}
