'use client';

import React, { useMemo, useState } from 'react';
import { PrActivity } from '../../types';
import { useTranslation } from '../../i18n';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ShowcaseCard } from '../ui/ShowcaseCard';
import { ActivityListSkeleton } from '../ui/Skeleton';
import {
  GitPullRequest,
  GitMerge,
  GitCommit,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  Check,
} from 'lucide-react';

export function getPrKey(pr: PrActivity): string {
  return `${pr.repo}#${pr.number}`;
}

interface ActivityScannerProps {
  activities: PrActivity[];
  isLoading: boolean;
  error?: string | null;
  onScan: () => void;
  sinceOption: 'today' | '24h' | '7d';
  onSinceOptionChange: (opt: 'today' | '24h' | '7d') => void;
  repoFilter: string;
  onRepoFilterChange: (repo: string) => void;
  selectedPrKeys: ReadonlySet<string>;
  onTogglePrSelection: (key: string) => void;
  onSelectAllPrs: () => void;
  onClearPrSelection: () => void;
}

const COMMITS_PREVIEW_LIMIT = 3;

export function ActivityScanner({
  activities,
  isLoading,
  error,
  onScan,
  sinceOption,
  onSinceOptionChange,
  repoFilter,
  onRepoFilterChange,
  selectedPrKeys,
  onTogglePrSelection,
  onSelectAllPrs,
  onClearPrSelection,
}: ActivityScannerProps) {
  const { dict, t } = useTranslation();
  const [expandedPrKeys, setExpandedPrKeys] = useState<Set<string>>(() => new Set());

  const uniqueRepos = useMemo(
    () => Array.from(new Set(activities.map((a) => a.repo))).sort(),
    [activities],
  );

  const visibleActivities = useMemo(() => {
    if (repoFilter === 'ALL') return activities;
    return activities.filter((a) => a.repo === repoFilter);
  }, [activities, repoFilter]);

  const totalCommits = visibleActivities.reduce((sum, pr) => sum + pr.commits.length, 0);
  const selectedInVisible = visibleActivities.filter((pr) =>
    selectedPrKeys.has(getPrKey(pr)),
  ).length;

  const toggleExpandCommits = (key: string) => {
    setExpandedPrKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const getPrStateBadge = (state: string) => {
    const normalized = state.toLowerCase();
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
    return {
      label: dict.scanner.stateClosed,
      badgeClass: 'bg-slate-800 text-slate-300 border border-slate-700',
      iconClass: 'text-slate-400',
      Icon: GitPullRequest,
    };
  };

  return (
    <section aria-labelledby="activity-scanner-heading" className="space-y-4">
      {/* Scanner Control Panel */}
      <ShowcaseCard className="p-5 sm:p-6">
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2
                  id="activity-scanner-heading"
                  className="text-base font-semibold text-slate-100 tracking-tight"
                >
                  {dict.scanner.title}
                </h2>
                {visibleActivities.length > 0 && (
                  <span className="text-xs font-mono text-sky-400 tabular-nums">
                    {t('scanner.summaryStats', {
                      prs: visibleActivities.length,
                      commits: totalCommits,
                    })}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {dict.scanner.description}
              </p>
            </div>

            {/* Timeframe Filter & Sync Trigger */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <SegmentedControl
                value={sinceOption}
                onChange={onSinceOptionChange}
                ariaLabel={dict.scanner.rangeLabel}
                options={[
                  { value: 'today', label: dict.scanner.rangeToday },
                  { value: '24h', label: dict.scanner.range24h },
                  { value: '7d', label: dict.scanner.range7d },
                ]}
              />

              <button
                type="button"
                onClick={onScan}
                disabled={isLoading}
                className="gp-cta-shimmer inline-flex items-center justify-center gap-2 min-h-[36px] px-4 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-sky-500 hover:bg-sky-400 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>{isLoading ? dict.scanner.syncingBtn : dict.scanner.syncBtn}</span>
              </button>
            </div>
          </div>

          {/* Repo Filter Pills & Selection Toolbar */}
          {activities.length > 0 && (
            <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {uniqueRepos.length > 1 ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onRepoFilterChange('ALL')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      repoFilter === 'ALL'
                        ? 'bg-sky-500/15 text-sky-300 border border-sky-500/35'
                        : 'bg-[#0C0E14] text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {dict.scanner.allRepos}
                  </button>
                  {uniqueRepos.map((repo) => {
                    const shortName = repo.includes('/') ? repo.split('/')[1] || repo : repo;
                    const active = repoFilter === repo;
                    return (
                      <button
                        key={repo}
                        type="button"
                        onClick={() => onRepoFilterChange(repo)}
                        title={repo}
                        className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer max-w-[180px] truncate ${
                          active
                            ? 'bg-sky-500/15 text-sky-300 border border-sky-500/35'
                            : 'bg-[#0C0E14] text-slate-400 hover:text-slate-200 border border-slate-800'
                        }`}
                      >
                        {shortName}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <span className="text-xs font-mono text-slate-400 truncate">{uniqueRepos[0]}</span>
              )}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                <span className="text-slate-400 tabular-nums whitespace-nowrap">
                  {t('scanner.selectedSummary', {
                    selected: selectedInVisible,
                    total: visibleActivities.length,
                  })}
                </span>
                <div className="flex items-center gap-2 sm:border-l sm:border-slate-800 sm:pl-3 shrink-0">
                  <button
                    type="button"
                    onClick={onSelectAllPrs}
                    className="text-sky-400 hover:text-sky-300 font-medium cursor-pointer transition-colors whitespace-nowrap"
                  >
                    {dict.scanner.selectAll}
                  </button>
                  <span className="text-slate-700" aria-hidden="true">
                    /
                  </span>
                  <button
                    type="button"
                    onClick={onClearPrSelection}
                    className="text-slate-400 hover:text-slate-200 font-medium cursor-pointer transition-colors whitespace-nowrap"
                  >
                    {dict.scanner.clearSelection}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Subtle SWR Revalidating Hint while cached data stays visible */}
          {isLoading && activities.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-sky-400 font-mono">
              <RefreshCw className="w-3 h-3 animate-spin" aria-hidden="true" />
              <span>{dict.scanner.revalidatingHint}</span>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}
        </div>
      </ShowcaseCard>

      {/* Content Area: Skeleton on first load | Activity Cards | Clean Empty State */}
      {isLoading && activities.length === 0 ? (
        <ActivityListSkeleton count={3} />
      ) : visibleActivities.length > 0 ? (
        <ul role="list" className="space-y-3">
          {visibleActivities.map((pr, index) => {
            const prKey = getPrKey(pr);
            const isSelected = selectedPrKeys.has(prKey);
            const isExpanded = expandedPrKeys.has(prKey);
            const hasMoreCommits = pr.commits.length > COMMITS_PREVIEW_LIMIT;
            const previewCommits = pr.commits.slice(0, COMMITS_PREVIEW_LIMIT);
            const hiddenCommits = pr.commits.slice(COMMITS_PREVIEW_LIMIT);

            const stateInfo = getPrStateBadge(pr.state);
            const StateIcon = stateInfo.Icon;

            return (
              <ShowcaseCard
                key={prKey}
                as="li"
                staggerIndex={index}
                className={`p-5 min-w-0 transition-opacity ${
                  isSelected ? 'opacity-100' : 'opacity-65'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Accessible Selection Toggle */}
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isSelected}
                      aria-label={t('scanner.selectPrAria', { title: pr.title })}
                      onClick={() => onTogglePrSelection(prKey)}
                      className={`mt-1 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
                        isSelected
                          ? 'bg-sky-500 border-sky-500 text-slate-950'
                          : 'bg-[#0C0E14] border-slate-700 hover:border-slate-500 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                    </button>

                    <div
                      className={`w-9 h-9 rounded-lg bg-[#161A24] border border-slate-800 flex items-center justify-center shrink-0 mt-0.5 ${stateInfo.iconClass}`}
                      aria-hidden="true"
                    >
                      <StateIcon className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="font-mono font-medium text-sky-400 break-all">
                          {pr.repo}
                        </span>
                        <span className="text-slate-600" aria-hidden="true">
                          /
                        </span>
                        <span className="font-mono text-slate-400 tabular-nums">#{pr.number}</span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-xs font-medium ${stateInfo.badgeClass}`}
                        >
                          {stateInfo.label}
                        </span>
                      </div>

                      <h3 className="text-sm font-semibold text-slate-100 mt-1.5 leading-snug break-words">
                        {pr.title}
                      </h3>
                    </div>
                  </div>

                  <a
                    href={pr.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={dict.scanner.openPrExternal}
                    aria-label={`${dict.scanner.openPrExternal} #${pr.number}`}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
                  >
                    <ExternalLink className="w-4 h-4" aria-hidden="true" />
                  </a>
                </div>

                {/* Commits Timeline with Smooth CSS Grid Accordion */}
                <div className="mt-4 pt-3.5 border-t border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-mono text-slate-400 flex items-center gap-2 tabular-nums">
                      <GitCommit
                        className="w-3.5 h-3.5 text-slate-400 shrink-0"
                        aria-hidden="true"
                      />
                      <span>{t('scanner.commitsCount', { count: pr.commits.length })}</span>
                    </p>

                    {hasMoreCommits && (
                      <button
                        type="button"
                        onClick={() => toggleExpandCommits(prKey)}
                        aria-expanded={isExpanded}
                        className="inline-flex items-center gap-1 text-xs font-medium text-sky-400 hover:text-sky-300 cursor-pointer transition-colors"
                      >
                        <span>
                          {isExpanded
                            ? dict.scanner.collapseCommits
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

                  <ul role="list" className="space-y-1.5 pl-3.5 border-l border-slate-800">
                    {previewCommits.map((commit, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 text-xs text-slate-300 leading-relaxed min-w-0"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0 mt-1.5"
                          aria-hidden="true"
                        />
                        <span className="break-words min-w-0">{commit}</span>
                      </li>
                    ))}
                  </ul>

                  {hasMoreCommits && (
                    <div className="gp-accordion-grid" data-open={isExpanded ? 'true' : 'false'}>
                      <div className="gp-accordion-inner">
                        <ul
                          role="list"
                          className="space-y-1.5 pl-3.5 border-l border-slate-800 pt-1"
                        >
                          {hiddenCommits.map((commit, idx) => (
                            <li
                              key={idx}
                              className="flex items-start gap-2.5 text-xs text-slate-300 leading-relaxed min-w-0"
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0 mt-1.5"
                                aria-hidden="true"
                              />
                              <span className="break-words min-w-0">{commit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </ShowcaseCard>
            );
          })}
        </ul>
      ) : (
        <ShowcaseCard className="p-8 sm:p-12 text-center">
          <div className="flex flex-col items-center justify-center">
            <div
              className="w-12 h-12 rounded-xl bg-[#161A24] border border-slate-800 flex items-center justify-center text-slate-400 mb-4"
              aria-hidden="true"
            >
              <GitPullRequest className="w-5 h-5 text-slate-400" />
            </div>

            <h3 className="text-sm font-semibold text-slate-100 mb-1.5">
              {dict.scanner.emptyTitle}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-5 leading-relaxed">
              {dict.scanner.emptyDesc}
            </p>

            <button
              type="button"
              onClick={onScan}
              disabled={isLoading}
              className="gp-cta-shimmer inline-flex items-center justify-center gap-2 min-h-[38px] px-5 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-sky-500 hover:bg-sky-400 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <span>{dict.scanner.emptyAction}</span>
            </button>
          </div>
        </ShowcaseCard>
      )}
    </section>
  );
}
