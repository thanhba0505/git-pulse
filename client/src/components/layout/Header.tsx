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
    <header className="sticky top-0 z-40 w-full border-b border-cyan-500/20 bg-void/80 backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-emerald-500 shadow-[0_0_25px_rgba(6,182,212,0.5)]">
            <Orbit className="w-5 h-5 text-white animate-orbit-spin" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-pulsar-emerald animate-ping" />
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight shimmer-text">
              Git Pulse
            </span>
            <p className="text-xs text-slate-400 hidden sm:block">
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

          {/* Git Connection Status */}
          {gitStatus.connected ? (
            <button
              onClick={onOpenGitModal}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-mono text-emerald-300 bg-emerald-950/30 hover:bg-emerald-950/50 border border-emerald-500/25 hover:border-emerald-400/50 transition-all"
              title="GitHub đã kết nối. Nhấn để quản lý."
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span>@{gitStatus.gitUsername}</span>
            </button>
          ) : (
            <button
              onClick={onOpenGitModal}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium text-amber-300 bg-amber-950/25 hover:bg-amber-950/45 border border-amber-500/30 hover:border-amber-400/50 transition-all"
            >
              <GitBranch className="w-3.5 h-3.5 text-amber-400" />
              <span>Kết nối Git</span>
            </button>
          )}

          {/* User Profile */}
          {user && (
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-800">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-900 to-indigo-900 border border-cyan-400/30 flex items-center justify-center text-xs font-bold text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.25)]">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden lg:block text-left text-xs">
                <p className="font-medium text-slate-200 truncate max-w-[120px]">
                  {user.username}
                </p>
                <p className="text-xs text-slate-400 truncate max-w-[140px]">
                  {user.email}
                </p>
              </div>
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
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
