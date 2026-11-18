'use client';

import React, { useState, useEffect } from 'react';
import { Copy, Check, Share2, Send, FileText, ListTodo, Pencil } from 'lucide-react';
import { useTranslation, vi, en } from '../../i18n';
import { ShowcaseCard } from '../ui/ShowcaseCard';
import { StandupOutputSkeleton } from '../ui/Skeleton';
import { useToast } from '../ui/Toast';

interface StandupOutputDockProps {
  bullets: string[];
  isGenerating?: boolean;
  modelUsed?: string;
  reportLanguage?: 'vi' | 'en';
  onUpdateBullets?: (updated: string[]) => void;
}

type ExportFormat = 'STANDUP' | 'PARABOL' | 'SLACK' | 'MARKDOWN' | 'JIRA';

export function StandupOutputDock({
  bullets,
  isGenerating = false,
  modelUsed,
  reportLanguage = 'vi',
  onUpdateBullets,
}: StandupOutputDockProps) {
  const { dict, t } = useTranslation();
  const { showToast } = useToast();
  const [copiedFormat, setCopiedFormat] = useState<ExportFormat | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState('');

  useEffect(() => {
    setDraftText(bullets.join('\n'));
    setIsEditing(false);
  }, [bullets]);

  if (isGenerating && (!bullets || bullets.length === 0)) {
    return <StandupOutputSkeleton />;
  }

  if (!bullets || bullets.length === 0) return null;

  const activeBullets = isEditing
    ? draftText
        .split('\n')
        .map((l) => l.replace(/^[-*•]\s*/, '').trim())
        .filter((l) => l.length > 0)
    : bullets;

  const templateDict = (reportLanguage === 'en' ? en : vi).standupDock;

  const standupText = activeBullets.map((b) => `• ${b}`).join('\n');

  const parabolText =
    `${templateDict.parabolYesterday}\n` +
    activeBullets.map((b) => `• ${b}`).join('\n') +
    `\n\n${templateDict.parabolToday}\n\n${templateDict.parabolBlockers}`;

  const slackText = `${templateDict.slackHeader}\n` + activeBullets.map((b) => `• ${b}`).join('\n');

  const markdownText =
    `${templateDict.markdownHeader}\n\n` + activeBullets.map((b) => `- [x] ${b}`).join('\n');

  const jiraText = `${templateDict.jiraHeader}\n` + activeBullets.map((b) => `* ${b}`).join('\n');

  const copyToClipboard = (text: string, formatName: ExportFormat, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFormat(formatName);
    showToast({
      title: t('standupDock.copiedToast', { format: label }),
      variant: 'success',
    });
    setTimeout(() => setCopiedFormat(null), 2200);
  };

  const handleToggleEdit = () => {
    if (isEditing && onUpdateBullets) {
      const normalized = draftText
        .split('\n')
        .map((l) => l.replace(/^[-*•]\s*/, '').trim())
        .filter((l) => l.length > 0);
      if (normalized.length > 0) {
        onUpdateBullets(normalized);
      }
      setIsEditing(false);
      return;
    }
    setDraftText(bullets.join('\n'));
    setIsEditing(true);
  };

  const exportButtons: Array<{
    format: ExportFormat;
    label: string;
    text: string;
    Icon: React.ComponentType<{ className?: string }>;
  }> = [
    { format: 'STANDUP', label: dict.standupDock.copyBullet, text: standupText, Icon: Copy },
    { format: 'PARABOL', label: dict.standupDock.copyParabol, text: parabolText, Icon: Share2 },
    { format: 'SLACK', label: dict.standupDock.copySlack, text: slackText, Icon: Send },
    {
      format: 'MARKDOWN',
      label: dict.standupDock.copyMarkdown,
      text: markdownText,
      Icon: FileText,
    },
    { format: 'JIRA', label: dict.standupDock.copyJira, text: jiraText, Icon: ListTodo },
  ];

  return (
    <ShowcaseCard
      as="section"
      aria-labelledby="standup-output-heading"
      className="p-5 sm:p-6 gp-fade-in gp-completion-once"
    >
      <div className="space-y-4">
        {/* Header & Quick Edit Toggle */}
        <div className="flex flex-col gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-start justify-between gap-2">
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

            {onUpdateBullets && (
              <button
                type="button"
                onClick={handleToggleEdit}
                className={`inline-flex items-center gap-1.5 min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer shrink-0 ${
                  isEditing
                    ? 'bg-sky-500 text-slate-950 border-sky-500 font-semibold'
                    : 'bg-[#161A24] hover:bg-[#191E2A] text-slate-300 border-slate-700/80'
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
          </div>

          {/* Copy Export Bar */}
          <div className="flex items-center gap-2 flex-wrap">
            {exportButtons.map(({ format, label, text, Icon }) => {
              const isCopied = copiedFormat === format;
              return (
                <button
                  key={format}
                  type="button"
                  onClick={() => copyToClipboard(text, format, label)}
                  className={`inline-flex items-center gap-1.5 min-h-[32px] px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
                    isCopied
                      ? 'bg-emerald-500 text-slate-950 border-emerald-500 font-semibold'
                      : 'bg-white/[0.045] hover:bg-white/[0.09] text-slate-200 border-white/[0.09] hover:border-white/[0.18]'
                  }`}
                >
                  {isCopied ? (
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : (
                    <Icon className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                  )}
                  <span>{isCopied ? dict.common.copied : label}</span>
                </button>
              );
            })}
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
            className="w-full p-4 rounded-lg bg-[#090B10]/50 backdrop-blur-md border border-sky-400/60 focus:ring-2 focus:ring-sky-500/20 font-mono text-xs sm:text-sm text-slate-100 leading-relaxed outline-none resize-y"
          />
        ) : (
          <div className="p-4 sm:p-5 rounded-lg bg-[#090B10]/45 backdrop-blur-md border border-white/[0.08] font-mono text-xs sm:text-sm text-slate-200 leading-relaxed selection:bg-sky-500/30 selection:text-sky-100">
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
