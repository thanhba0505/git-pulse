"use client";

import React from "react";
import { PrActivity } from "../../types";
import { Radar, GitPullRequest, GitCommit, ExternalLink } from "lucide-react";

interface ActivityScannerProps {
  activities: PrActivity[];
  isLoading: boolean;
  onScan: () => void;
  sinceOption: "today" | "24h" | "7d";
  onSinceOptionChange: (opt: "today" | "24h" | "7d") => void;
}

export function ActivityScanner({
  activities,
  isLoading,
  onScan,
  sinceOption,
  onSinceOptionChange,
}: ActivityScannerProps) {
  const totalCommits = activities.reduce(
    (sum, pr) => sum + pr.commits.length,
    0,
  );

  return (
    <div className="space-y-5">
      {/* Scanner Control Deck */}
      <div className="astral-card rounded-2xl p-6 sm:p-7 flex flex-col sm:flex-row items-center justify-between gap-5 border border-pulsar-cyan/25">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-400/25 text-cyan-300">
            <Radar
              className={`w-5 h-5 ${isLoading ? "animate-spin text-pulsar-cyan" : ""}`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                Chòm Sao Quỹ Đạo Git
              </h2>
              {activities.length > 0 && (
                <span className="text-xs font-mono text-cyan-400">
                  ({activities.length} PRs • {totalCommits} Commits)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Quét các Pull Request và commit bạn đã thực hiện trong khoảng thời
              gian đã chọn.
            </p>
          </div>
        </div>

        {/* Date Filter & Trigger */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <div className="flex items-center bg-void-subtle rounded-xl p-1 border border-slate-700/80 text-xs">
            <button
              onClick={() => onSinceOptionChange("today")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                sinceOption === "today"
                  ? "bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-400/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Hôm nay
            </button>
            <button
              onClick={() => onSinceOptionChange("24h")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                sinceOption === "24h"
                  ? "bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-400/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              24h qua
            </button>
            <button
              onClick={() => onSinceOptionChange("7d")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                sinceOption === "7d"
                  ? "bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-400/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              7 ngày
            </button>
          </div>

          <button
            onClick={onScan}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-void bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-50"
          >
            <Radar
              className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
            />
            <span>{isLoading ? "Đang quét..." : "Quét Git"}</span>
          </button>
        </div>
      </div>

      {/* Activities Orbit Grid */}
      {activities.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {activities.map((pr) => (
            <div
              key={`${pr.repo}#${pr.number}`}
              className="astral-card astral-card-interactive rounded-2xl p-5 sm:p-6 border border-slate-700/60 hover:border-cyan-500/40"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-400/20 mt-0.5">
                    <GitPullRequest className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-cyan-300 font-semibold">
                        {pr.repo}
                      </span>
                      <span className="text-slate-500">•</span>
                      <span className="font-mono text-xs text-slate-400">
                        #{pr.number}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-xs font-mono font-medium ${
                          pr.state === "open"
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                        }`}
                      >
                        {pr.state.toUpperCase()}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-white mt-1.5 leading-snug">
                      {pr.title}
                    </h3>
                  </div>
                </div>

                <a
                  href={pr.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60 transition-colors"
                  title="Mở PR trên GitHub"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              {/* Commit Nodes Timeline */}
              <div className="mt-4 pt-3.5 border-t border-slate-800/80 space-y-2">
                <p className="text-xs font-mono text-slate-400 flex items-center gap-2">
                  <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
                  {pr.commits.length} commit trong phạm vi quét:
                </p>
                <div className="space-y-1.5 pl-4 border-l-2 border-cyan-500/20">
                  {pr.commits.map((commit, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-xs text-slate-300"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <span className="truncate">{commit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="astral-card rounded-2xl p-10 sm:p-12 text-center border border-slate-800">
          <div className="w-12 h-12 mx-auto mb-3.5 rounded-full bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
            <Radar className="w-6 h-6 animate-pulse" />
          </div>
          <h3 className="text-sm font-bold text-white mb-1.5">
            Chưa có tín hiệu Commit/PR nào trên quỹ đạo
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-5">
            Nhấn nút &ldquo;Quét Git&rdquo; ở trên để bắt đầu đồng bộ các PR và
            commit bạn đã tạo hôm nay trên GitHub.
          </p>
          <button
            onClick={onScan}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-cyan-300 hover:text-white bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-500/30 transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)]"
          >
            Quét Ngay
          </button>
        </div>
      )}
    </div>
  );
}
