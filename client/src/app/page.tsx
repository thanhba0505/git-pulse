"use client";

import React, { useEffect, useState, useCallback } from "react";
import { GitStatus, PrActivity, AiEngine } from "../types";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { runWebLLMSummary, isWebGPUSupported } from "../lib/webllm";
import { Header } from "../components/layout/Header";
import { GitHubConnectModal } from "../components/github/GitHubConnectBanner";
import { ActivityScanner } from "../components/dashboard/ActivityScanner";
import { CockpitAiConsole } from "../components/ai/CockpitAiConsole";
import { StandupOutputDock } from "../components/standup/StandupOutputDock";
import { ReportHistoryModal } from "../components/history/ReportHistoryModal";
import { AuthModal } from "../components/auth/AuthModal";
import { GoogleAccountChooserModal } from "../components/auth/GoogleAccountChooserModal";
import { Orbit, GitBranch } from "lucide-react";

export default function HomePage() {
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
  const [sinceOption, setSinceOption] = useState<"today" | "24h" | "7d">(
    "today",
  );

  const [aiEngine, setAiEngine] = useState<AiEngine>("GITHUB_MODELS");
  const [selectedModel, setSelectedModel] = useState<string>("gpt-4o-mini");
  const [language, setLanguage] = useState<"vi" | "en">("vi");

  const [isGenerating, setIsGenerating] = useState(false);
  const [webLlmProgressText, setWebLlmProgressText] = useState<string>("");
  const [webLlmProgressPercent, setWebLlmProgressPercent] = useState<number>(0);

  const [bullets, setBullets] = useState<string[]>([]);
  const [modelUsed, setModelUsed] = useState<string>("");

  // 1. Fetch Git Status when user is logged in
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

  // 2. Scan Git PRs & Commits
  const handleScanActivity = useCallback(async () => {
    setIsScanning(true);
    try {
      let sinceDate: string | undefined;
      const now = new Date();
      if (sinceOption === "today") {
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        sinceDate = today.toISOString();
      } else if (sinceOption === "24h") {
        const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        sinceDate = past.toISOString();
      } else if (sinceOption === "7d") {
        const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        sinceDate = past.toISOString();
      }

      const data = await api.github.getActivity(sinceDate);
      setActivities(data);
    } catch (err) {
      alert((err as Error).message || "Không thể quét hoạt động Git.");
    } finally {
      setIsScanning(false);
    }
  }, [sinceOption]);

  useEffect(() => {
    if (user) {
      loadGitStatus().then((status) => {
        if (status.connected) {
          handleScanActivity();
        }
      });
    }
  }, [user, loadGitStatus, handleScanActivity]);

  // Google Account Chooser Selection Handler
  const handleAccountSelect = async (account: {
    username: string;
    email: string;
    name: string;
    googleId?: string;
  }) => {
    const result = await loginWithGoogle({
      email: account.email,
      name: account.name,
      googleId: account.googleId || `google_${Date.now()}`,
    });

    if (!result.success) {
      alert(result.error || "Đăng nhập Google thất bại");
    }
  };

  // Save PAT
  const handleSavePat = async (token: string) => {
    await api.github.savePat(token);
    await loadGitStatus();
    await handleScanActivity();
  };

  // Disconnect GitHub
  const handleDisconnectGit = async () => {
    await api.github.disconnect();
    setGitStatus({ connected: false });
    setActivities([]);
  };

  // Generate Standup Summary (Dual-Engine: GitHub Models or WebLLM)
  const handleGenerateSummary = async () => {
    if (activities.length === 0) {
      alert("Không có commit nào trong phạm vi quét.");
      return;
    }

    setIsGenerating(true);
    setBullets([]);

    try {
      if (aiEngine === "GITHUB_MODELS") {
        const res = await api.ai.summarizeWithGitHubModels({
          prs: activities.map((a) => ({
            repo: a.repo,
            title: a.title,
            commits: a.commits,
          })),
          model: selectedModel,
          language,
        });
        setBullets(res.bullets);
        setModelUsed(`GitHub Models (${res.modelUsed})`);
      } else {
        // WebLLM Engine (In-Browser WebGPU)
        const supported = await isWebGPUSupported();
        if (!supported) {
          alert(
            "Trình duyệt của bạn chưa hỗ trợ WebGPU. Vui lòng chuyển sang GitHub Models hoặc bật WebGPU trong chrome://flags.",
          );
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
          language,
          (prog) => {
            setWebLlmProgressText(prog.text);
            setWebLlmProgressPercent(prog.progress);
          },
        );

        setBullets(lines);
        setModelUsed(`WebGPU (${selectedModel.split("-")[0]})`);

        // Persist to history in database
        const totalCommits = activities.reduce(
          (sum, pr) => sum + pr.commits.length,
          0,
        );
        await api.ai.saveClientSummary({
          summary: lines,
          modelName: selectedModel,
          prCount: activities.length,
          commitCount: totalCommits,
          engine: "WEB_LLM",
          metadata: { prs: activities },
        });
      }
    } catch (err) {
      alert((err as Error).message || "Tóm tắt AI thất bại.");
    } finally {
      setIsGenerating(false);
    }
  };

  const totalCommitsToday = activities.reduce(
    (sum, pr) => sum + pr.commits.length,
    0,
  );

  // Loading Screen
  if (isAuthLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-500 flex items-center justify-center animate-spin">
          <Orbit className="w-6 h-6 text-white" />
        </div>
        <p className="text-xs font-mono text-cyan-300 mt-4 tracking-wider animate-pulse">
          KHỞI ĐỘNG CỔNG KHÔNG GIAN GIT PULSE...
        </p>
      </div>
    );
  }

  // 1. Unauthenticated State -> Render the exact Auth Modal
  if (!user) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-4 min-h-screen">
        <AuthModal
          isOpen={true}
          onClose={() => {}}
          onOpenGoogleChooser={openGoogleChooser}
        />

        {/* Google Account Chooser Modal (Popup on click Google) */}
        <GoogleAccountChooserModal
          isOpen={isGoogleChooserOpen}
          onClose={closeGoogleChooser}
          onSelectAccount={handleAccountSelect}
          appName="Git Pulse"
        />
      </main>
    );
  }

  // 2. Authenticated State -> Mission Control Dashboard
  return (
    <>
      <Header
        user={user}
        gitStatus={gitStatus}
        commitCount={totalCommitsToday}
        onOpenHistory={() => setIsHistoryModalOpen(true)}
        onOpenGitModal={() => setIsGitModalOpen(true)}
        onLogout={logout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Onboarding Callout if GitHub is NOT connected */}
        {!gitStatus.connected && (
          <div className="astral-card rounded-2xl p-6 sm:p-7 border border-amber-500/40 bg-amber-950/20 flex flex-col sm:flex-row items-center justify-between gap-5 animate-in fade-in duration-300">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300">
                <GitBranch className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide uppercase">
                  Chưa Kết Nối Quỹ Đạo GitHub
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Để quét PR và commit hôm nay, hãy kết nối tài khoản GitHub qua
                  Personal Access Token (PAT).
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsGitModalOpen(true)}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-void bg-gradient-to-r from-amber-400 to-amber-300 hover:brightness-110 transition-all shadow-[0_0_20px_rgba(245,158,11,0.4)] shrink-0"
            >
              Kết Nối Ngay
            </button>
          </div>
        )}

        {/* Dashboard Grid: Scanner on Left/Top, AI Console & Output on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Git Activity Radar (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <ActivityScanner
              activities={activities}
              isLoading={isScanning}
              onScan={handleScanActivity}
              sinceOption={sinceOption}
              onSinceOptionChange={(opt) => {
                setSinceOption(opt);
              }}
            />
          </div>

          {/* Right Column: AI Console & Generated Standup Dock (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <CockpitAiConsole
              engine={aiEngine}
              onEngineChange={setAiEngine}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              language={language}
              onLanguageChange={setLanguage}
              onGenerate={handleGenerateSummary}
              isGenerating={isGenerating}
              webLlmProgressText={webLlmProgressText}
              webLlmProgressPercent={webLlmProgressPercent}
              hasPrs={activities.length > 0}
            />

            {/* Generated Standup Output */}
            <StandupOutputDock
              bullets={bullets}
              modelUsed={modelUsed}
              engineUsed={aiEngine}
            />
          </div>
        </div>
      </main>

      {/* GitHub Connect Modal */}
      <GitHubConnectModal
        isOpen={isGitModalOpen}
        onClose={() => setIsGitModalOpen(false)}
        status={gitStatus}
        onSavePat={handleSavePat}
        onDisconnect={handleDisconnectGit}
      />

      {/* History Modal */}
      <ReportHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
      />
    </>
  );
}
