'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { Footer } from '../layout/Footer';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`gp-skeleton rounded-lg ${className}`} />;
}

export function WorkspaceSkeleton() {
  const { dict } = useTranslation();

  return (
    <div
      aria-busy="true"
      aria-label={dict.auth.workspaceLoading}
      className="flex-1 min-h-0 flex flex-col overflow-hidden"
    >
      {/* Skeleton Header (Pinned Top) */}
      <div className="shrink-0 w-full border-b border-white/[0.12] bg-[#0F172A]/82 backdrop-blur-xl">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <Skeleton className="w-24 h-5" />
          </div>
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-16 h-8" />
            <Skeleton className="w-20 h-8 hidden sm:block" />
            <Skeleton className="w-28 h-8" />
            <Skeleton className="w-8 h-8 rounded-full" />
          </div>
        </div>
      </div>

      {/* Scrollable Body + Footer */}
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar">
        <main className="flex-1 flex flex-col max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <Skeleton className="w-56 h-7" />
            <Skeleton className="w-72 h-4" />
          </div>

          {/* Summary Strip Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>

          {/* 12-Col Workspace Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 xl:col-span-8 space-y-4">
              <Skeleton className="h-28 rounded-xl" />
              <ActivityListSkeleton count={2} />
            </div>
            <div className="lg:col-span-5 xl:col-span-4">
              <Skeleton className="h-[360px] rounded-xl" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}

export function ActivityListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div aria-busy="true" className="space-y-3">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="gp-card rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-32 h-3.5" />
                  <Skeleton className="w-14 h-4 rounded-md" />
                </div>
                <Skeleton className="w-4/5 h-4" />
              </div>
            </div>
            <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
          </div>
          <div className="pt-3 border-t border-slate-700/80 space-y-2">
            <Skeleton className="w-36 h-3" />
            <div className="pl-3.5 border-l border-slate-700/80 space-y-1.5">
              <Skeleton className="w-11/12 h-3.5" />
              <Skeleton className="w-3/4 h-3.5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function StandupOutputSkeleton() {
  const { dict } = useTranslation();

  return (
    <section
      aria-busy="true"
      aria-label={dict.standupDock.generatingTitle}
      className="gp-card rounded-xl p-5 sm:p-6 space-y-4 gp-fade-in"
    >
      <div className="flex items-center gap-3 border-b border-slate-700/80 pb-4">
        <div
          className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400 shrink-0"
          aria-hidden="true"
        >
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-100">
            {dict.standupDock.generatingTitle}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{dict.standupDock.generatingSubtitle}</p>
        </div>
      </div>

      <div className="p-4 sm:p-5 rounded-lg bg-[#152033] border border-slate-700/80 space-y-3">
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
    </section>
  );
}

export function HistoryListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div aria-busy="true" className="space-y-3">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="p-4 rounded-xl bg-[#152033] border border-slate-700/80 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="w-36 h-3.5" />
              <Skeleton className="w-24 h-3.5" />
            </div>
            <div className="flex items-center gap-1.5">
              <Skeleton className="w-8 h-8 rounded-lg" />
              <Skeleton className="w-8 h-8 rounded-lg" />
            </div>
          </div>
          <Skeleton className="w-full h-20 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
