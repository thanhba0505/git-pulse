'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AiConnectionSummary,
  FetchPreferences,
  GitAccountSummary,
  GitHubWorkspacesResponse,
  PrStateFilter,
} from '../../types';
import { useTranslation } from '../../i18n';
import { getPrStateStyle, formatExpiration } from '../../lib/activity-utils';
import { useAmbientMotionPreference } from '../../lib/motion-preference';
import { ModalDialog } from '../ui/ModalDialog';
import { SegmentedControl } from '../ui/SegmentedControl';
import {
  AlertCircle,
  Building2,
  Check,
  Clock,
  GitBranch,
  KeyRound,
  Languages,
  LayoutGrid,
  Loader2,
  Plus,
  RefreshCw,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react';

export type SettingsTabKey = 'fetch' | 'display' | 'general';

interface SettingsModalProps {
  isOpen: boolean;
  initialTab?: SettingsTabKey;
  onClose: () => void;
  accounts: GitAccountSummary[];
  aiConnections: readonly AiConnectionSummary[];
  workspaces: GitHubWorkspacesResponse | null;
  preferences: FetchPreferences;
  onSavePreferences: (next: FetchPreferences) => Promise<void>;
  onSwitchAccount: (accountId: string) => Promise<void>;
  onDisconnectAccount: (accountId: string) => Promise<void>;
  onOpenAddAccount: () => void;
  onOpenAddAi: () => void;
  onOpenUpdateAi: (connection: AiConnectionSummary) => void;
  onRefreshAiModels: (connectionId: string) => Promise<void>;
  onDeleteAiConnection: (connectionId: string) => Promise<void>;
}

interface ToggleRowProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleSwitchRow({ id, label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-xs font-medium text-slate-200 cursor-pointer">
          {label}
        </label>
        {description && (
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1E293B] ${
          checked
            ? 'bg-sky-500 border-sky-400'
            : 'bg-slate-700 border-slate-500 hover:border-slate-400'
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

const PR_STATE_OPTIONS: readonly PrStateFilter[] = ['draft', 'open', 'merged', 'closed'];

export function SettingsModal({
  isOpen,
  initialTab = 'general',
  onClose,
  accounts,
  aiConnections,
  workspaces,
  preferences,
  onSavePreferences,
  onSwitchAccount,
  onDisconnectAccount,
  onOpenAddAccount,
  onOpenAddAi,
  onOpenUpdateAi,
  onRefreshAiModels,
  onDeleteAiConnection,
}: SettingsModalProps) {
  const { locale, setLocale, dict, t } = useTranslation();
  const { isPaused: isMotionPaused, toggleMotion } = useAmbientMotionPreference();

  const [activeTab, setActiveTab] = useState<SettingsTabKey>(initialTab);
  const [draftPrefs, setDraftPrefs] = useState<FetchPreferences>(preferences);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmingAiId, setConfirmingAiId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAiId, setBusyAiId] = useState<string | null>(null);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tabButtonRefs = useRef<Map<SettingsTabKey, HTMLButtonElement>>(new Map());

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setDraftPrefs(preferences);
      setConfirmingId(null);
      setConfirmingAiId(null);
      setError(null);
    }
  }, [isOpen, initialTab, preferences]);

  const tabItems: Array<{ key: SettingsTabKey; label: string; Icon: typeof SlidersHorizontal }> = [
    { key: 'fetch', label: dict.settingsModal.tabFetch, Icon: SlidersHorizontal },
    { key: 'display', label: dict.settingsModal.tabDisplay, Icon: LayoutGrid },
    { key: 'general', label: dict.settingsModal.tabGeneral, Icon: Settings },
  ];

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tabItems.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + tabItems.length) % tabItems.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = tabItems.length - 1;

    if (nextIdx === null) return;
    e.preventDefault();
    const target = tabItems[nextIdx];
    if (target) {
      setActiveTab(target.key);
      tabButtonRefs.current.get(target.key)?.focus();
    }
  };

  const togglePrState = (state: PrStateFilter) => {
    setDraftPrefs((prev) => {
      const exists = prev.prStates.includes(state);
      const nextStates = exists
        ? prev.prStates.filter((s) => s !== state)
        : [...prev.prStates, state];
      return {
        ...prev,
        prStates: nextStates.length > 0 ? nextStates : [state],
      };
    });
  };

  const toggleOrg = (orgLogin: string) => {
    setDraftPrefs((prev) => {
      const exists = prev.includedOrgs.includes(orgLogin);
      const nextOrgs = exists
        ? prev.includedOrgs.filter((o) => o !== orgLogin)
        : [...prev.includedOrgs, orgLogin];
      return {
        ...prev,
        includedOrgs: nextOrgs,
      };
    });
  };

  const getPrStateLabel = (state: PrStateFilter): string => {
    if (state === 'draft') return dict.scanner.stateDraft;
    if (state === 'open') return dict.scanner.stateOpen;
    if (state === 'merged') return dict.scanner.stateMerged;
    return dict.scanner.stateClosed;
  };

  const handleSavePrefs = async () => {
    setIsSavingPrefs(true);
    setError(null);
    try {
      await onSavePreferences(draftPrefs);
      onClose();
    } catch (err) {
      setError((err as Error).message || dict.githubModal.patSaveError);
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const handleSwitch = async (accountId: string) => {
    setBusyId(accountId);
    setError(null);
    try {
      await onSwitchAccount(accountId);
    } catch (err) {
      setError((err as Error).message || dict.githubModal.patSaveError);
    } finally {
      setBusyId(null);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    setBusyId(accountId);
    setError(null);
    try {
      await onDisconnectAccount(accountId);
      setConfirmingId(null);
    } catch (err) {
      setError((err as Error).message || dict.githubModal.patSaveError);
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteAi = async (connectionId: string) => {
    setBusyAiId(connectionId);
    setError(null);
    try {
      await onDeleteAiConnection(connectionId);
      setConfirmingAiId(null);
    } catch (err) {
      setError((err as Error).message || dict.aiModal.saveError);
    } finally {
      setBusyAiId(null);
    }
  };

  const handleRefreshAi = async (connectionId: string) => {
    setBusyAiId(connectionId);
    setError(null);
    try {
      await onRefreshAiModels(connectionId);
    } catch (err) {
      setError((err as Error).message || dict.toasts.aiModelsRefreshError);
    } finally {
      setBusyAiId(null);
    }
  };

  const orgs = workspaces?.organizations ?? [];

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="settings-modal-title"
      maxWidthClass="max-w-2xl"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-slate-700/80">
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0"
            aria-hidden="true"
          >
            <Settings className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2
              id="settings-modal-title"
              className="text-base font-semibold text-slate-100 tracking-tight"
            >
              {dict.settingsModal.title}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              {dict.settingsModal.subtitle}
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

      {/* WAI-ARIA Accessible Tab Bar with Bottom Border Underline Indicator */}
      <div
        role="tablist"
        aria-label={dict.settingsModal.tablistAria}
        className="flex items-center gap-1 px-6 border-b border-slate-700/80 overflow-x-auto custom-scrollbar"
      >
        {tabItems.map((tab, idx) => {
          const isSelected = activeTab === tab.key;
          const Icon = tab.Icon;
          return (
            <button
              key={tab.key}
              id={`settings-tab-${tab.key}`}
              ref={(el) => {
                if (el) tabButtonRefs.current.set(tab.key, el);
                else tabButtonRefs.current.delete(tab.key);
              }}
              type="button"
              role="tab"
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setActiveTab(tab.key)}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
              className={`relative shrink-0 inline-flex items-center gap-2 px-3.5 py-3 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
                isSelected ? 'text-sky-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{tab.label}</span>
              {isSelected && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-1 bottom-0 border-b-2 border-sky-400"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="p-6 space-y-6 max-h-[65dvh] overflow-y-auto gp-scroll-area">
        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* TAB 1: FETCH & SOURCES */}
        <div
          role="tabpanel"
          aria-labelledby="settings-tab-fetch"
          hidden={activeTab !== 'fetch'}
          className={activeTab === 'fetch' ? 'space-y-6' : 'hidden'}
        >
          {/* Workspace Sources */}
          <section className="space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
              {dict.settingsModal.workspaceSection}
            </h3>

            <div className="rounded-xl bg-[#253349]/55 border border-slate-600/75 divide-y divide-slate-700/80">
              <ToggleSwitchRow
                id="pref-include-personal"
                label={
                  workspaces?.personal.login
                    ? `${dict.settingsModal.includePersonalLabel} (@${workspaces.personal.login})`
                    : dict.settingsModal.includePersonalLabel
                }
                description={dict.settingsModal.includePersonalDesc}
                checked={draftPrefs.includePersonal}
                onChange={(checked) =>
                  setDraftPrefs((prev) => ({ ...prev, includePersonal: checked }))
                }
              />

              {workspaces && workspaces.personal.accessibleRepoCount === 0 && (
                <div className="px-4 py-2.5 bg-amber-500/[0.06] text-xs text-amber-300 flex items-center gap-2">
                  <User className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{dict.settingsModal.personalNoAccessWarning}</span>
                </div>
              )}

              <div className="p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-200 flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
                    <span>{dict.settingsModal.orgsLabel}</span>
                  </span>
                  {draftPrefs.includedOrgs.length === 0 && orgs.length > 0 && (
                    <span className="text-xs text-sky-400 font-mono">
                      {dict.settingsModal.orgsAllMode}
                    </span>
                  )}
                </div>

                {orgs.length === 0 ? (
                  <p className="text-xs text-slate-400">{dict.settingsModal.orgsEmpty}</p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {orgs.map((org) => {
                        const checked = draftPrefs.includedOrgs.includes(org.login);
                        return (
                          <button
                            key={org.login}
                            type="button"
                            onClick={() => toggleOrg(org.login)}
                            aria-pressed={checked}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                              checked
                                ? 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40'
                                : 'bg-white/[0.07] text-slate-200 hover:text-white border-white/[0.15]'
                            }`}
                          >
                            {checked && (
                              <Check className="w-3 h-3 text-indigo-300" aria-hidden="true" />
                            )}
                            <span>{org.login}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {dict.settingsModal.orgsAllHint}
                    </p>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* PR States & Role Scope */}
          <section className="space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
              {dict.settingsModal.prStatesSection}
            </h3>

            <div className="rounded-xl bg-[#253349]/55 border border-slate-600/75 p-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                {PR_STATE_OPTIONS.map((state) => {
                  const active = draftPrefs.prStates.includes(state);
                  const style = getPrStateStyle(state);
                  return (
                    <button
                      key={state}
                      type="button"
                      onClick={() => togglePrState(state)}
                      aria-pressed={active}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        active
                          ? style.badgeClass
                          : 'bg-white/[0.07] text-slate-300 hover:text-white border-white/[0.15]'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          active ? style.dotClass : 'bg-slate-400'
                        }`}
                        aria-hidden="true"
                      />
                      <span>{getPrStateLabel(state)}</span>
                      {active && (
                        <Check
                          className={`w-3 h-3 shrink-0 ${style.iconClass}`}
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-200">
                  {dict.settingsModal.fetchRoleLabel}
                </span>
                <SegmentedControl
                  value={draftPrefs.fetchRole}
                  onChange={(val) => setDraftPrefs((prev) => ({ ...prev, fetchRole: val }))}
                  ariaLabel={dict.settingsModal.fetchRoleLabel}
                  size="sm"
                  options={[
                    { value: 'author', label: dict.settingsModal.roleAuthor },
                    { value: 'involves', label: dict.settingsModal.roleInvolves },
                  ]}
                />
              </div>

              <div className="pt-3 border-t border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-200">
                  {dict.settingsModal.defaultRangeLabel}
                </span>
                <SegmentedControl
                  value={draftPrefs.defaultTimeRange}
                  onChange={(val) => setDraftPrefs((prev) => ({ ...prev, defaultTimeRange: val }))}
                  ariaLabel={dict.settingsModal.defaultRangeLabel}
                  size="sm"
                  options={[
                    { value: 'today', label: dict.scanner.rangeToday },
                    { value: '24h', label: dict.scanner.range24h },
                    { value: '7d', label: dict.scanner.range7d },
                  ]}
                />
              </div>
            </div>
          </section>

          {/* Scanner Behavior Switches */}
          <section className="space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
              {dict.settingsModal.advancedSection}
            </h3>

            <div className="rounded-xl bg-[#253349]/55 border border-slate-600/75 divide-y divide-slate-700/80">
              <ToggleSwitchRow
                id="pref-include-direct-commits"
                label={dict.settingsModal.includeDirectCommitsLabel}
                description={dict.settingsModal.includeDirectCommitsDesc}
                checked={draftPrefs.includeDirectCommits}
                onChange={(checked) =>
                  setDraftPrefs((prev) => ({ ...prev, includeDirectCommits: checked }))
                }
              />

              <ToggleSwitchRow
                id="pref-keep-pr-without-commits"
                label={dict.settingsModal.includePrWithoutCommitsLabel}
                description={dict.settingsModal.includePrWithoutCommitsDesc}
                checked={draftPrefs.includePrWithoutCommitsInRange}
                onChange={(checked) =>
                  setDraftPrefs((prev) => ({
                    ...prev,
                    includePrWithoutCommitsInRange: checked,
                  }))
                }
              />
            </div>
          </section>
        </div>

        {/* TAB 2: GROUPING & LAYOUT */}
        <div
          role="tabpanel"
          aria-labelledby="settings-tab-display"
          hidden={activeTab !== 'display'}
          className={activeTab === 'display' ? 'space-y-6' : 'hidden'}
        >
          <section className="space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
              {dict.settingsModal.tabDisplay}
            </h3>

            <div className="rounded-xl bg-[#253349]/55 border border-slate-600/75 divide-y divide-slate-700/80">
              <div className="p-4 space-y-2.5">
                <span className="block text-xs font-medium text-slate-200">
                  {dict.settingsModal.defaultGroupByLabel}
                </span>
                <SegmentedControl
                  value={draftPrefs.defaultGroupBy === 'flat' ? 'owner' : draftPrefs.defaultGroupBy}
                  onChange={(val) => setDraftPrefs((prev) => ({ ...prev, defaultGroupBy: val }))}
                  ariaLabel={dict.settingsModal.defaultGroupByLabel}
                  size="sm"
                  fullWidth
                  options={[
                    { value: 'owner', label: dict.scanner.groupOwner },
                    { value: 'task', label: dict.scanner.groupTask },
                    { value: 'repo', label: dict.scanner.groupRepo },
                  ]}
                />
              </div>

              <ToggleSwitchRow
                id="pref-compact-commits"
                label={dict.settingsModal.compactCommitsLabel}
                description={dict.settingsModal.compactCommitsDesc}
                checked={draftPrefs.compactCommits}
                onChange={(checked) =>
                  setDraftPrefs((prev) => ({ ...prev, compactCommits: checked }))
                }
              />
            </div>
          </section>
        </div>

        {/* TAB 3: INTERFACE & LINKED ACCOUNTS */}
        <div
          role="tabpanel"
          aria-labelledby="settings-tab-general"
          hidden={activeTab !== 'general'}
          className={activeTab === 'general' ? 'space-y-6' : 'hidden'}
        >
          <section className="space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
              {dict.settingsModal.interfaceSection}
            </h3>

            <div className="rounded-xl bg-[#253349]/55 border border-slate-600/75 divide-y divide-slate-700/80">
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Languages className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                  <span className="text-xs font-medium text-slate-200">
                    {dict.settingsModal.languageLabel}
                  </span>
                </div>
                <SegmentedControl
                  value={locale}
                  onChange={setLocale}
                  ariaLabel={dict.header.languageSwitchLabel}
                  size="sm"
                  options={[
                    { value: 'vi', label: 'VI' },
                    { value: 'en', label: 'EN' },
                  ]}
                />
              </div>

              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Sparkles className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
                  <span className="text-xs font-medium text-slate-200">
                    {dict.settingsModal.motionLabel}
                  </span>
                </div>
                <SegmentedControl
                  value={isMotionPaused ? 'off' : 'on'}
                  onChange={(val) => {
                    const shouldPause = val === 'off';
                    if (shouldPause !== isMotionPaused) {
                      toggleMotion();
                    }
                  }}
                  ariaLabel={dict.settingsModal.motionLabel}
                  size="sm"
                  options={[
                    { value: 'on', label: dict.settingsModal.motionOn },
                    { value: 'off', label: dict.settingsModal.motionOff },
                  ]}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                {dict.settingsModal.gitAccountsSection}
              </h3>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAddAccount();
                }}
                className="inline-flex items-center gap-1.5 min-h-[30px] px-2.5 py-1 rounded-lg text-xs font-medium text-sky-300 hover:text-sky-200 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/25 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{dict.settingsModal.addAccountBtn}</span>
              </button>
            </div>

            {accounts.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#253349]/55 border border-slate-600/75 text-center">
                <GitBranch className="w-5 h-5 text-slate-400 mx-auto mb-2" aria-hidden="true" />
                <p className="text-xs text-slate-400">{dict.settingsModal.noAccounts}</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {accounts.map((acc) => {
                  const isBusy = busyId === acc.id;
                  const isConfirming = confirmingId === acc.id;

                  return (
                    <div
                      key={acc.id}
                      className={`p-3.5 rounded-xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        acc.isActive
                          ? 'bg-sky-500/[0.1] border-sky-400/40'
                          : 'bg-[#253349]/55 border-slate-600/75'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {acc.gitAvatar ? (
                          <img
                            src={acc.gitAvatar}
                            alt={acc.gitUsername}
                            className="w-9 h-9 rounded-full border border-white/15 object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-white/[0.1] border border-white/20 flex items-center justify-center text-xs font-semibold text-slate-200 shrink-0">
                            {acc.gitUsername.slice(0, 2).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-100 truncate">
                              @{acc.gitUsername}
                            </span>
                            {acc.isActive && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                                <Check className="w-3 h-3" aria-hidden="true" />
                                {dict.settingsModal.activeLabel}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center flex-wrap gap-2 mt-1">
                            {acc.tokenStatus && acc.tokenStatus !== 'ACTIVE' && (
                              <span className="text-xs text-rose-300 font-mono">
                                {acc.tokenStatus}
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center gap-1 font-mono px-2 py-0.5 rounded-md border text-xs ${
                                formatExpiration(acc.expiresAt, locale).badgeClass
                              }`}
                            >
                              <Clock className="w-3 h-3" aria-hidden="true" />
                              <span>{formatExpiration(acc.expiresAt, locale).label}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 justify-end">
                        {!acc.isActive && !isConfirming && (
                          <button
                            type="button"
                            onClick={() => void handleSwitch(acc.id)}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium text-slate-100 hover:text-white bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.15] transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                              <span>{dict.settingsModal.switchToBtn}</span>
                            )}
                          </button>
                        )}

                        {!isConfirming ? (
                          <button
                            type="button"
                            onClick={() => setConfirmingId(acc.id)}
                            disabled={isBusy}
                            title={dict.settingsModal.disconnectAccountBtn}
                            aria-label={`${dict.settingsModal.disconnectAccountBtn}: @${acc.gitUsername}`}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/15 border border-transparent hover:border-rose-500/25 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleDisconnect(acc.id)}
                              disabled={isBusy}
                              className="inline-flex items-center gap-1 min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {isBusy && (
                                <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                              )}
                              <span>{dict.settingsModal.confirmDisconnectBtn}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingId(null)}
                              disabled={isBusy}
                              className="inline-flex items-center min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium text-slate-100 bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.15] transition-colors cursor-pointer"
                            >
                              {dict.common.cancel}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                {dict.settingsModal.aiConnectionsSection}
              </h3>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAddAi();
                }}
                className="inline-flex items-center gap-1.5 min-h-[30px] px-2.5 py-1 rounded-lg text-xs font-medium text-sky-300 hover:text-sky-200 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/25 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{dict.settingsModal.addAiBtn}</span>
              </button>
            </div>

            {aiConnections.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#253349]/55 border border-slate-600/75 text-center">
                <Sparkles className="w-5 h-5 text-slate-400 mx-auto mb-2" aria-hidden="true" />
                <p className="text-xs text-slate-400">{dict.settingsModal.noAiConnections}</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {aiConnections.map((conn) => {
                  const isBusy = busyAiId === conn.id;
                  const isConfirming = confirmingAiId === conn.id;

                  return (
                    <div
                      key={conn.id}
                      className="p-3.5 rounded-xl border bg-[#253349]/55 border-slate-600/75 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-9 h-9 rounded-lg bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0"
                          aria-hidden="true"
                        >
                          <Sparkles className="w-4 h-4" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="text-sm font-semibold text-slate-100 truncate">
                              {conn.provider === 'GROQ'
                                ? dict.aiConsole.groqProviderLabel
                                : dict.aiConsole.geminiProviderLabel}{' '}
                              ({conn.label})
                            </span>
                            {conn.status === 'REVOKED' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30 shrink-0">
                                {dict.aiConsole.revokedBadge}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                                <Check className="w-3 h-3" aria-hidden="true" />
                                {t('settingsModal.aiModelsCount', {
                                  count: conn.availableModels.length,
                                })}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center flex-wrap gap-2 mt-1">
                            <span
                              className={`inline-flex items-center gap-1 font-mono px-2 py-0.5 rounded-md border text-xs ${
                                formatExpiration(conn.expiresAt, locale).badgeClass
                              }`}
                            >
                              <Clock className="w-3 h-3" aria-hidden="true" />
                              <span>{formatExpiration(conn.expiresAt, locale).label}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 justify-end">
                        {!isConfirming && (
                          <button
                            type="button"
                            onClick={() => void handleRefreshAi(conn.id)}
                            disabled={isBusy}
                            title={dict.aiConsole.refreshModelsBtn}
                            aria-label={`${dict.aiConsole.refreshModelsBtn}: ${conn.label}`}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:text-sky-300 hover:bg-sky-500/15 border border-white/[0.12] hover:border-sky-400/30 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw
                              className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`}
                              aria-hidden="true"
                            />
                          </button>
                        )}

                        {!isConfirming && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenUpdateAi(conn);
                            }}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium text-slate-100 hover:text-white bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.15] transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>{dict.settingsModal.updateAiKeyBtn}</span>
                          </button>
                        )}

                        {!isConfirming ? (
                          <button
                            type="button"
                            onClick={() => setConfirmingAiId(conn.id)}
                            disabled={isBusy}
                            title={dict.settingsModal.deleteAiBtn}
                            aria-label={`${dict.settingsModal.deleteAiBtn}: ${conn.label}`}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/15 border border-transparent hover:border-rose-500/25 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleDeleteAi(conn.id)}
                              disabled={isBusy}
                              className="inline-flex items-center gap-1 min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {isBusy && (
                                <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                              )}
                              <span>{dict.settingsModal.confirmDeleteAiBtn}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingAiId(null)}
                              disabled={isBusy}
                              className="inline-flex items-center min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium text-slate-100 bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.15] transition-colors cursor-pointer"
                            >
                              {dict.common.cancel}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Footer Save Bar for Fetch / Display settings */}
      {activeTab !== 'general' && (
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-700/80 bg-[#0F172A]/65">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] px-4 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.15] cursor-pointer"
          >
            {dict.common.cancel}
          </button>
          <button
            type="button"
            disabled={isSavingPrefs}
            onClick={() => void handleSavePrefs()}
            className="gp-cta-shimmer inline-flex items-center gap-2 min-h-[36px] px-5 py-1.5 rounded-lg text-xs font-semibold text-slate-950 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 cursor-pointer"
          >
            {isSavingPrefs && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
            <span>
              {isSavingPrefs ? dict.settingsModal.savingBtn : dict.settingsModal.saveAndApplyBtn}
            </span>
          </button>
        </div>
      )}
    </ModalDialog>
  );
}
