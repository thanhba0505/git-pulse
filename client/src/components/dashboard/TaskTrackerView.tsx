'use client';

import React, { useMemo, useState } from 'react';
import { PrActivity, TaskColor, TrackingTask } from '../../types';
import { useTranslation } from '../../i18n';
import { getPrKey } from '../../lib/activity-utils';
import { ShowcaseCard } from '../ui/ShowcaseCard';
import { PrActivityCard } from './PrActivityCard';
import { Check, ExternalLink, FolderKanban, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';

interface TaskTrackerViewProps {
  tasks: TrackingTask[];
  activities: PrActivity[];
  selectedPrKeys: ReadonlySet<string>;
  compactCommits: boolean;
  onTogglePrSelection: (key: string) => void;
  onSelectKeysBatch: (keys: string[], select: boolean) => void;
  onCreateTask: (title: string, color: TaskColor, prs: PrActivity[]) => Promise<void>;
  onRenameTask: (taskId: string, title: string, color: TaskColor) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onToggleTaskAssignment: (taskId: string, pr: PrActivity, isAssigned: boolean) => Promise<void>;
  onRemoveTaskItem: (taskId: string, repo: string, prNumber: number) => Promise<void>;
}

const TASK_COLORS: readonly TaskColor[] = ['sky', 'indigo', 'emerald', 'amber', 'rose'];

const COLOR_DOT_CLASSES: Record<TaskColor, string> = {
  sky: 'bg-sky-400',
  indigo: 'bg-indigo-400',
  emerald: 'bg-emerald-400',
  amber: 'bg-amber-400',
  rose: 'bg-rose-400',
};

const COLOR_BORDER_CLASSES: Record<TaskColor, string> = {
  sky: 'border-l-sky-400/70',
  indigo: 'border-l-indigo-400/70',
  emerald: 'border-l-emerald-400/70',
  amber: 'border-l-amber-400/70',
  rose: 'border-l-rose-400/70',
};

export function TaskTrackerView({
  tasks,
  activities,
  selectedPrKeys,
  compactCommits,
  onTogglePrSelection,
  onSelectKeysBatch,
  onCreateTask,
  onRenameTask,
  onDeleteTask,
  onToggleTaskAssignment,
  onRemoveTaskItem,
}: TaskTrackerViewProps) {
  const { dict, t } = useTranslation();

  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newColor, setNewColor] = useState<TaskColor>('sky');
  const [pickedKeysForNew, setPickedKeysForNew] = useState<Set<string>>(() => new Set());
  const [isSavingNew, setIsSavingNew] = useState(false);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingColor, setEditingColor] = useState<TaskColor>('sky');
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const liveActivityByLookup = useMemo(() => {
    const map = new Map<string, PrActivity>();
    for (const act of activities) {
      map.set(`${act.repo}#${act.number}`, act);
    }
    return map;
  }, [activities]);

  const unassignedActivities = useMemo(() => {
    const assignedSet = new Set<string>();
    for (const task of tasks) {
      for (const item of task.items) {
        assignedSet.add(`${item.repo}#${item.prNumber}`);
      }
    }
    return activities.filter((act) => !assignedSet.has(`${act.repo}#${act.number}`));
  }, [tasks, activities]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTitle.trim();
    if (!clean) return;

    const chosenPrs = activities.filter((act) => pickedKeysForNew.has(getPrKey(act)));
    setIsSavingNew(true);
    try {
      await onCreateTask(clean, newColor, chosenPrs);
      setNewTitle('');
      setNewColor('sky');
      setPickedKeysForNew(new Set());
      setIsCreating(false);
    } finally {
      setIsSavingNew(false);
    }
  };

  const getStateChip = (rawState: string) => {
    const state = rawState.toLowerCase();
    if (state === 'draft') {
      return {
        label: dict.scanner.stateDraft,
        cls: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      };
    }
    if (state === 'merged') {
      return {
        label: dict.scanner.stateMerged,
        cls: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
      };
    }
    if (state === 'open') {
      return {
        label: dict.scanner.stateOpen,
        cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
      };
    }
    if (state === 'direct_commits') {
      return {
        label: dict.scanner.directCommitsBadge,
        cls: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
      };
    }
    return {
      label: dict.scanner.stateClosed,
      cls: 'bg-slate-800 text-slate-300 border-slate-700',
    };
  };

  return (
    <div className="space-y-5">
      {/* Top Action Bar for Manual Task Tracker */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          {tasks.length > 0 ? `${tasks.length} ${dict.scanner.groupTask}` : dict.tasks.emptyDesc}
        </p>
        {!isCreating && (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-1.5 min-h-[34px] px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-950 bg-sky-500 hover:bg-sky-400 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{dict.tasks.createBtn}</span>
          </button>
        )}
      </div>

      {/* Inline Manual Task Creation Form */}
      {isCreating && (
        <ShowcaseCard className="p-5">
          <form onSubmit={(e) => void handleCreateSubmit(e)} className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-100">{dict.tasks.createTitle}</h3>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                aria-label={dict.common.cancel}
                className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-8 space-y-1.5">
                <label
                  htmlFor="new-task-title"
                  className="block text-xs font-medium text-slate-300"
                >
                  {dict.tasks.titleLabel}
                </label>
                <input
                  id="new-task-title"
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={dict.tasks.titlePlaceholder}
                  maxLength={160}
                  autoFocus
                  className="w-full min-h-[38px] px-3 py-2 rounded-lg bg-[#0C0E14] border border-white/[0.12] text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-400/50"
                />
              </div>

              <div className="sm:col-span-4 space-y-1.5">
                <span className="block text-xs font-medium text-slate-300">
                  {dict.tasks.colorLabel}
                </span>
                <div className="flex items-center gap-2 min-h-[38px]">
                  {TASK_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewColor(color)}
                      aria-label={color}
                      aria-pressed={newColor === color}
                      className={`w-7 h-7 rounded-full flex items-center justify-center border transition-transform cursor-pointer ${
                        newColor === color
                          ? 'border-white scale-110'
                          : 'border-white/20 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full ${COLOR_DOT_CLASSES[color]}`} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-300">
                  {dict.tasks.selectPrsLabel}
                </span>
                <span className="text-xs font-mono text-sky-400 tabular-nums">
                  {t('tasks.selectedPrsHint', { count: pickedKeysForNew.size })}
                </span>
              </div>

              {activities.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">{dict.tasks.noAvailablePrs}</p>
              ) : (
                <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1.5 rounded-xl bg-[#0C0E14]/80 border border-white/[0.08] p-2.5">
                  {activities.map((pr) => {
                    const key = getPrKey(pr);
                    const checked = pickedKeysForNew.has(key);
                    const chip = getStateChip(pr.state);
                    const shortRepo = pr.repo.includes('/')
                      ? pr.repo.split('/')[1] || pr.repo
                      : pr.repo;
                    return (
                      <label
                        key={key}
                        className={`flex items-start gap-2.5 p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                          checked
                            ? 'bg-sky-500/10 border border-sky-400/25'
                            : 'hover:bg-white/[0.04] border border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setPickedKeysForNew((prev) => {
                              const next = new Set(prev);
                              if (next.has(key)) next.delete(key);
                              else next.add(key);
                              return next;
                            });
                          }}
                          className="mt-0.5 rounded accent-sky-500 cursor-pointer"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-sky-400">{shortRepo}</span>
                            {pr.activityType === 'pr' && (
                              <span className="font-mono text-slate-400">#{pr.number}</span>
                            )}
                            <span className={`px-1.5 py-0.5 rounded border text-xs ${chip.cls}`}>
                              {chip.label}
                            </span>
                          </div>
                          <p className="text-slate-200 mt-0.5 break-words">{pr.title}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="min-h-[34px] px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.09] cursor-pointer"
              >
                {dict.common.cancel}
              </button>
              <button
                type="submit"
                disabled={!newTitle.trim() || isSavingNew}
                className="inline-flex items-center gap-1.5 min-h-[34px] px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-950 bg-sky-500 hover:bg-sky-400 disabled:opacity-45 cursor-pointer"
              >
                {isSavingNew && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                <span>{isSavingNew ? dict.tasks.savingBtn : dict.tasks.saveTaskBtn}</span>
              </button>
            </div>
          </form>
        </ShowcaseCard>
      )}

      {/* Tasks List */}
      {tasks.length === 0 && !isCreating ? (
        <ShowcaseCard className="p-8 text-center">
          <div className="w-11 h-11 mx-auto rounded-xl bg-sky-500/10 border border-sky-400/25 flex items-center justify-center text-sky-400 mb-3">
            <FolderKanban className="w-5 h-5" aria-hidden="true" />
          </div>
          <h3 className="text-sm font-semibold text-slate-100">{dict.tasks.emptyTitle}</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1.5 leading-relaxed">
            {dict.tasks.emptyDesc}
          </p>
        </ShowcaseCard>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => {
            const borderClass = COLOR_BORDER_CLASSES[task.color] || COLOR_BORDER_CLASSES.sky;
            const dotClass = COLOR_DOT_CLASSES[task.color] || COLOR_DOT_CLASSES.sky;
            const isEditing = editingTaskId === task.id;
            const isAssigning = assigningTaskId === task.id;
            const isConfirmingDel = confirmDeleteId === task.id;
            const isBusy = busyTaskId === task.id;

            const resolvedItems = task.items.map((item) => {
              const live = liveActivityByLookup.get(`${item.repo}#${item.prNumber}`);
              return {
                item,
                live,
                state: live?.state ?? item.state,
                title: live?.title ?? item.title,
              };
            });

            const mergedCount = resolvedItems.filter((r) => r.state === 'merged').length;
            const openCount = resolvedItems.filter((r) => r.state === 'open').length;
            const draftCount = resolvedItems.filter((r) => r.state === 'draft').length;
            const selectableKeys = resolvedItems
              .map((r) => (r.live ? getPrKey(r.live) : null))
              .filter((k): k is string => Boolean(k));
            const allSelectableChecked =
              selectableKeys.length > 0 && selectableKeys.every((k) => selectedPrKeys.has(k));

            return (
              <ShowcaseCard key={task.id} className={`p-5 border-l-4 ${borderClass} space-y-4`}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg bg-[#0C0E14] border border-white/[0.15] text-xs text-slate-100 focus:outline-none focus:border-sky-400/50"
                        />
                        <div className="flex items-center gap-1">
                          {TASK_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setEditingColor(color)}
                              aria-label={color}
                              className={`w-6 h-6 rounded-full flex items-center justify-center border cursor-pointer ${
                                editingColor === color
                                  ? 'border-white'
                                  : 'border-transparent opacity-60'
                              }`}
                            >
                              <span
                                className={`w-3.5 h-3.5 rounded-full ${COLOR_DOT_CLASSES[color]}`}
                              />
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={isBusy || !editingTitle.trim()}
                          onClick={async () => {
                            setBusyTaskId(task.id);
                            try {
                              await onRenameTask(task.id, editingTitle.trim(), editingColor);
                              setEditingTaskId(null);
                            } finally {
                              setBusyTaskId(null);
                            }
                          }}
                          className="min-h-[30px] px-3 py-1 rounded-lg text-xs font-semibold text-slate-950 bg-sky-500 hover:bg-sky-400 cursor-pointer"
                        >
                          {dict.tasks.saveRenameBtn}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTaskId(null)}
                          className="min-h-[30px] px-2.5 py-1 rounded-lg text-xs text-slate-300 bg-white/[0.05] cursor-pointer"
                        >
                          {dict.common.cancel}
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClass}`} />
                          <h3 className="text-sm font-semibold text-slate-100">{task.title}</h3>
                        </div>
                        <p className="text-xs font-mono text-slate-400 mt-1 tabular-nums">
                          {t('tasks.progressSummary', {
                            total: resolvedItems.length,
                            merged: mergedCount,
                            open: openCount,
                            draft: draftCount,
                          })}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Task Actions */}
                  <div className="flex items-center flex-wrap gap-1.5 shrink-0">
                    {selectableKeys.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onSelectKeysBatch(selectableKeys, !allSelectableChecked)}
                        className={`inline-flex items-center gap-1.5 min-h-[30px] px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          allSelectableChecked
                            ? 'bg-sky-500/20 text-sky-200 border-sky-400/40'
                            : 'bg-white/[0.05] text-slate-300 hover:text-white border-white/[0.1]'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{dict.tasks.selectAllInTask}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setAssigningTaskId(isAssigning ? null : task.id)}
                      className="inline-flex items-center gap-1 min-h-[30px] px-2.5 py-1 rounded-lg text-xs font-medium text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/25 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{isAssigning ? dict.tasks.doneAddPrsBtn : dict.tasks.addPrsBtn}</span>
                    </button>

                    <button
                      type="button"
                      title={dict.tasks.renameTooltip}
                      aria-label={dict.tasks.renameTooltip}
                      onClick={() => {
                        setEditingTaskId(task.id);
                        setEditingTitle(task.title);
                        setEditingColor(task.color);
                      }}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>

                    {!isConfirmingDel ? (
                      <button
                        type="button"
                        title={dict.tasks.deleteTooltip}
                        aria-label={dict.tasks.deleteTooltip}
                        onClick={() => setConfirmDeleteId(task.id)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/15 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={async () => {
                            setBusyTaskId(task.id);
                            try {
                              await onDeleteTask(task.id);
                              setConfirmDeleteId(null);
                            } finally {
                              setBusyTaskId(null);
                            }
                          }}
                          className="min-h-[30px] px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 cursor-pointer"
                        >
                          {dict.tasks.confirmDeleteBtn}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="min-h-[30px] px-2 py-1 rounded-lg text-xs text-slate-300 bg-white/[0.05] cursor-pointer"
                        >
                          {dict.common.cancel}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Picker to Assign / Unassign Fetched PRs to This Task */}
                {isAssigning && (
                  <div className="rounded-xl bg-[#0C0E14]/90 border border-white/[0.09] p-3 space-y-2">
                    <p className="text-xs font-medium text-slate-300">
                      {dict.tasks.selectPrsLabel}
                    </p>
                    {activities.length === 0 ? (
                      <p className="text-xs text-slate-500">{dict.tasks.noAvailablePrs}</p>
                    ) : (
                      <div className="max-h-52 overflow-y-auto custom-scrollbar space-y-1">
                        {activities.map((pr) => {
                          const assigned = task.items.some(
                            (it) => it.repo === pr.repo && it.prNumber === pr.number,
                          );
                          const chip = getStateChip(pr.state);
                          const shortRepo = pr.repo.includes('/')
                            ? pr.repo.split('/')[1] || pr.repo
                            : pr.repo;
                          return (
                            <label
                              key={getPrKey(pr)}
                              className={`flex items-center justify-between gap-2 p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                                assigned
                                  ? 'bg-sky-500/10 border border-sky-400/25'
                                  : 'hover:bg-white/[0.04] border border-transparent'
                              }`}
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={assigned}
                                  onChange={() =>
                                    void onToggleTaskAssignment(task.id, pr, assigned)
                                  }
                                  className="rounded accent-sky-500 cursor-pointer shrink-0"
                                />
                                <span className="font-mono text-sky-400 shrink-0">{shortRepo}</span>
                                {pr.activityType === 'pr' && (
                                  <span className="font-mono text-slate-400 shrink-0">
                                    #{pr.number}
                                  </span>
                                )}
                                <span className="text-slate-200 truncate">{pr.title}</span>
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded border text-xs shrink-0 ${chip.cls}`}
                              >
                                {chip.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Items inside Task */}
                {resolvedItems.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                    {resolvedItems.map(({ item, live, state, title }) => {
                      const chip = getStateChip(state);
                      const liveKey = live ? getPrKey(live) : null;
                      const isChecked = liveKey ? selectedPrKeys.has(liveKey) : false;
                      const shortRepo = item.repo.includes('/')
                        ? item.repo.split('/')[1] || item.repo
                        : item.repo;

                      return (
                        <div
                          key={`${item.repo}#${item.prNumber}`}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.07]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {liveKey ? (
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={isChecked}
                                aria-label={title}
                                onClick={() => onTogglePrSelection(liveKey)}
                                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${
                                  isChecked
                                    ? 'bg-sky-500 border-sky-400 text-slate-950'
                                    : 'bg-white/[0.04] border-white/[0.2] text-transparent'
                                }`}
                              >
                                <Check className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
                              </button>
                            ) : (
                              <span
                                className="w-4 h-4 rounded border border-white/[0.08] bg-white/[0.02] shrink-0"
                                aria-hidden="true"
                              />
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                                <span className="font-mono text-sky-400">{shortRepo}</span>
                                {item.prNumber > 0 && (
                                  <span className="font-mono text-slate-400">#{item.prNumber}</span>
                                )}
                                <span
                                  className={`px-1.5 py-0.5 rounded border text-xs ${chip.cls}`}
                                >
                                  {chip.label}
                                </span>
                                {!live && (
                                  <span className="px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400 text-xs">
                                    {dict.tasks.outOfWindowTag}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-medium text-slate-200 mt-1 break-words">
                                {title}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <a
                              href={item.prUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08]"
                              aria-label={title}
                            >
                              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                            </a>
                            <button
                              type="button"
                              aria-label={t('tasks.removeItemAria', { title })}
                              onClick={() =>
                                void onRemoveTaskItem(task.id, item.repo, item.prNumber)
                              }
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-rose-500/15 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ShowcaseCard>
            );
          })}
        </div>
      )}

      {/* Unassigned Fetched PRs Below */}
      {unassignedActivities.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
              {dict.tasks.unassignedTitle} ({unassignedActivities.length})
            </h3>
          </div>
          <ul role="list" className="space-y-3">
            {unassignedActivities.map((pr, index) => (
              <PrActivityCard
                key={getPrKey(pr)}
                pr={pr}
                index={index}
                isSelected={selectedPrKeys.has(getPrKey(pr))}
                compactCommits={compactCommits}
                tasks={tasks}
                onToggleSelect={onTogglePrSelection}
                onToggleTaskAssignment={onToggleTaskAssignment}
                onCreateTaskWithPr={async (title, targetPr) => {
                  await onCreateTask(title, 'sky', [targetPr]);
                }}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
