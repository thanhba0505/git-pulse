'use client';

import React, { useState } from 'react';
import { Copy, Check, Share2, Send } from 'lucide-react';
import { useTranslation, vi, en } from '../../i18n';

interface StandupOutputDockProps {
  bullets: string[];
  modelUsed?: string;
  reportLanguage?: 'vi' | 'en';
}

export function StandupOutputDock({
  bullets,
  modelUsed,
  reportLanguage = 'vi',
}: StandupOutputDockProps) {
  const { dict } = useTranslation();
  const [copiedFormat, setCopiedFormat] = useState<'STANDUP' | 'PARABOL' | 'SLACK' | null>(null);

  if (!bullets || bullets.length === 0) return null;

  const copyToClipboard = (text: string, formatName: 'STANDUP' | 'PARABOL' | 'SLACK') => {
    navigator.clipboard.writeText(text);
    setCopiedFormat(formatName);
    setTimeout(() => setCopiedFormat(null), 2500);
  };

  const templateDict = (reportLanguage === 'en' ? en : vi).standupDock;

  const standupText = bullets.map((b) => `• ${b}`).join('\n');

  const parabolText =
    `${templateDict.parabolYesterday}\n` +
    bullets.map((b) => `• ${b}`).join('\n') +
    `\n\n${templateDict.parabolToday}\n\n${templateDict.parabolBlockers}`;

  const slackText = `${templateDict.slackHeader}\n` + bullets.map((b) => `• ${b}`).join('\n');

  return (
    <section
      aria-labelledby="standup-output-heading"
      className="gp-card rounded-xl p-5 sm:p-6 space-y-4 gp-fade-in"
    >
      {/* Header & Copy Actions */}
      <div className="flex flex-col gap-3 border-b border-slate-800/80 pb-4">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2
              id="standup-output-heading"
              className="text-base font-semibold text-slate-100 tracking-tight"
            >
              {dict.standupDock.title}
            </h2>
            {modelUsed && (
              <span className="text-xs font-mono text-slate-400 truncate max-w-full">
                {modelUsed}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">{dict.standupDock.subtitle}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => copyToClipboard(standupText, 'STANDUP')}
            className={`inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
              copiedFormat === 'STANDUP'
                ? 'bg-emerald-500 text-slate-950 border-emerald-500 font-semibold'
                : 'bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
            }`}
          >
            {copiedFormat === 'STANDUP' ? (
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>
              {copiedFormat === 'STANDUP'
                ? dict.standupDock.copiedBullet
                : dict.standupDock.copyBullet}
            </span>
          </button>

          <button
            type="button"
            onClick={() => copyToClipboard(parabolText, 'PARABOL')}
            className={`inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
              copiedFormat === 'PARABOL'
                ? 'bg-sky-500 text-slate-950 border-sky-500 font-semibold'
                : 'bg-[#161A24] hover:bg-[#191E2A] text-slate-200 border-slate-700/80'
            }`}
          >
            {copiedFormat === 'PARABOL' ? (
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Share2 className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            )}
            <span>
              {copiedFormat === 'PARABOL'
                ? dict.standupDock.copiedParabol
                : dict.standupDock.copyParabol}
            </span>
          </button>

          <button
            type="button"
            onClick={() => copyToClipboard(slackText, 'SLACK')}
            className={`inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
              copiedFormat === 'SLACK'
                ? 'bg-sky-500 text-slate-950 border-sky-500 font-semibold'
                : 'bg-[#161A24] hover:bg-[#191E2A] text-slate-200 border-slate-700/80'
            }`}
          >
            {copiedFormat === 'SLACK' ? (
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Send className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            )}
            <span>
              {copiedFormat === 'SLACK' ? dict.standupDock.copiedSlack : dict.standupDock.copySlack}
            </span>
          </button>
        </div>
      </div>

      {/* Clean Monospace Output Surface */}
      <div className="p-4 sm:p-5 rounded-lg bg-[#0C0E14] border border-slate-800 font-mono text-xs sm:text-sm text-slate-200 leading-relaxed selection:bg-sky-500/30 selection:text-sky-100">
        <ul role="list" className="space-y-2.5">
          {bullets.map((bullet, idx) => (
            <li key={idx} className="flex items-start gap-3">
              <span className="text-sky-400 font-bold select-none" aria-hidden="true">
                •
              </span>
              <span className="break-words min-w-0">{bullet}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
