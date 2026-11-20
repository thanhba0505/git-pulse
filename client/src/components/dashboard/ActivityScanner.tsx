'use client';

import React, { useMemo, useState } from 'react';
import {
  GitHubWorkspacesResponse,
  GroupingMode,
  PrActivity,
  PrState,
  TaskColor,
  TrackingTask,
} from '../../types';
import { useTranslation } from '../../i18n';
import { getPrKey as computePrKey, getPrStateStyle } from '../../lib/activity-utils';
import { SegmentedControl, SegmentedOption } from '../ui/SegmentedControl';
import { ShowcaseCard } from '../ui/ShowcaseCard';
import { ActivityListSkeleton } from '../ui/Skeleton';
import { useSmoothButtonWidth } from '../../lib/use-smooth-button-width';
import { PrActivityCard } from './PrActivityCard';
import { TaskTrackerView } from './TaskTrackerView';
import {
  AlertCircle,
  Building2,
  ChevronDown,
  FolderGit2,
  GitPullRequest,
  Info,
  RefreshCw,
  SlidersHorizontal,
  User,
} from 'lucide-react';

export const getPrKey = computePrKey;

interface ActivityScannerProps {
  activities: PrActivity[];
  isLoading: boolean;
  error?: string | null;
  onScan: () => void;
  sinceOption: 'today' | '24h' | '7d';
  onSinceOptionChange: (opt: 'today' | '24h' | '7d') => void;
  repoFilter: string;
  onRepoFilterChange: (repo: string) => void;
  groupBy: GroupingMode;
  onGroupByChange: (mode: GroupingMode) => void;
  compactCommits: boolean;
  workspaces: GitHubWorkspacesResponse | null;
  includePersonalEnabled: boolean;
  onOpenFetchSettings: () => void;
  selectedPrKeys: ReadonlySet<string>;
  onTogglePrSelection: (key: string) => void;
  onSelectKeysBatch: (keys: string[], select: boolean) => void;
  onSelectAllPrs: () => void;
  onClearPrSelection: () => void;
  tasks: TrackingTask[];
  onCreateTask: (title: string, color: TaskColor, prs: PrActivity[]) => Promise<void>;
  onRenameTask: (taskId: string, title: string, color: TaskColor) => Promise<void>;
  onToggleTaskComplete: (taskId: string, isCompleted: boolean) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onToggleTaskAssignment: (taskId: string, pr: PrActivity, isAssigned: boolean) => Promise<void>;
  onRemoveTaskItem: (taskId: string, repo: string, prNumber: number) => Promise<void>;
}

type StateFilter = 'ALL' | PrState;

interface OwnerGroupSection {
  key: string;
  ownerType: 'personal' | 'organization';
  label: string;
  avatarUrl?: string;
  items: PrActivity[];
}

