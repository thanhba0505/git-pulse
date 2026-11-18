'use client';

import React, { useState } from 'react';
import { PrActivity, TaskColor, TrackingTask } from '../../types';
import { useTranslation } from '../../i18n';
import { formatRelativeTime, getPrKey } from '../../lib/activity-utils';
import { ShowcaseCard } from '../ui/ShowcaseCard';
import { DropdownMenu } from '../ui/DropdownMenu';
import {
  Building2,
  Check,
  ChevronDown,
  ExternalLink,
  FolderKanban,
  GitBranch,
  GitCommit,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  Lock,
  Plus,
  User,
} from 'lucide-react';

interface PrActivityCardProps {
  pr: PrActivity;
  index: number;
  isSelected: boolean;
  compactCommits: boolean;
  tasks: TrackingTask[];
  onToggleSelect: (key: string) => void;
  onToggleTaskAssignment: (taskId: string, pr: PrActivity, isAssigned: boolean) => Promise<void>;
  onCreateTaskWithPr: (title: string, pr: PrActivity) => Promise<void>;
}

const COMMITS_PREVIEW_LIMIT = 3;

const TASK_COLOR_PILL: Record<TaskColor, string> = {
  sky: 'bg-sky-500/15 text-sky-300 border-sky-400/30',
  indigo: 'bg-indigo-500/15 text-indigo-300 border-indigo-400/30',
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
  rose: 'bg-rose-500/15 text-rose-300 border-rose-400/30',
};

const TASK_COLOR_DOT: Record<TaskColor, string> = {
  sky: 'bg-sky-400',
  indigo: 'bg-indigo-400',
  emerald: 'bg-emerald-400',
  amber: 'bg-amber-400',
  rose: 'bg-rose-400',
};

