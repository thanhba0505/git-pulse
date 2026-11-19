'use client';

import React, { useEffect, useRef, useState } from 'react';
import { PrActivity } from '../../types';
import { useTranslation } from '../../i18n';
import { ShowcaseCard } from '../ui/ShowcaseCard';
import { GitPullRequest, GitCommit, FolderGit2 } from 'lucide-react';

interface ActivitySummaryStripProps {
  activities: PrActivity[];
}

function useAnimatedNumber(target: number): number {
  const [display, setDisplay] = useState(target);
  const currentRef = useRef(target);

  useEffect(() => {
    const startValue = currentRef.current;
    if (startValue === target) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      currentRef.current = target;
      const frame = window.requestAnimationFrame(() => setDisplay(target));
      return () => window.cancelAnimationFrame(frame);
    }

    const duration = 380;
    const startTime = performance.now();
    let rafId = 0;

    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(startValue + (target - startValue) * eased);
      currentRef.current = nextValue;
      setDisplay(nextValue);

      if (progress < 1) {
        rafId = window.requestAnimationFrame(step);
      }
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [target]);

  return display;
}

export function ActivitySummaryStrip({ activities }: ActivitySummaryStripProps) {
  const { dict, t } = useTranslation();

  const totalPrs = activities.filter((p) => p.activityType !== 'direct_commits').length;
  const openPrs = activities.filter((p) => p.state.toLowerCase() === 'open').length;
  const draftPrs = activities.filter((p) => p.state.toLowerCase() === 'draft').length;
  const mergedPrs = activities.filter((p) => p.state.toLowerCase() === 'merged').length;
  const closedPrs = activities.filter((p) => p.state.toLowerCase() === 'closed').length;
  const totalCommits = activities.reduce((sum, pr) => sum + pr.commits.length, 0);
  const activeRepos = new Set(activities.map((pr) => pr.repo)).size;

  const animatedPrs = useAnimatedNumber(totalPrs);
  const animatedCommits = useAnimatedNumber(totalCommits);
  const animatedRepos = useAnimatedNumber(activeRepos);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 gp-fade-in">
      <ShowcaseCard tiltStrength={2.2} className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-400">{dict.summaryStrip.prsLabel}</p>
            <p className="text-2xl font-bold text-slate-100 mt-1 font-mono tabular-nums tracking-tight">
              {animatedPrs}
            </p>
            <p className="text-xs text-slate-400 mt-1 tabular-nums">
              {t('summaryStrip.prsBreakdown', {
                open: openPrs,
                draft: draftPrs,
                merged: mergedPrs,
              })}
              {closedPrs > 0 ? ` • ${closedPrs} ${dict.scanner.stateClosed}` : ''}
            </p>
          </div>
          <div
            className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0"
            aria-hidden="true"
          >
            <GitPullRequest className="w-4 h-4" />
          </div>
        </div>
      </ShowcaseCard>

      <ShowcaseCard tiltStrength={2.2} className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-400">{dict.summaryStrip.commitsLabel}</p>
            <p className="text-2xl font-bold text-slate-100 mt-1 font-mono tabular-nums tracking-tight">
              {animatedCommits}
            </p>
            <p className="text-xs text-slate-400 mt-1">{dict.summaryStrip.commitsSubtitle}</p>
          </div>
          <div
            className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0"
            aria-hidden="true"
          >
            <GitCommit className="w-4 h-4" />
          </div>
        </div>
      </ShowcaseCard>

      <ShowcaseCard tiltStrength={2.2} className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-400">{dict.summaryStrip.reposLabel}</p>
            <p className="text-2xl font-bold text-slate-100 mt-1 font-mono tabular-nums tracking-tight">
              {animatedRepos}
            </p>
            <p className="text-xs text-slate-400 mt-1">{dict.summaryStrip.reposSubtitle}</p>
          </div>
          <div
            className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0"
            aria-hidden="true"
          >
            <FolderGit2 className="w-4 h-4" />
          </div>
        </div>
      </ShowcaseCard>
    </div>
  );
}
