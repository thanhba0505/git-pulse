"use client";

import React from "react";
import { User, GitStatus } from "../../types";
import { PulsarWave } from "../cosmic/PulsarWave";
import { Orbit, GitBranch, History, LogOut } from "lucide-react";

interface HeaderProps {
  user: User | null;
  gitStatus: GitStatus;
  commitCount: number;
  onOpenHistory: () => void;
  onOpenGitModal: () => void;
  onLogout: () => void;
}

export function Header({
  user,
  gitStatus,
  commitCount,
  onOpenHistory,
  onOpenGitModal,
  onLogout,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-pulsar-cyan/15 bg-void/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-500 shadow-[0_0_20px_rgba(6,182,212,0.4)]">
            <Orbit className="w-5 h-5 text-white animate-orbit-spin" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-pulsar-emerald animate-ping" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-cyan-100 to-cyan-400 bg-clip-text text-transparent">
                Git-Pulse
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-cyan-500/10 border border-cyan-400/30 text-cyan-300">
                v0.1
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Celestial Git Radar & Standup Intelligence
            </p>
          </div>
        </div>

        {/* Center: Live Pulsar Frequency Waveform */}
        <div className="hidden md:flex items-center">
          <PulsarWave activityCount={commitCount} />
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center gap-3">
          {/* History Button */}
          <button
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-void-surface/60 hover:bg-void-surface border border-slate-700/60 hover:border-cyan-500/40 transition-all"
            title="Xem lịch sử báo cáo standup"
          >
            <History className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Lịch sử</span>
          </button>

          {/* Git Connection Status Pill */}
          {gitStatus.connected ? (
            <button
              onClick={onOpenGitModal}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 hover:border-emerald-400/60 transition-all"
              title="GitHub đã kết nối. Nhấn để quản lý."
            >
              <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
              <span>@{gitStatus.gitUsername}</span>
            </button>
          ) : (
            <button
              onClick={onOpenGitModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-300 bg-amber-950/30 border border-amber-500/30 hover:border-amber-400/60 animate-pulse transition-all"
            >
              <GitBranch className="w-3.5 h-3.5 text-amber-400" />
              <span>Kết nối Git</span>
            </button>
          )}

          {/* User Profile / Gateway IAM */}
          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-900 to-indigo-900 border border-cyan-400/30 flex items-center justify-center text-xs font-bold text-cyan-200">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden lg:block text-left text-xs">
                <p className="font-medium text-slate-200 truncate max-w-[100px]">
                  {user.username}
                </p>
                <p className="text-[10px] text-cyan-400/80 font-mono">
                  Gateway SSO
                </p>
              </div>
              <button
                onClick={onLogout}
                className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
