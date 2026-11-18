'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { GitStatus, PrActivity, AiEngine } from '../types';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useTranslation } from '../i18n';
import { runWebLLMSummary, isWebGPUSupported } from '../lib/webllm';
import { Header } from '../components/layout/Header';
import { GitHubConnectModal } from '../components/github/GitHubConnectBanner';
import { ActivityScanner } from '../components/dashboard/ActivityScanner';
import { CockpitAiConsole } from '../components/ai/CockpitAiConsole';
import { StandupOutputDock } from '../components/standup/StandupOutputDock';
import { ReportHistoryModal } from '../components/history/ReportHistoryModal';
import { AuthModal } from '../components/auth/AuthModal';
import { GoogleAccountChooserModal } from '../components/auth/GoogleAccountChooserModal';
import { GitBranch, Loader2 } from 'lucide-react';

export default function HomePage() {
  const { dict } = useTranslation();
  const {
    user,
    isLoading: isAuthLoading,
    isGoogleChooserOpen,
    openGoogleChooser,
    closeGoogleChooser,
    loginWithGoogle,
    logout,
  } = useAuth();

  const [gitStatus, setGitStatus] = useState<GitStatus>({ connected: false });
  const [isGitModalOpen, setIsGitModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const [activities, setActivities] = useState<PrActivity[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [sinceOption, setSinceOption] = useState<'today' | '24h' | '7d'>('today');

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

  const loadGitStatus = useCallback(async () => {
    try {
      const status = await api.github.getStatus();
      setGitStatus(status);
      return status;
    } catch {
      setGitStatus({ connected: false });
      return { connected: false };
    }
  }, []);

  const handleScanActivity = useCallback(async () => {
    setIsScanning(true);
    setScanError(null);
    try {
      let sinceDate: string | undefined;
      const now = new Date();
      if (sinceOption === 'today') {
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        sinceDate = today.toISOString();
      } else if (sinceOption === '24h') {
        const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        sinceDate = past.toISOString();
      } else if (sinceOption === '7d') {
        const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        sinceDate = past.toISOString();
      }

      const data = await api.github.getActivity(sinceDate);
      setActivities(data);
    } catch (err) {
      setScanError((err as Error).message || dict.scanner.scanError);
    } finally {
      setIsScanning(false);
    }
  }, [sinceOption, dict.scanner.scanError]);

  useEffect(() => {
    if (user) {
      loadGitStatus().then((status) => {
        if (status.connected) {
          handleScanActivity();
        }
      });
    }
  }, [user, loadGitStatus, handleScanActivity]);

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
    await loadGitStatus();
    await handleScanActivity();
  };

  const handleDisconnectGit = async () => {
    await api.github.disconnect();
    setGitStatus({ connected: false });
    setActivities([]);
  };

  const handleGenerateSummary = async () => {
    if (activities.length === 0) {
      setAiError(dict.aiConsole.noActivitiesError);
      return;
    }

    setAiError(null);
    setIsGenerating(true);
    setBullets([]);

    try {
      if (aiEngine === 'GITHUB_MODELS') {
        const res = await api.ai.summarizeWithGitHubModels({
          prs: activities.map((a) => ({
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
      } else {
        const supported = await isWebGPUSupported();
        if (!supported) {
          setAiError(dict.aiConsole.webgpuUnsupported);
          setIsGenerating(false);
          return;
        }

        const lines = await runWebLLMSummary(
          selectedModel,
          activities.map((a) => ({
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

        const totalCommits = activities.reduce((sum, pr) => sum + pr.commits.length, 0);
        await api.ai.saveClientSummary({
          summary: lines,
          modelName: selectedModel,
          prCount: activities.length,
          commitCount: totalCommits,
          engine: 'WEB_LLM',
          metadata: { prs: activities },
        });
      }
    } catch (err) {
      setAiError((err as Error).message || dict.aiConsole.generateFailed);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isAuthLoading) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center min-h-dvh p-4">
        <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        </div>
        <p className="text-xs font-mono text-slate-400 mt-3">{dict.auth.workspaceLoading}</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 min-h-dvh">
        <div className="mb-6 text-center max-w-sm">
          <p className="text-xs font-mono uppercase tracking-wider text-sky-400 font-semibold">
            {dict.header.brand}
          </p>
          <p className="text-xs text-slate-400 mt-1">{dict.auth.brandTagline}</p>
        </div>

        <AuthModal
          isOpen={true}
          onClose={() => {}}
          variant="inline"
          onOpenGoogleChooser={openGoogleChooser}
          externalError={authError}
        />

        <GoogleAccountChooserModal
          isOpen={isGoogleChooserOpen}
          onClose={closeGoogleChooser}
          onSelectAccount={handleAccountSelect}
          appName="Git Pulse"
        />
      </main>
    );
  }

  return (
    <>
      <Header
        user={user}
        gitStatus={gitStatus}
        onOpenHistory={() => setIsHistoryModalOpen(true)}
        onOpenGitModal={() => setIsGitModalOpen(true)}
        onLogout={logout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Clean Workspace Title */}
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">
            {dict.workspace.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">{dict.workspace.subtitle}</p>
        </div>

        {/* GitHub Onboarding Callout */}
        {!gitStatus.connected && (
          <div className="rounded-xl bg-amber-500/[0.06] border border-amber-500/25 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 gp-fade-in">
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <div
                className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0"
                aria-hidden="true"
              >
                <GitBranch className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-100">{dict.onboarding.title}</h2>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  {dict.onboarding.description}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsGitModalOpen(true)}
              className="inline-flex items-center justify-center min-h-[38px] px-4 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] transition-all shrink-0 cursor-pointer"
            >
              {dict.onboarding.connectNow}
            </button>
          </div>
        )}

        {/* Main 12-Column Responsive Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 min-w-0">
            <ActivityScanner
              activities={activities}
              isLoading={isScanning}
              error={scanError}
              onScan={handleScanActivity}
              sinceOption={sinceOption}
              onSinceOptionChange={(opt) => {
                setSinceOption(opt);
                setScanError(null);
              }}
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
              hasPrs={activities.length > 0}
            />

            <StandupOutputDock
              bullets={bullets}
              modelUsed={modelUsed}
              reportLanguage={generatedLanguage}
            />
          </div>
        </div>
      </main>

      <GitHubConnectModal
        isOpen={isGitModalOpen}
        onClose={() => setIsGitModalOpen(false)}
        status={gitStatus}
        onSavePat={handleSavePat}
        onDisconnect={handleDisconnectGit}
      />

      <ReportHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
      />
    </>
  );
}
