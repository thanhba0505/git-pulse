'use client';

import React from 'react';
import { PrActivity } from '../../types';
import { useTranslation } from '../../i18n';
import { SegmentedControl } from '../ui/SegmentedControl';
import {
  GitPullRequest,
  GitMerge,
  GitCommit,
  ExternalLink,
  RefreshCw,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface ActivityScannerProps {
  activities: PrActivity[];
  isLoading: boolean;
  error?: string | null;
  onScan: () => void;
  sinceOption: 'today' | '24h' | '7d';
  onSinceOptionChange: (opt: 'today' | '24h' | '7d') => void;
}

export function ActivityScanner({
  activities,
  isLoading,
  error,
  onScan,
  sinceOption,
  onSinceOptionChange,
}: ActivityScannerProps) {
  const { dict, t } = useTranslation();
  const totalCommits = activities.reduce((sum, pr) => sum + pr.commits.length, 0);

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
        badgeClass: 'bg-violet-500/10 text-violet-300 border border-violet-500/25',
        iconClass: 'text-violet-400',
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
      <div className="gp-card rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2
                id="activity-scanner-heading"
                className="text-base font-semibold text-slate-100 tracking-tight"
              >
                {dict.scanner.title}
              </h2>
              {activities.length > 0 && (
                <span className="text-xs font-mono text-sky-400 tabular-nums">
                  {t('scanner.summaryStats', { prs: activities.length, commits: totalCommits })}
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
              className="inline-flex items-center justify-center gap-2 min-h-[36px] px-4 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-sky-500 hover:bg-sky-400 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{isLoading ? dict.scanner.syncingBtn : dict.scanner.syncBtn}</span>
            </button>
          </div>
        </div>

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

      {/* PR Activity List or Empty State */}
      {activities.length > 0 ? (
        <ul role="list" className="space-y-3">
          {activities.map((pr) => {
            const stateInfo = getPrStateBadge(pr.state);
            const StateIcon = stateInfo.Icon;

            return (
              <li
                key={`${pr.repo}#${pr.number}`}
                className="gp-card hover:border-slate-700/90 rounded-xl p-5 transition-colors min-w-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
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

                {/* Commits Timeline */}
                <div className="mt-4 pt-3.5 border-t border-slate-800/80 space-y-2.5">
                  <p className="text-xs font-mono text-slate-400 flex items-center gap-2 tabular-nums">
                    <GitCommit className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                    <span>{t('scanner.commitsCount', { count: pr.commits.length })}</span>
                  </p>

                  <ul role="list" className="space-y-1.5 pl-3.5 border-l border-slate-800">
                    {pr.commits.map((commit, idx) => (
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
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="gp-card rounded-xl p-8 sm:p-12 text-center flex flex-col items-center justify-center">
          <div
            className="w-12 h-12 rounded-xl bg-[#161A24] border border-slate-800 flex items-center justify-center text-slate-400 mb-4"
            aria-hidden="true"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
            ) : (
              <GitPullRequest className="w-5 h-5 text-slate-400" />
            )}
          </div>

          <h3 className="text-sm font-semibold text-slate-100 mb-1.5">
            {isLoading ? dict.scanner.emptyLoadingTitle : dict.scanner.emptyTitle}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-5 leading-relaxed">
            {dict.scanner.emptyDesc}
          </p>

          <button
            type="button"
            onClick={onScan}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 min-h-[38px] px-5 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-sky-500 hover:bg-sky-400 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
            <span>{isLoading ? dict.scanner.syncingBtn : dict.scanner.emptyAction}</span>
          </button>
        </div>
      )}
    </section>
  );
}
