'use client';

import React, { useState } from 'react';
import { CommitItem, PrActivity, TaskColor, TrackingTask } from '../../types';
import { useTranslation } from '../../i18n';
import { formatRelativeTime, getPrKey, getPrStateStyle } from '../../lib/activity-utils';
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
  X,
} from 'lucide-react';

interface PrActivityCardProps {
  pr: PrActivity;
  index?: number;
  isSelected: boolean;
  compactCommits: boolean;
  tasks: TrackingTask[];
  onToggleSelect: (key: string) => void;
  onToggleTaskAssignment: (taskId: string, pr: PrActivity, isAssigned: boolean) => Promise<void>;
  onCreateTaskWithPr: (title: string, pr: PrActivity) => Promise<void>;
  variant?: 'card' | 'embedded';
  disableStandupSelection?: boolean;
  statusNoteTag?: string;
  excludeTaskId?: string;
  hideTaskAssignMenu?: boolean;
  onRemoveFromTask?: () => void;
  removeFromTaskAriaLabel?: string;
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

function CommitTimelineList({
  commits,
  repo,
  fallbackUrl,
  extraClass = '',
}: {
  commits: CommitItem[];
  repo: string;
  fallbackUrl: string;
  extraClass?: string;
}) {
  return (
    <ul role="list" className={`space-y-1.5 pl-3 border-l border-slate-600/80 ${extraClass}`}>
      {commits.map((commit, idx) => {
        const commitUrl = commit.sha
          ? `https://github.com/${repo}/commit/${encodeURIComponent(commit.sha)}`
          : fallbackUrl;
        return (
          <li key={`${commit.sha}-${idx}`} className="min-w-0">
            <a
              href={commitUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group/commit flex items-start gap-2 text-xs text-slate-200 hover:text-sky-200 leading-relaxed min-w-0 transition-colors"
            >
              {commit.sha ? (
                <span className="font-mono text-xs text-slate-300 group-hover/commit:text-sky-200 bg-white/[0.08] group-hover/commit:bg-sky-500/15 border border-white/[0.1] group-hover/commit:border-sky-400/35 px-1.5 py-0.5 rounded shrink-0 transition-colors">
                  {commit.sha}
                </span>
              ) : (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover/commit:bg-sky-400 shrink-0 mt-2 transition-colors"
                  aria-hidden="true"
                />
              )}
              <span className="break-words min-w-0 group-hover/commit:underline">
                {commit.message}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function PrActivityCard({
  pr,
  index,
  isSelected,
  compactCommits,
  tasks,
  onToggleSelect,
  onToggleTaskAssignment,
  onCreateTaskWithPr,
  variant = 'card',
  disableStandupSelection = false,
  statusNoteTag,
  excludeTaskId,
  hideTaskAssignMenu = false,
  onRemoveFromTask,
  removeFromTaskAriaLabel,
}: PrActivityCardProps) {
  const { locale, dict, t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const prKey = getPrKey(pr);
  const isDirectCommits = pr.activityType === 'direct_commits';

  const commitRows: CommitItem[] =
    pr.commitDetails && pr.commitDetails.length > 0
      ? pr.commitDetails
      : pr.commits.map((msg, i) => ({ sha: '', message: msg, date: `${i}` }));

  const previewLimit = compactCommits ? 0 : COMMITS_PREVIEW_LIMIT;
  const previewCommits = commitRows.slice(0, previewLimit);
  const hiddenCommits = commitRows.slice(previewLimit);
  const hasCollapsibleCommits = hiddenCommits.length > 0;

  const assignedTasks = isDirectCommits
    ? []
    : tasks.filter(
        (task) =>
          task.id !== excludeTaskId &&
          task.items.some((item) => item.repo === pr.repo && item.prNumber === pr.number),
      );

  const assignableTasks = tasks.filter(
    (task) =>
      !task.isCompleted ||
      task.items.some((item) => item.repo === pr.repo && item.prNumber === pr.number),
  );

  const getStateBadge = () => {
    const style = getPrStateStyle(pr.state);
    if (style.normalized === 'draft') {
      return {
        label: dict.scanner.stateDraft,
        badgeClass: style.badgeClass,
        iconClass: style.iconClass,
        Icon: GitPullRequestDraft,
      };
    }
    if (style.normalized === 'open') {
      return {
        label: dict.scanner.stateOpen,
        badgeClass: style.badgeClass,
        iconClass: style.iconClass,
        Icon: GitPullRequest,
      };
    }
    if (style.normalized === 'merged') {
      return {
        label: dict.scanner.stateMerged,
        badgeClass: style.badgeClass,
        iconClass: style.iconClass,
        Icon: GitMerge,
      };
    }
    if (style.normalized === 'direct_commits') {
      return {
        label: dict.scanner.directCommitsBadge,
        badgeClass: style.badgeClass,
        iconClass: style.iconClass,
        Icon: GitCommit,
      };
    }
    return {
      label: dict.scanner.stateClosed,
      badgeClass: style.badgeClass,
      iconClass: style.iconClass,
      Icon: GitPullRequestClosed,
    };
  };

  const stateInfo = getStateBadge();
  const StateIcon = stateInfo.Icon;
  const relativeUpdated = formatRelativeTime(pr.updatedAt, locale);
  const shortRepo = pr.repo.includes('/') ? pr.repo.split('/')[1] || pr.repo : pr.repo;
  const accessibleTitle = isDirectCommits
    ? `${shortRepo} (${pr.headBranch || pr.title})`
    : pr.title;
  const ownerUrl = `https://github.com/${encodeURIComponent(pr.owner)}`;
  const repoUrl = `https://github.com/${pr.repo}`;
  const branchUrl = pr.headBranch
    ? `https://github.com/${pr.repo}/tree/${encodeURIComponent(pr.headBranch)}`
    : undefined;

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

  const opacityClass = disableStandupSelection
    ? 'opacity-100'
    : isSelected
      ? 'opacity-100'
      : 'opacity-65';

  const cardBody = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {!disableStandupSelection && (
            <button
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              aria-label={t('scanner.selectPrAria', { title: accessibleTitle })}
              onClick={() => onToggleSelect(prKey)}
              className={`mt-1 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
                isSelected
                  ? 'bg-sky-500 border-sky-400 text-slate-950'
                  : 'bg-[#152033] border-slate-500/80 hover:border-sky-400/70 text-transparent'
              }`}
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
            </button>
          )}

          <div
            className={`w-9 h-9 rounded-lg bg-white/[0.08] border border-white/[0.14] flex items-center justify-center shrink-0 mt-0.5 ${stateInfo.iconClass}`}
            aria-hidden="true"
          >
            <StateIcon className="w-4 h-4" />
          </div>

          <div className="min-w-0 flex-1">
            {/* Row 1: Workspace + Repo + PR ID + State Badge + Time */}
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <a
                href={ownerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium border transition-colors ${
                  pr.ownerType === 'organization'
                    ? 'bg-indigo-500/10 text-indigo-300 border-indigo-400/25 hover:bg-indigo-500/20 hover:border-indigo-400/45'
                    : 'bg-sky-500/10 text-sky-300 border-sky-400/25 hover:bg-sky-500/20 hover:border-sky-400/45'
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
              </a>

              <a
                href={repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={pr.repo}
                className="font-mono font-medium text-slate-200 hover:text-sky-300 hover:underline truncate transition-colors"
              >
                {shortRepo}
              </a>

              {pr.repoPrivate && (
                <Lock className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
              )}

              {!isDirectCommits && (
                <a
                  href={pr.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-slate-200 hover:text-sky-300 hover:underline tabular-nums transition-colors"
                >
                  #{pr.number}
                </a>
              )}

              <span
                className={`px-2 py-0.5 rounded-md text-xs font-medium ${stateInfo.badgeClass}`}
              >
                {stateInfo.label}
              </span>

              {statusNoteTag && (
                <span className="px-2 py-0.5 rounded-md bg-white/[0.07] border border-white/[0.14] text-slate-300 text-xs">
                  {statusNoteTag}
                </span>
              )}

              {relativeUpdated && (
                <span className="text-xs text-slate-400 font-mono tabular-nums whitespace-nowrap">
                  • {relativeUpdated}
                </span>
              )}
            </div>

            {/* Row 2: Branch Badge (clickable) */}
            {pr.headBranch && branchUrl && (
              <div className="mt-1.5 flex items-center flex-wrap gap-1.5">
                <a
                  href={branchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={pr.headBranch}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.07] hover:bg-sky-500/15 border border-white/[0.14] hover:border-sky-400/40 font-mono text-xs text-slate-200 hover:text-sky-200 max-w-full transition-colors"
                >
                  <GitBranch className="w-3 h-3 shrink-0 text-slate-400" aria-hidden="true" />
                  <span className="truncate">{pr.headBranch}</span>
                </a>
              </div>
            )}

            {/* Row 3: PR Title (clickable; omitted for direct commits) */}
            {!isDirectCommits && (
              <h3 className="mt-2 leading-snug break-words">
                <a
                  href={pr.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-slate-100 hover:text-sky-300 hover:underline transition-colors"
                >
                  {pr.title}
                </a>
              </h3>
            )}

            {/* Assigned Manual Task Tags (PRs only) */}
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

        {/* Right Actions: Manual Task Assign (optional) + External Link + Optional Remove */}
        <div className="flex items-center gap-1 shrink-0">
          {!isDirectCommits && !hideTaskAssignMenu && (
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
                      ? 'bg-sky-500/15 text-sky-200 border-sky-400/35 hover:bg-sky-500/20'
                      : 'bg-white/[0.07] text-slate-200 border-white/[0.14] hover:text-white hover:border-white/[0.24]'
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

                  {assignableTasks.length === 0 ? (
                    <p className="px-1.5 py-1 text-xs text-slate-400">{dict.scanner.noTasksHint}</p>
                  ) : (
                    <div className="max-h-44 overflow-y-auto custom-scrollbar space-y-1">
                      {assignableTasks.map((task) => {
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
                                ? 'bg-sky-500/15 text-sky-200 border border-sky-400/30'
                                : 'text-slate-200 hover:bg-white/[0.08] border border-transparent'
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

                  <div className="pt-2 border-t border-white/[0.12] space-y-1.5">
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
                        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-[#152033] border border-slate-600 text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-sky-400"
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
          )}

          <a
            href={pr.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={dict.scanner.openPrExternal}
            aria-label={`${dict.scanner.openPrExternal}: ${accessibleTitle}`}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/[0.08] transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
          >
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
          </a>

          {onRemoveFromTask && (
            <button
              type="button"
              onClick={onRemoveFromTask}
              title={removeFromTaskAriaLabel}
              aria-label={removeFromTaskAriaLabel}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/15 transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Commits Timeline */}
      {commitRows.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700/80 space-y-2">
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
            <CommitTimelineList commits={previewCommits} repo={pr.repo} fallbackUrl={pr.prUrl} />
          )}

          {hasCollapsibleCommits && (
            <div className="gp-accordion-grid" data-open={isExpanded ? 'true' : 'false'}>
              <div className="gp-accordion-inner">
                <CommitTimelineList
                  commits={hiddenCommits}
                  repo={pr.repo}
                  fallbackUrl={pr.prUrl}
                  extraClass="pt-1"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );

  if (variant === 'embedded') {
    return (
      <li
        className={`rounded-xl bg-[#273549]/85 border border-slate-600/75 hover:border-slate-500 p-3.5 sm:p-4 min-w-0 transition-[border-color,opacity] duration-200 ${opacityClass}`}
      >
        {cardBody}
      </li>
    );
  }

  return (
    <ShowcaseCard
      as="li"
      staggerIndex={index}
      className={`p-4 sm:p-5 min-w-0 transition-opacity ${opacityClass}`}
    >
      {cardBody}
    </ShowcaseCard>
  );
}