export function PrActivityCard({
  pr,
  index,
  isSelected,
  compactCommits,
  tasks,
  onToggleSelect,
  onToggleTaskAssignment,
  onCreateTaskWithPr,
}: PrActivityCardProps) {
  const { locale, dict, t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const prKey = getPrKey(pr);
  const isDirectCommits = pr.activityType === 'direct_commits';

  const commitRows =
    pr.commitDetails && pr.commitDetails.length > 0
      ? pr.commitDetails
      : pr.commits.map((msg, i) => ({ sha: '', message: msg, date: `${i}` }));

  const previewLimit = compactCommits ? 0 : COMMITS_PREVIEW_LIMIT;
  const previewCommits = commitRows.slice(0, previewLimit);
  const hiddenCommits = commitRows.slice(previewLimit);
  const hasCollapsibleCommits = hiddenCommits.length > 0;

  const assignedTasks = tasks.filter((task) =>
    task.items.some((item) => item.repo === pr.repo && item.prNumber === pr.number),
  );

  const getStateBadge = () => {
    const normalized = pr.state.toLowerCase();
    if (normalized === 'draft') {
      return {
        label: dict.scanner.stateDraft,
        badgeClass: 'bg-amber-500/10 text-amber-300 border border-amber-500/30',
        iconClass: 'text-amber-300',
        Icon: GitPullRequestDraft,
      };
    }
    if (normalized === 'open') {
      return {
        label: dict.scanner.stateOpen,
        badgeClass: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/25',
        iconClass: 'text-emerald-400',
        Icon: GitPullRequest,
      };
    }
    if (normalized === 'merged') {
      return {
        label: dict.scanner.stateMerged,
        badgeClass: 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/25',
        iconClass: 'text-indigo-400',
        Icon: GitMerge,
      };
    }
    if (normalized === 'direct_commits') {
      return {
        label: dict.scanner.directCommitsBadge,
        badgeClass: 'bg-sky-500/10 text-sky-300 border border-sky-500/25',
        iconClass: 'text-sky-400',
        Icon: GitCommit,
      };
    }
    return {
      label: dict.scanner.stateClosed,
      badgeClass: 'bg-slate-800 text-slate-300 border border-slate-700',
      iconClass: 'text-slate-400',
      Icon: GitPullRequestClosed,
    };
  };

  const stateInfo = getStateBadge();
  const StateIcon = stateInfo.Icon;
  const relativeUpdated = formatRelativeTime(pr.updatedAt, locale);
  const shortRepo = pr.repo.includes('/') ? pr.repo.split('/')[1] || pr.repo : pr.repo;
  const displayTitle = isDirectCommits
    ? t('scanner.directCommitsTitle', { branch: pr.headBranch || pr.title })
    : pr.title;

  const handleQuickCreate = async (close: () => void) => {
    const clean = quickTaskTitle.trim();
    if (!clean) return;
    setBusyTaskId('__new__');
    try {
      await onCreateTaskWithPr(clean, pr);
      setQuickTaskTitle('');
      close();
    } finally {
      setBusyTaskId(null);
    }
  };

  return (
    <ShowcaseCard
      as="li"
      staggerIndex={index}
      className={`p-4 sm:p-5 min-w-0 transition-opacity ${
        isSelected ? 'opacity-100' : 'opacity-65'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <button
            type="button"
            role="checkbox"
            aria-checked={isSelected}
            aria-label={t('scanner.selectPrAria', { title: displayTitle })}
            onClick={() => onToggleSelect(prKey)}
            className={`mt-1 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
              isSelected
                ? 'bg-sky-500 border-sky-400 text-slate-950'
                : 'bg-white/[0.04] border-white/[0.15] hover:border-white/[0.3] text-transparent'
            }`}
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
          </button>

          <div
            className={`w-9 h-9 rounded-lg bg-white/[0.05] border border-white/[0.09] flex items-center justify-center shrink-0 mt-0.5 ${stateInfo.iconClass}`}
            aria-hidden="true"
          >
            <StateIcon className="w-4 h-4" />
          </div>

          <div className="min-w-0 flex-1">
            {/* Compact Context Metadata Row */}
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium border ${
                  pr.ownerType === 'organization'
                    ? 'bg-indigo-500/10 text-indigo-300 border-indigo-400/25'
                    : 'bg-sky-500/10 text-sky-300 border-sky-400/25'
                }`}
              >
                {pr.ownerType === 'organization' ? (
                  <Building2 className="w-3 h-3 shrink-0" aria-hidden="true" />
                ) : (
                  <User className="w-3 h-3 shrink-0" aria-hidden="true" />
                )}
                <span>
                  {pr.ownerType === 'organization' ? pr.owner : dict.scanner.personalSpace}
                </span>
              </span>

              <span className="font-mono font-medium text-slate-200 truncate" title={pr.repo}>
                {shortRepo}
              </span>

              {pr.repoPrivate && (
                <Lock className="w-3 h-3 text-slate-500 shrink-0" aria-hidden="true" />
              )}

              {!isDirectCommits && (
                <span className="font-mono text-slate-400 tabular-nums">#{pr.number}</span>
              )}

              <span
                className={`px-2 py-0.5 rounded-md text-xs font-medium ${stateInfo.badgeClass}`}
              >
                {stateInfo.label}
              </span>

              {pr.headBranch && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] font-mono text-xs text-slate-400 max-w-[200px] truncate"
                  title={pr.headBranch}
                >
                  <GitBranch className="w-3 h-3 shrink-0 text-slate-500" aria-hidden="true" />
                  <span className="truncate">{pr.headBranch}</span>
                </span>
              )}

              {relativeUpdated && (
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  • {relativeUpdated}
                </span>
              )}
            </div>

            {/* PR Title */}
            <h3 className="text-sm font-semibold text-slate-100 mt-1.5 leading-snug break-words">
              {displayTitle}
            </h3>

            {/* Assigned Manual Task Tags */}
            {assignedTasks.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {assignedTasks.map((task) => {
                  const color = TASK_COLOR_PILL[task.color] || TASK_COLOR_PILL.sky;
                  const dot = TASK_COLOR_DOT[task.color] || TASK_COLOR_DOT.sky;
                  return (
                    <span
                      key={task.id}
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-medium ${color}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden="true" />
                      <span className="truncate max-w-[180px]">{task.title}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Actions: Manual Task Assign Dropdown + External Link */}
        <div className="flex items-center gap-1 shrink-0">
          <DropdownMenu
            align="end"
            widthClass="w-64"
            trigger={({ id, isOpen, onClick, onKeyDown, ariaProps }) => (
              <button
                id={id}
                type="button"
                onClick={onClick}
                onKeyDown={onKeyDown}
                {...ariaProps}
                title={dict.scanner.assignToTaskHeading}
                className={`inline-flex items-center gap-1.5 min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
                  isOpen || assignedTasks.length > 0
                    ? 'bg-sky-500/10 text-sky-300 border-sky-400/30 hover:bg-sky-500/15'
                    : 'bg-white/[0.04] text-slate-300 border-white/[0.08] hover:text-white hover:border-white/[0.18]'
                }`}
              >
                <FolderKanban className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">{dict.scanner.assignTaskBtn}</span>
                {assignedTasks.length > 0 && (
                  <span className="font-mono text-xs tabular-nums">({assignedTasks.length})</span>
                )}
              </button>
            )}
          >
            {({ close }) => (
              <div className="space-y-2 p-2">
                <p className="px-1.5 text-xs font-medium text-slate-400">
                  {dict.scanner.assignToTaskHeading}
                </p>

                {tasks.length === 0 ? (
                  <p className="px-1.5 py-1 text-xs text-slate-500">{dict.scanner.noTasksHint}</p>
                ) : (
                  <div className="max-h-44 overflow-y-auto custom-scrollbar space-y-1">
                    {tasks.map((task) => {
                      const isAssigned = task.items.some(
                        (item) => item.repo === pr.repo && item.prNumber === pr.number,
                      );
                      const dot = TASK_COLOR_DOT[task.color] || TASK_COLOR_DOT.sky;
                      const isBusy = busyTaskId === task.id;
                      return (
                        <button
                          key={task.id}
                          type="button"
                          role="menuitem"
                          disabled={isBusy}
                          onClick={async () => {
                            setBusyTaskId(task.id);
                            try {
                              await onToggleTaskAssignment(task.id, pr, isAssigned);
                            } finally {
                              setBusyTaskId(null);
                            }
                          }}
                          className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50 ${
                            isAssigned
                              ? 'bg-sky-500/15 text-sky-200 border border-sky-400/25'
                              : 'text-slate-200 hover:bg-white/[0.06] border border-transparent'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${dot}`}
                              aria-hidden="true"
                            />
                            <span className="truncate">{task.title}</span>
                          </span>
                          {isAssigned && (
                            <Check
                              className="w-3.5 h-3.5 text-sky-400 shrink-0"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="pt-2 border-t border-white/[0.08] space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={quickTaskTitle}
                      onChange={(e) => setQuickTaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleQuickCreate(close);
                        }
                      }}
                      placeholder={dict.scanner.createTaskQuickPlaceholder}
                      className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-[#0C0E14] border border-white/[0.12] text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-400/50"
                    />
                    <button
                      type="button"
                      disabled={!quickTaskTitle.trim() || busyTaskId === '__new__'}
                      onClick={() => void handleQuickCreate(close)}
                      title={dict.scanner.createTaskQuickBtn}
                      className="inline-flex items-center justify-center min-h-[30px] px-2.5 rounded-lg text-xs font-semibold text-slate-950 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </DropdownMenu>

          <a
            href={pr.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={dict.scanner.openPrExternal}
            aria-label={`${dict.scanner.openPrExternal}: ${displayTitle}`}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/[0.08] transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
          >
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
          </a>
        </div>
      </div>

      {/* Commits Timeline */}
      {commitRows.length > 0 && (
        <div className="mt-3.5 pt-3 border-t border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-mono text-slate-400 flex items-center gap-2 tabular-nums">
              <GitCommit className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
              <span>{t('scanner.commitsCount', { count: commitRows.length })}</span>
            </p>

            {hasCollapsibleCommits && (
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                aria-expanded={isExpanded}
                className="inline-flex items-center gap-1 text-xs font-medium text-sky-400 hover:text-sky-300 cursor-pointer transition-colors"
              >
                <span>
                  {isExpanded
                    ? dict.scanner.collapseCommits
                    : compactCommits
                      ? t('scanner.commitsCollapsedCount', { count: hiddenCommits.length })
                      : t('scanner.showMoreCommits', { count: hiddenCommits.length })}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>
            )}
          </div>

          {previewCommits.length > 0 && (
            <ul role="list" className="space-y-1.5 pl-3 border-l border-slate-800">
              {previewCommits.map((commit, idx) => (
                <li
                  key={`${commit.sha}-${idx}`}
                  className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed min-w-0"
                >
                  {commit.sha ? (
                    <span className="font-mono text-xs text-slate-500 bg-white/[0.04] px-1.5 py-0.5 rounded shrink-0">
                      {commit.sha}
                    </span>
                  ) : (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0 mt-2"
                      aria-hidden="true"
                    />
                  )}
                  <span className="break-words min-w-0">{commit.message}</span>
                </li>
              ))}
            </ul>
          )}

          {hasCollapsibleCommits && (
            <div className="gp-accordion-grid" data-open={isExpanded ? 'true' : 'false'}>
              <div className="gp-accordion-inner">
                <ul role="list" className="space-y-1.5 pl-3 border-l border-slate-800 pt-1">
                  {hiddenCommits.map((commit, idx) => (
                    <li
                      key={`${commit.sha}-hidden-${idx}`}
                      className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed min-w-0"
                    >
                      {commit.sha ? (
                        <span className="font-mono text-xs text-slate-500 bg-white/[0.04] px-1.5 py-0.5 rounded shrink-0">
                          {commit.sha}
                        </span>
                      ) : (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0 mt-2"
                          aria-hidden="true"
                        />
                      )}
                      <span className="break-words min-w-0">{commit.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </ShowcaseCard>
  );
}
