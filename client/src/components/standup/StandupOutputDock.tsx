'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, Loader2, Pencil, Send, Settings } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { ShowcaseCard } from '../ui/ShowcaseCard';
import { Skeleton } from '../ui/Skeleton';
import { useToast } from '../ui/Toast';
import { useSmoothButtonWidth } from '../../lib/use-smooth-button-width';

interface StandupOutputDockProps {
  bullets: string[];
  isGenerating?: boolean;
  onUpdateBullets?: (updated: string[]) => void;
  onOpenReportSettings: () => void;
  onOpenParabolSubmit?: () => void;
  showParabolAction?: boolean;
}

export function StandupOutputDock({
  bullets,
  isGenerating = false,
  onUpdateBullets,
  onOpenReportSettings,
  onOpenParabolSubmit,
  showParabolAction = false,
}: StandupOutputDockProps) {
  const { dict } = useTranslation();
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState('');
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editBtnRef = useSmoothButtonWidth(isEditing);
  const copyBtnRef = useSmoothButtonWidth(copied);

  const formatFullStandup = (items: string[]) => {
    return ['Today:', ...items.map((b) => `• ${b}`)].join('\n');
  };

  useEffect(() => {
    setDraftText(formatFullStandup(bullets));
    setIsEditing(false);
  }, [bullets]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const activeBullets = isEditing
    ? draftText
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !/^today:?$/i.test(l))
        .map((l) => l.replace(/^[-*•]\s*/, '').trim())
        .filter((l) => l.length > 0)
    : bullets;

  const standupText =
    isEditing && draftText.trim().length > 0 ? draftText.trim() : formatFullStandup(activeBullets);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(standupText);
      setCopied(true);
      showToast({
        title: dict.standupDock.copiedToast,
        variant: 'success',
      });
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2200);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const handleToggleEdit = () => {
    if (isEditing && onUpdateBullets) {
      const normalized = draftText
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !/^today:?$/i.test(l))
        .map((l) => l.replace(/^[-*•]\s*/, '').trim())
        .filter((l) => l.length > 0);
      onUpdateBullets(normalized);
      setIsEditing(false);
      return;
    }
    setDraftText(bullets.length > 0 ? formatFullStandup(bullets) : 'Today:\n• ');
    setIsEditing(true);
  };

  const hasContent = activeBullets.length > 0;

  return (
    <ShowcaseCard
      as="section"
      aria-labelledby="standup-output-heading"
      className="p-5 sm:p-6 gp-fade-in gp-completion-once"
    >
      <div className="space-y-4">
        {/* Header & Action Controls */}
        <div className="flex flex-col gap-3 border-b border-slate-700/80 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="standup-output-heading"
                className="text-base font-semibold text-slate-100 tracking-tight"
              >
                {dict.standupDock.title}
              </h2>
              <p className="text-xs text-slate-400 mt-1">{dict.standupDock.subtitle}</p>
            </div>

            <button
              type="button"
              onClick={onOpenReportSettings}
              title={dict.standupDock.reportSettingsBtn}
              aria-label={dict.standupDock.reportSettingsBtn}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.14] hover:border-white/[0.24] transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
            >
              <Settings className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {/* Edit & Copy Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {onUpdateBullets && (
              <button
                ref={editBtnRef}
                type="button"
                disabled={isGenerating}
                onClick={handleToggleEdit}
                className={`inline-flex items-center justify-center gap-1.5 min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 overflow-hidden whitespace-nowrap ${
                  isEditing
                    ? 'bg-sky-500 text-slate-950 border-sky-500 font-semibold'
                    : 'bg-[#253349] hover:bg-[#2E3E58] text-slate-200 border-slate-600/80'
                }`}
              >
                <span
                  key={String(isEditing)}
                  className="inline-flex items-center gap-1.5 animate-[gp-fade-in_180ms_cubic-bezier(0.16,1,0.3,1)_both]"
                >
                  {isEditing ? (
                    <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <Pencil className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                  )}
                  <span>{isEditing ? dict.common.done : dict.common.edit}</span>
                </span>
              </button>
            )}

            <button
              ref={copyBtnRef}
              type="button"
              disabled={isGenerating || !hasContent}
              onClick={() => void handleCopy()}
              className={`inline-flex items-center justify-center gap-1.5 min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 overflow-hidden whitespace-nowrap ${
                copied
                  ? 'bg-emerald-500 text-slate-950 border-emerald-500 font-semibold'
                  : 'bg-white/[0.08] hover:bg-white/[0.14] text-slate-100 border-white/[0.16] hover:border-white/[0.26]'
              }`}
            >
              <span
                key={String(copied)}
                className="inline-flex items-center gap-1.5 animate-[gp-fade-in_180ms_cubic-bezier(0.16,1,0.3,1)_both]"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-300 shrink-0" aria-hidden="true" />
                )}
                <span>{copied ? dict.common.copied : dict.common.copy}</span>
              </span>
            </button>

            {showParabolAction && onOpenParabolSubmit && (
              <button
                type="button"
                disabled={isGenerating || !hasContent}
                onClick={onOpenParabolSubmit}
                className="inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-semibold border border-sky-400/40 text-sky-200 hover:text-slate-950 bg-sky-500/15 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-sky-500/15 disabled:hover:text-sky-200 transition-colors cursor-pointer active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
              >
                <Send className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{dict.standupDock.sendToParabolBtn}</span>
              </button>
            )}
          </div>
        </div>

        {/* Standup Output Editor or Staggered Bullet View */}
        {isGenerating ? (
          <div
            aria-busy="true"
            aria-label={dict.standupDock.generatingTitle}
            className="p-4 sm:p-5 rounded-lg bg-[#152033] border border-slate-700/80 space-y-3"
          >
            <div className="flex items-center gap-2 text-xs text-sky-300 font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
              <span>{dict.standupDock.generatingTitle}</span>
            </div>
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center gap-3">
                <Skeleton className="w-2 h-2 rounded-full shrink-0" />
                <Skeleton className="w-11/12 h-3.5" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="w-2 h-2 rounded-full shrink-0" />
                <Skeleton className="w-4/5 h-3.5" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="w-2 h-2 rounded-full shrink-0" />
                <Skeleton className="w-5/6 h-3.5" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="w-2 h-2 rounded-full shrink-0" />
                <Skeleton className="w-2/3 h-3.5" />
              </div>
            </div>
          </div>
        ) : isEditing ? (
          <textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder={dict.standupDock.editPlaceholder}
            rows={Math.max(4, activeBullets.length + 1)}
            aria-label={dict.common.edit}
            className="w-full p-4 rounded-lg bg-[#152033] border border-sky-400/70 focus:ring-2 focus:ring-sky-500/25 text-xs text-slate-100 placeholder:text-slate-400 leading-relaxed outline-none resize-y"
          />
        ) : hasContent ? (
          <div className="p-4 sm:p-5 rounded-lg bg-[#152033] border border-slate-700/80 text-xs text-slate-200 leading-relaxed selection:bg-sky-500/30 selection:text-sky-100">
            <div className="text-slate-200 font-semibold mb-2 select-none">Today:</div>
            <ul role="list" className="space-y-2">
              {activeBullets.map((bullet, idx) => (
                <li
                  key={`${idx}-${bullet.slice(0, 12)}`}
                  style={{ '--stagger-idx': idx } as React.CSSProperties}
                  className="flex items-start gap-2.5 gp-stagger-item"
                >
                  <span className="text-sky-400 font-bold select-none shrink-0" aria-hidden="true">
                    •
                  </span>
                  <span className="break-words min-w-0">{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="p-4 sm:p-5 rounded-lg bg-[#152033] border border-slate-700/80 text-xs text-slate-400 leading-relaxed">
            {dict.standupDock.emptyHint}
          </div>
        )}
      </div>
    </ShowcaseCard>
  );
}