export function ActivityScanner({
  activities,
  isLoading,
  error,
  onScan,
  sinceOption,
  onSinceOptionChange,
  repoFilter,
  onRepoFilterChange,
  groupBy,
  onGroupByChange,
  compactCommits,
  workspaces,
  includePersonalEnabled,
  onOpenFetchSettings,
  selectedPrKeys,
  onTogglePrSelection,
  onSelectKeysBatch,
  onSelectAllPrs,
  onClearPrSelection,
  tasks,
  onCreateTask,
  onRenameTask,
  onToggleTaskComplete,
  onDeleteTask,
  onToggleTaskAssignment,
  onRemoveTaskItem,
}: ActivityScannerProps) {
  const { dict, t } = useTranslation();
  const refreshBtnRef = useSmoothButtonWidth(isLoading);
  const [stateFilter, setStateFilter] = useState<StateFilter>('ALL');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => new Set());

  const groupByOptions = useMemo<readonly SegmentedOption<GroupingMode>[]>(
    () => [
      { value: 'owner', label: dict.scanner.groupOwner },
      { value: 'task', label: dict.scanner.groupTask },
      { value: 'repo', label: dict.scanner.groupRepo },
      { value: 'flat', label: dict.scanner.groupFlat },
    ],
    [
      dict.scanner.groupOwner,
      dict.scanner.groupTask,
      dict.scanner.groupRepo,
      dict.scanner.groupFlat,
    ],
  );

  const uniqueRepos = useMemo(
    () => Array.from(new Set(activities.map((a) => a.repo))).sort(),
    [activities],
  );

  const visibleActivities = useMemo(() => {
    return activities.filter((act) => {
      if (repoFilter !== 'ALL' && act.repo !== repoFilter) return false;
      if (stateFilter !== 'ALL' && act.state !== stateFilter) return false;
      return true;
    });
  }, [activities, repoFilter, stateFilter]);

  const ownerSections = useMemo<OwnerGroupSection[]>(() => {
    const personalItems: PrActivity[] = [];
    const orgMap = new Map<string, OwnerGroupSection>();

    for (const act of visibleActivities) {
      if (act.ownerType === 'personal') {
        personalItems.push(act);
      } else {
        const orgKey = `org:${act.owner}`;
        const existing = orgMap.get(orgKey);
        if (existing) {
          existing.items.push(act);
        } else {
          orgMap.set(orgKey, {
            key: orgKey,
            ownerType: 'organization',
            label: act.owner,
            avatarUrl: act.ownerAvatar,
            items: [act],
          });
        }
      }
    }

    const sections: OwnerGroupSection[] = [];
    if (personalItems.length > 0) {
      sections.push({
        key: 'personal',
        ownerType: 'personal',
        label: workspaces?.personal.login
          ? `${dict.scanner.personalSpace} (@${workspaces.personal.login})`
          : dict.scanner.personalSpace,
        avatarUrl: workspaces?.personal.avatarUrl ?? personalItems[0]?.ownerAvatar,
        items: personalItems,
      });
    }

    const sortedOrgs = Array.from(orgMap.values()).sort((a, b) => a.label.localeCompare(b.label));
    sections.push(...sortedOrgs);
    return sections;
  }, [visibleActivities, workspaces, dict.scanner.personalSpace]);

  const repoSections = useMemo(() => {
    const map = new Map<string, PrActivity[]>();
    for (const act of visibleActivities) {
      const list = map.get(act.repo) ?? [];
      list.push(act);
      map.set(act.repo, list);
    }
    return Array.from(map.entries()).map(([repo, items]) => ({
      key: `repo:${repo}`,
      repo,
      items,
    }));
  }, [visibleActivities]);

  const selectedInVisible = visibleActivities.filter((pr) =>
    selectedPrKeys.has(computePrKey(pr)),
  ).length;

  const hasPersonalActivities = activities.some((a) => a.ownerType === 'personal');
  const shouldShowPersonalAccessHint =
    !isLoading &&
    includePersonalEnabled &&
    !hasPersonalActivities &&
    (workspaces?.personal.accessibleRepoCount === 0 || activities.length > 0);

  const toggleSectionCollapse = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderSectionGroup = (
    sectionKey: string,
    icon: React.ReactNode,
    title: string,
    items: PrActivity[],
  ) => {
    const isCollapsed = collapsedSections.has(sectionKey);
    const keys = items.map(computePrKey);
    const allSelected = keys.length > 0 && keys.every((k) => selectedPrKeys.has(k));
    const sectionCommits = items.reduce((sum, item) => sum + item.commits.length, 0);

    return (
      <div key={sectionKey} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <button
            type="button"
            onClick={() => toggleSectionCollapse(sectionKey)}
            aria-expanded={!isCollapsed}
            className="inline-flex items-center gap-2 text-left group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 rounded-lg py-0.5"
          >
            <span className="flex items-center justify-center w-6 h-6 rounded-md bg-white/[0.08] border border-white/[0.15] text-slate-200">
              {icon}
            </span>
            <span className="text-sm font-semibold text-slate-100 group-hover:text-sky-300 transition-colors">
              {title}
            </span>
            <span className="text-xs font-mono text-slate-400 tabular-nums">
              ({t('scanner.groupCount', { prs: items.length, commits: sectionCommits })})
            </span>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                isCollapsed ? '-rotate-90' : ''
              }`}
              aria-hidden="true"
            />
          </button>

          <button
            type="button"
            onClick={() => onSelectKeysBatch(keys, !allSelected)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              allSelected
                ? 'bg-sky-500/15 text-sky-300 border-sky-400/30 hover:bg-sky-500/20'
                : 'bg-white/[0.07] text-slate-200 hover:text-white border-white/[0.14] hover:border-white/[0.24]'
            }`}
          >
            {allSelected ? dict.scanner.clearGroup : dict.scanner.selectGroup}
          </button>
        </div>

        {!isCollapsed && (
          <ul role="list" className="space-y-3">
            {items.map((pr, idx) => (
              <PrActivityCard
                key={computePrKey(pr)}
                pr={pr}
                index={idx}
                isSelected={selectedPrKeys.has(computePrKey(pr))}
                compactCommits={compactCommits}
                tasks={tasks}
                onToggleSelect={onTogglePrSelection}
                onToggleTaskAssignment={onToggleTaskAssignment}
                onCreateTaskWithPr={async (taskTitle, targetPr) => {
                  await onCreateTask(taskTitle, 'sky', [targetPr]);
                }}
              />
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <section aria-labelledby="activity-scanner-heading" className="space-y-4">
      {/* Scanner Control Panel */}
      <ShowcaseCard className="p-5 sm:p-6">
        <div className="space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="activity-scanner-heading"
                className="text-base font-semibold text-slate-100 tracking-tight"
              >
                {dict.scanner.title}
              </h2>
            </div>

            {/* Timeframe Filter + Fetch Settings + Refresh Trigger */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <SegmentedControl
                value={sinceOption}
                onChange={onSinceOptionChange}
                ariaLabel={dict.scanner.rangeLabel}
                size="sm"
                disabled={isLoading}
                options={[
                  { value: 'today', label: dict.scanner.rangeToday },
                  { value: '24h', label: dict.scanner.range24h },
                  { value: '7d', label: dict.scanner.range7d },
                ]}
              />

              <button
                type="button"
                onClick={onOpenFetchSettings}
                title={dict.scanner.fetchSettingsBtn}
                className="inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-medium text-slate-100 hover:text-white bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.15] hover:border-white/[0.24] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
              >
                <SlidersHorizontal
                  className="w-3.5 h-3.5 text-sky-400 shrink-0"
                  aria-hidden="true"
                />
                <span className="hidden sm:inline">{dict.scanner.fetchSettingsBtn}</span>
              </button>

              <button
                ref={refreshBtnRef}
                type="button"
                onClick={onScan}
                disabled={isLoading}
                className="gp-cta-shimmer inline-flex items-center justify-center gap-2 min-h-[34px] px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-950 bg-sky-500 hover:bg-sky-400 active:scale-[0.97] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 overflow-hidden whitespace-nowrap"
              >
                <span
                  key={String(isLoading)}
                  className="inline-flex items-center gap-2 animate-[gp-fade-in_180ms_cubic-bezier(0.16,1,0.3,1)_both]"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 shrink-0 ${isLoading ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  <span>{isLoading ? dict.scanner.syncingBtn : dict.scanner.syncBtn}</span>
                </span>
              </button>
            </div>
          </div>

          {/* Grouping Mode Switcher + Selection Toolbar */}
          <div className="pt-3 border-t border-white/[0.12] flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl
              value={groupBy}
              onChange={onGroupByChange}
              ariaLabel={dict.scanner.groupByLabel}
              size="sm"
              className="max-w-full overflow-x-auto"
              options={groupByOptions}
            />

            {activities.length > 0 && (
              <div
                className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs ml-auto transition-opacity duration-200 ${
                  groupBy === 'task'
                    ? 'opacity-0 pointer-events-none select-none invisible'
                    : 'opacity-100'
                }`}
              >
                <span className="text-slate-300 tabular-nums whitespace-nowrap">
                  {t('scanner.selectedSummary', {
                    selected: selectedInVisible,
                    total: visibleActivities.length,
                  })}
                </span>
                <div className="flex items-center gap-2 border-l border-slate-600/80 pl-3 shrink-0">
                  <button
                    type="button"
                    onClick={onSelectAllPrs}
                    className="text-sky-400 hover:text-sky-300 font-medium cursor-pointer transition-colors whitespace-nowrap"
                  >
                    {dict.scanner.selectAll}
                  </button>
                  <span className="text-slate-400/70" aria-hidden="true">
                    /
                  </span>
                  <button
                    type="button"
                    onClick={onClearPrSelection}
                    className="text-slate-300 hover:text-white font-medium cursor-pointer transition-colors whitespace-nowrap"
                  >
                    {dict.scanner.clearSelection}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* State & Repo Filter Bar */}
          {activities.length > 0 && (
            <div className="gp-accordion-grid" data-open={groupBy !== 'task' ? 'true' : 'false'}>
              <div className="gp-accordion-inner overflow-hidden">
                <div className="pt-3 border-t border-white/[0.1] space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(
                        [
                          { key: 'ALL', label: dict.scanner.stateFilterAll },
                          { key: 'draft', label: dict.scanner.stateDraft },
                          { key: 'open', label: dict.scanner.stateOpen },
                          { key: 'merged', label: dict.scanner.stateMerged },
                          { key: 'closed', label: dict.scanner.stateClosed },
                          { key: 'direct_commits', label: dict.scanner.directCommitsBadge },
                        ] as Array<{ key: StateFilter; label: string }>
                      ).map((item) => {
                        const isActive = stateFilter === item.key;
                        const stateStyle = item.key !== 'ALL' ? getPrStateStyle(item.key) : null;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => setStateFilter(item.key)}
                            className={`inline-flex items-center gap-1.5 min-h-[30px] px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                              isActive
                                ? stateStyle
                                  ? stateStyle.badgeClass
                                  : 'bg-sky-500/20 text-sky-200 border border-sky-400/50'
                                : 'bg-[#152033] text-slate-200 hover:text-white border border-slate-600/80 hover:border-slate-500 hover:bg-[#253349]'
                            }`}
                          >
                            {stateStyle && (
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${stateStyle.dotClass}`}
                                aria-hidden="true"
                              />
                            )}
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {uniqueRepos.length === 1 && (
                      <span className="text-xs font-mono text-slate-400 truncate">
                        {uniqueRepos[0]}
                      </span>
                    )}
                  </div>

                  {uniqueRepos.length > 1 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onRepoFilterChange('ALL')}
                        className={`min-h-[30px] px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          repoFilter === 'ALL'
                            ? 'bg-sky-500/20 text-sky-200 border border-sky-400/50'
                            : 'bg-[#152033] text-slate-200 hover:text-white border border-slate-600/80 hover:border-slate-500 hover:bg-[#253349]'
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
                            className={`min-h-[30px] px-2.5 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer max-w-[180px] truncate ${
                              active
                                ? 'bg-sky-500/20 text-sky-200 border border-sky-400/50'
                                : 'bg-[#152033] text-slate-200 hover:text-white border border-slate-600/80 hover:border-slate-500 hover:bg-[#253349]'
                            }`}
                          >
                            {shortName}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </ShowcaseCard>

      {/* Diagnostic hint if personal items didn't appear */}
      {shouldShowPersonalAccessHint && groupBy !== 'task' && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-sky-500/[0.06] border border-sky-400/20 text-xs text-slate-300">
          <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="font-semibold text-slate-200">{dict.scanner.noPersonalNoticeTitle}</p>
            <p className="text-slate-400 leading-relaxed">{dict.scanner.noPersonalNoticeDesc}</p>
          </div>
          <button
            type="button"
            onClick={onOpenFetchSettings}
            className="shrink-0 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-sky-300 font-medium cursor-pointer"
          >
            {dict.scanner.fetchSettingsBtn}
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {isLoading && activities.length === 0 ? (
        <ActivityListSkeleton count={3} />
      ) : (
        <div key={groupBy} className="gp-tab-content-enter">
          {groupBy === 'task' ? (
            <TaskTrackerView
              tasks={tasks}
              activities={activities}
              selectedPrKeys={selectedPrKeys}
              compactCommits={compactCommits}
              onTogglePrSelection={onTogglePrSelection}
              onCreateTask={onCreateTask}
              onRenameTask={onRenameTask}
              onToggleTaskComplete={onToggleTaskComplete}
              onDeleteTask={onDeleteTask}
              onToggleTaskAssignment={onToggleTaskAssignment}
              onRemoveTaskItem={onRemoveTaskItem}
            />
          ) : visibleActivities.length > 0 ? (
            groupBy === 'owner' ? (
              <div className="space-y-6">
                {ownerSections.map((section) =>
                  renderSectionGroup(
                    section.key,
                    section.ownerType === 'organization' ? (
                      <Building2 className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
                    ),
                    section.ownerType === 'organization'
                      ? `${dict.scanner.orgSpace}: ${section.label}`
                      : section.label,
                    section.items,
                  ),
                )}
              </div>
            ) : groupBy === 'repo' ? (
              <div className="space-y-6">
                {repoSections.map((section) =>
                  renderSectionGroup(
                    section.key,
                    <FolderGit2 className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />,
                    section.repo,
                    section.items,
                  ),
                )}
              </div>
            ) : (
              <ul role="list" className="space-y-3">
                {visibleActivities.map((pr, index) => (
                  <PrActivityCard
                    key={computePrKey(pr)}
                    pr={pr}
                    index={index}
                    isSelected={selectedPrKeys.has(computePrKey(pr))}
                    compactCommits={compactCommits}
                    tasks={tasks}
                    onToggleSelect={onTogglePrSelection}
                    onToggleTaskAssignment={onToggleTaskAssignment}
                    onCreateTaskWithPr={async (taskTitle, targetPr) => {
                      await onCreateTask(taskTitle, 'sky', [targetPr]);
                    }}
                  />
                ))}
              </ul>
            )
          ) : (
            <ShowcaseCard className="p-8 sm:p-12 text-center">
              <div className="flex flex-col items-center justify-center">
                <div
                  className="w-12 h-12 rounded-xl bg-[#253349] border border-slate-600/80 flex items-center justify-center text-slate-300 mb-4"
                  aria-hidden="true"
                >
                  <GitPullRequest className="w-5 h-5 text-slate-300" />
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
        </div>
      )}
    </section>
  );
}
