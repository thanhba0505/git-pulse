"use client";

import React, { useState } from "react";
import { Copy, Check, Terminal, Share2, Send } from "lucide-react";

interface StandupOutputDockProps {
  bullets: string[];
  rawText?: string;
  modelUsed?: string;
  engineUsed?: string;
}

export function StandupOutputDock({
  bullets,
  modelUsed,
}: StandupOutputDockProps) {
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  if (!bullets || bullets.length === 0) return null;

  const copyToClipboard = (text: string, formatName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFormat(formatName);
    setTimeout(() => setCopiedFormat(null), 2500);
  };

  const standupText = bullets.map((b) => `• ${b}`).join("\n");

  const parabolText =
    `**Yesterday / Recent Outcomes:**\n` +
    bullets.map((b) => `• ${b}`).join("\n") +
    `\n\n**Today Plan:**\n• Tiếp tục hoàn thiện các luồng phát triển và review PR.\n\n**Blockers:**\n• Không có`;

  const slackText =
    `:rocket: *Daily Standup Summary*\n` +
    bullets.map((b) => `• ${b}`).join("\n");

  return (
    <div className="astral-card rounded-2xl p-6 sm:p-7 border border-emerald-500/30 shadow-[0_0_35px_rgba(16,185,129,0.12)] space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide uppercase">
              Bản Báo Cáo Daily Standup Đã Sẵn Sàng
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {modelUsed ? `${modelUsed} • ` : ""}Nhấp vào các nút bên phải để
              sao chép theo định dạng mong muốn.
            </p>
          </div>
        </div>

        {/* 1-Click Copy Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => copyToClipboard(standupText, "STANDUP")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              copiedFormat === "STANDUP"
                ? "bg-emerald-500 text-void font-bold shadow-[0_0_15px_rgba(16,185,129,0.6)]"
                : "bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30"
            }`}
          >
            {copiedFormat === "STANDUP" ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>
              {copiedFormat === "STANDUP"
                ? "Đã chép Standup!"
                : "Chép Bullet (•)"}
            </span>
          </button>

          <button
            onClick={() => copyToClipboard(parabolText, "PARABOL")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              copiedFormat === "PARABOL"
                ? "bg-cyan-500 text-void font-bold shadow-[0_0_15px_rgba(6,182,212,0.6)]"
                : "bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/30"
            }`}
          >
            {copiedFormat === "PARABOL" ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Share2 className="w-3.5 h-3.5" />
            )}
            <span>
              {copiedFormat === "PARABOL" ? "Đã chép Parabol!" : "Dạng Parabol"}
            </span>
          </button>

          <button
            onClick={() => copyToClipboard(slackText, "SLACK")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              copiedFormat === "SLACK"
                ? "bg-purple-500 text-white font-bold shadow-[0_0_15px_rgba(168,85,247,0.6)]"
                : "bg-purple-950/50 hover:bg-purple-900/60 text-purple-300 border border-purple-500/30"
            }`}
          >
            {copiedFormat === "SLACK" ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>
              {copiedFormat === "SLACK" ? "Đã chép Slack!" : "Dạng Slack"}
            </span>
          </button>
        </div>
      </div>

      {/* Standup Content Box */}
      <div className="p-5 sm:p-6 rounded-xl bg-void-subtle/90 border border-slate-700/80 font-mono text-sm space-y-3 text-slate-100 selection:bg-cyan-500 selection:text-void leading-relaxed">
        {bullets.map((bullet, idx) => (
          <div key={idx} className="flex items-start gap-3 leading-relaxed">
            <span className="text-emerald-400 font-bold select-none text-base">
              •
            </span>
            <span>{bullet}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
