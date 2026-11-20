'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, Pencil } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { ShowcaseCard } from '../ui/ShowcaseCard';
import { StandupOutputSkeleton } from '../ui/Skeleton';
import { useToast } from '../ui/Toast';

interface StandupOutputDockProps {
  bullets: string[];
  isGenerating?: boolean;
  modelUsed?: string;
  onUpdateBullets?: (updated: string[]) => void;
}

export function StandupOutputDock({
  bullets,
  isGenerating = false,
  modelUsed,
  onUpdateBullets,
}: StandupOutputDockProps) {
  const { dict } = useTranslation();
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState('');
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  if (isGenerating && (!bullets || bullets.length === 0)) {
    return <StandupOutputSkeleton />;
  }

  if (!bullets || bullets.length === 0) return null;

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
      if (normalized.length > 0) {
        onUpdateBullets(normalized);
      }
      setIsEditing(false);
      return;
    }
    setDraftText(formatFullStandup(bullets));
    setIsEditing(true);
  };

  return (
    <ShowcaseCard
      as="section"
      aria-labelledby="standup-output-heading"
      className="p-5 sm:p-6 gp-fade-in gp-completion-once"
    >
      <div className="space-y-4">
        {/* Header & Action Controls */}
        <div className="flex flex-col gap-3 border-b border-slate-700/80 pb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
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

          {/* Edit & Copy Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {onUpdateBullets && (
              <button
                type="button"
                onClick={handleToggleEdit}
                className={`inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
                  isEditing
                    ? 'bg-sky-500 text-slate-950 border-sky-500 font-semibold'
                    : 'bg-[#253349] hover:bg-[#2E3E58] text-slate-200 border-slate-600/80'
                }`}
              >
                {isEditing ? (
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <Pencil className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                )}
                <span>{isEditing ? dict.common.done : dict.common.edit}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void handleCopy()}
              className={`inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
                copied
                  ? 'bg-emerald-500 text-slate-950 border-emerald-500 font-semibold'
                  : 'bg-white/[0.08] hover:bg-white/[0.14] text-slate-100 border-white/[0.16] hover:border-white/[0.26]'
              }`}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
              )}
              <span>{copied ? dict.common.copied : dict.common.copy}</span>
            </button>
          </div>
        </div>

        {/* Standup Output Editor or Staggered Bullet View */}
        {isEditing ? (
          <textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder={dict.standupDock.editPlaceholder}
            rows={Math.max(4, activeBullets.length + 1)}
            aria-label={dict.common.edit}
            className="w-full p-4 rounded-lg bg-[#152033] border border-sky-400/70 focus:ring-2 focus:ring-sky-500/25 font-mono text-xs sm:text-sm text-slate-100 placeholder:text-slate-400 leading-relaxed outline-none resize-y"
          />
        ) : (
          <div className="p-4 sm:p-5 rounded-lg bg-[#152033] border border-slate-700/80 font-mono text-xs sm:text-sm text-slate-100 leading-relaxed selection:bg-sky-500/30 selection:text-sky-100">
            <div className="text-slate-200 font-semibold mb-2.5 select-none">Today:</div>
            <ul role="list" className="space-y-2.5">
              {activeBullets.map((bullet, idx) => (
                <li
                  key={`${idx}-${bullet.slice(0, 12)}`}
                  style={{ '--stagger-idx': idx } as React.CSSProperties}
                  className="flex items-start gap-3 gp-stagger-item"
                >
                  <span className="text-sky-400 font-bold select-none" aria-hidden="true">
                    •
                  </span>
                  <span className="break-words min-w-0">{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ShowcaseCard>
  );
}
