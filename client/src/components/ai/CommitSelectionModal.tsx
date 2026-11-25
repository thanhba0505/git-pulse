'use client';

import React, { useMemo } from 'react';
import { ModalDialog } from '../ui/ModalDialog';
import { useTranslation } from '../../i18n';
import { Building2, GitCommit, User, X } from 'lucide-react';

export interface SelectableCommit {
  id: string;
  prKey: string;
  repo: string;
  prNumber: number;
  prTitle: string;
  prUrl: string;
  ownerType: 'personal' | 'organization';
  owner: string;
  message: string;
}

interface CommitSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  commits: readonly SelectableCommit[];
  selectedCommitIds: ReadonlySet<string>;
  onToggleCommit: (commitId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  includePersonal: boolean;
  onTogglePersonal: (checked: boolean) => void;
  includeOrg: boolean;
  onToggleOrg: (checked: boolean) => void;
}

interface GroupedCommitGroup {
  prKey: string;
  repo: string;
  prNumber: number;
  prTitle: string;
  prUrl: string;
  ownerType: 'personal' | 'organization';
  owner: string;
  commits: SelectableCommit[];
}

export function CommitSelectionModal({
  isOpen,
  onClose,
  commits,
  selectedCommitIds,
  onToggleCommit,
  onSelectAll,
  onDeselectAll,
  includePersonal,
  onTogglePersonal,
  includeOrg,
  onToggleOrg,
}: CommitSelectionModalProps) {
  const { dict, t } = useTranslation();

  const grouped = useMemo<GroupedCommitGroup[]>(() => {
    const map = new Map<string, GroupedCommitGroup>();
    for (const c of commits) {
      let g = map.get(c.prKey);
      if (!g) {
        g = {
          prKey: c.prKey,
          repo: c.repo,
          prNumber: c.prNumber,
          prTitle: c.prTitle,
          prUrl: c.prUrl,
          ownerType: c.ownerType,
          owner: c.owner,
          commits: [],
        };
        map.set(c.prKey, g);
      }
      g.commits.push(c);
    }
    return Array.from(map.values());
  }, [commits]);

  const personalCount = useMemo(
    () => commits.filter((c) => c.ownerType === 'personal').length,
    [commits],
  );
  const orgCount = useMemo(
    () => commits.filter((c) => c.ownerType === 'organization').length,
    [commits],
  );

  const selectedCount = selectedCommitIds.size;
  const totalCount = commits.length;

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="commit-selection-modal-title"
      maxWidthClass="max-w-2xl"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-slate-700/80 shrink-0">
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0"
            aria-hidden="true"
          >
            <GitCommit className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2
              id="commit-selection-modal-title"
              className="text-base font-semibold text-slate-100 tracking-tight"
            >
              {dict.commitModal.title}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              {dict.commitModal.subtitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label={dict.common.close}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700/80 transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Main Content */}
      <div className="p-6 space-y-4 overflow-y-auto gp-scroll-area max-h-[70vh]">
        {/* Top Filter Bar: Personal / Org checkboxes + Quick toggles */}
        <div className="p-3.5 rounded-xl bg-[#152033] border border-slate-700/80 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-5">
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-200 hover:text-white select-none">
                <input
                  type="checkbox"
                  checked={includePersonal}
                  onChange={(e) => onTogglePersonal(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 text-sky-500 focus:ring-sky-400 bg-[#0f172a] cursor-pointer"
                />
                <User className="w-3.5 h-3.5 text-sky-400 shrink-0" aria-hidden="true" />
                <span>{dict.scanner.personalSpace}</span>
                <span className="font-mono text-slate-400 tabular-nums">({personalCount})</span>
              </label>

              <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-200 hover:text-white select-none">
                <input
                  type="checkbox"
                  checked={includeOrg}
                  onChange={(e) => onToggleOrg(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 text-sky-500 focus:ring-sky-400 bg-[#0f172a] cursor-pointer"
                />
                <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" aria-hidden="true" />
                <span>{dict.scanner.orgSpace}</span>
                <span className="font-mono text-slate-400 tabular-nums">({orgCount})</span>
              </label>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={onSelectAll}
                className="text-xs text-sky-400 hover:text-sky-300 font-medium cursor-pointer transition-colors"
              >
                {dict.commitModal.selectAll}
              </button>
              <span className="text-slate-600" aria-hidden="true">
                •
              </span>
              <button
                type="button"
                onClick={onDeselectAll}
                className="text-xs text-slate-400 hover:text-slate-200 font-medium cursor-pointer transition-colors"
              >
                {dict.commitModal.clearAll}
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-400/80 leading-relaxed">
            {dict.commitModal.filterSavedNote}
          </p>
        </div>

        {/* Commits List grouped by PR/Repo */}
        {commits.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-[#152033]/60 border border-slate-700/70 text-slate-400 text-xs">
            {dict.commitModal.noCommits}
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map((group) => {
              const groupSelectedCount = group.commits.filter((c) =>
                selectedCommitIds.has(c.id),
              ).length;

              return (
                <div
                  key={group.prKey}
                  className="p-3.5 rounded-xl bg-[#152033]/70 border border-slate-700/70 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 text-xs">
                      <span className="font-semibold text-slate-100 truncate">{group.repo}</span>
                      <span className="font-mono text-slate-400 shrink-0">
                        {group.prNumber > 0 ? `#${group.prNumber}` : ''}
                      </span>
                      <span className="text-slate-300 truncate hidden sm:inline">
                        {group.prTitle}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-mono font-medium border ${
                          group.ownerType === 'personal'
                            ? 'bg-sky-500/15 text-sky-300 border-sky-400/30'
                            : 'bg-indigo-500/15 text-indigo-300 border-indigo-400/30'
                        }`}
                      >
                        {group.ownerType === 'personal' ? dict.scanner.personalSpace : group.owner}
                      </span>
                      <span className="text-xs font-mono text-slate-400 tabular-nums">
                        {groupSelectedCount}/{group.commits.length}
                      </span>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-700/50 pt-1">
                    {group.commits.map((c) => {
                      const isChecked = selectedCommitIds.has(c.id);
                      return (
                        <label
                          key={c.id}
                          className="flex items-start gap-2.5 py-2 px-1.5 rounded-lg hover:bg-white/[0.04] cursor-pointer transition-colors select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => onToggleCommit(c.id)}
                            className="mt-0.5 w-4 h-4 rounded border-slate-600 text-sky-500 focus:ring-sky-400 bg-[#0f172a] shrink-0 cursor-pointer"
                          />
                          <span
                            className={`font-mono text-xs break-words flex-1 leading-relaxed ${
                              isChecked ? 'text-slate-100' : 'text-slate-400'
                            }`}
                          >
                            {c.message}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-700/80 shrink-0">
        <span className="text-xs font-mono text-slate-300 tabular-nums">
          {t('commitModal.selectedSummary', {
            selected: selectedCount,
            total: totalCount,
          })}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="gp-cta-shimmer inline-flex items-center justify-center min-h-[36px] px-5 py-1.5 rounded-lg text-xs font-semibold text-slate-950 bg-sky-500 hover:bg-sky-400 active:scale-[0.98] transition-all cursor-pointer"
        >
          {dict.commitModal.applyBtn}
        </button>
      </div>
    </ModalDialog>
  );
}
