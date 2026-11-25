'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AiConnectionSummary,
  FetchPreferences,
  GitAccountSummary,
  GitHubWorkspacesResponse,
  ParabolConnectionSummary,
  PrStateFilter,
} from '../../types';
import { useTranslation } from '../../i18n';
import { DEFAULT_AI_PROMPT } from '../../lib/ai-prompt.constants';
import { getPrStateStyle, formatExpiration } from '../../lib/activity-utils';
import { useAmbientMotionPreference } from '../../lib/motion-preference';
import { ModalDialog } from '../ui/ModalDialog';
import { SegmentedControl } from '../ui/SegmentedControl';
import {
  AlertCircle,
  Building2,
  Check,
  FileText,
  GitBranch,
  KeyRound,
  Languages,
  LayoutGrid,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react';

export type SettingsTabKey = 'fetch' | 'display' | 'reports' | 'general';
export type SettingsSectionAnchor = 'ai-prompt' | 'report-delivery';

interface SettingsModalProps {
  isOpen: boolean;
  initialTab?: SettingsTabKey;
  initialSection?: SettingsSectionAnchor | null;
  onClose: () => void;
  accounts: GitAccountSummary[];
  aiConnections: readonly AiConnectionSummary[];
  workspaces: GitHubWorkspacesResponse | null;
  preferences: FetchPreferences;
  customPrompt: string;
  parabolConnections: readonly ParabolConnectionSummary[];
  parabolEnabled: boolean;
  onSavePreferences: (next: FetchPreferences) => Promise<void>;
  onSaveAiPrompt: (customPrompt: string) => Promise<void>;
  onSwitchAccount: (accountId: string) => Promise<void>;
  onDisconnectAccount: (accountId: string) => Promise<void>;
  onOpenAddAccount: () => void;
  onOpenAddAi: () => void;
  onOpenUpdateAi: (connection: AiConnectionSummary) => void;
  onRefreshAiModels: (connectionId: string) => Promise<void>;
  onDeleteAiConnection: (connectionId: string) => Promise<void>;
  onOpenAddReportPlatform: () => void;
  onToggleParabolEnabled: (enabled: boolean) => void;
  onSwitchParabolConnection: (connectionId: string) => Promise<void>;
  onDeleteParabolConnection: (connectionId: string) => Promise<void>;
}

interface ToggleRowProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleSwitchRow({
  id,
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: ToggleRowProps) {
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
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1E293B] ${
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

interface AccountRowProps {
  avatar: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  subtitle: string;
  subtitleToneClass?: string;
  isActive?: boolean;
  actions: React.ReactNode;
}

/**
 * Uniform 2-line account card preventing uneven text wrapping across providers.
 */
function AccountRow({
  avatar,
  title,
  badge,
  subtitle,
  subtitleToneClass = 'text-slate-400',
  isActive = false,
  actions,
}: AccountRowProps) {
  return (
    <div
      className={`px-3.5 py-3 rounded-xl border transition-colors flex items-center justify-between gap-3 ${
        isActive ? 'bg-sky-500/[0.1] border-sky-400/40' : 'bg-[#253349]/55 border-slate-600/75'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {avatar}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-slate-100 truncate">{title}</span>
            {badge}
          </div>
          <p className={`text-xs font-mono truncate mt-0.5 ${subtitleToneClass}`}>{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">{actions}</div>
    </div>
  );
}

const PR_STATE_OPTIONS: readonly PrStateFilter[] = ['draft', 'open', 'merged', 'closed'];
const MAX_PROMPT_LENGTH = 2000;

export function SettingsModal({
  isOpen,
  initialTab = 'general',
  initialSection = null,
  onClose,
  accounts,
  aiConnections,
  workspaces,
  preferences,
  customPrompt,
  parabolConnections,
  parabolEnabled,
  onSavePreferences,
  onSaveAiPrompt,
  onSwitchAccount,
  onDisconnectAccount,
  onOpenAddAccount,
  onOpenAddAi,
  onOpenUpdateAi,
  onRefreshAiModels,
  onDeleteAiConnection,
  onOpenAddReportPlatform,
  onToggleParabolEnabled,
  onSwitchParabolConnection,
  onDeleteParabolConnection,
}: SettingsModalProps) {
  const { locale, setLocale, dict, t } = useTranslation();
  const { isPaused: isMotionPaused, toggleMotion } = useAmbientMotionPreference();

  const [activeTab, setActiveTab] = useState<SettingsTabKey>(initialTab);
  const [draftPrefs, setDraftPrefs] = useState<FetchPreferences>(preferences);
  const [draftPrompt, setDraftPrompt] = useState(
    customPrompt.trim() ? customPrompt : DEFAULT_AI_PROMPT,
  );

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmingAiId, setConfirmingAiId] = useState<string | null>(null);
  const [confirmingParabolId, setConfirmingParabolId] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAiId, setBusyAiId] = useState<string | null>(null);
  const [busyParabolId, setBusyParabolId] = useState<string | null>(null);

  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tabButtonRefs = useRef<Map<SettingsTabKey, HTMLButtonElement>>(new Map());
  const aiPromptSectionRef = useRef<HTMLElement>(null);
  const reportDeliverySectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    setDraftPrefs(preferences);
    setDraftPrompt(customPrompt.trim() ? customPrompt : DEFAULT_AI_PROMPT);
    setConfirmingId(null);
    setConfirmingAiId(null);
    setConfirmingParabolId(null);
    setError(null);
  }, [isOpen, initialTab, preferences, customPrompt]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'reports' || !initialSection) return;
    const targetRef =
      initialSection === 'ai-prompt' ? aiPromptSectionRef : reportDeliverySectionRef;
    const timer = setTimeout(() => {
      targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
    return () => clearTimeout(timer);
  }, [isOpen, activeTab, initialSection]);

  const tabItems: Array<{ key: SettingsTabKey; label: string; Icon: typeof SlidersHorizontal }> = [
    { key: 'fetch', label: dict.settingsModal.tabFetch, Icon: SlidersHorizontal },
    { key: 'display', label: dict.settingsModal.tabDisplay, Icon: LayoutGrid },
    { key: 'reports', label: dict.settingsModal.tabReports, Icon: FileText },
    { key: 'general', label: dict.settingsModal.tabGeneral, Icon: User },
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

  const toggleOrg = (login: string) => {
    setDraftPrefs((prev) => {
      const exists = prev.includedOrgs.includes(login);
      return {
        ...prev,
        includedOrgs: exists
          ? prev.includedOrgs.filter((item) => item !== login)
          : [...prev.includedOrgs, login],
      };
    });
  };

  const togglePrState = (state: PrStateFilter) => {
    setDraftPrefs((prev) => {
      const exists = prev.prStates.includes(state);
      if (exists && prev.prStates.length === 1) {
        return prev;
      }
      return {
        ...prev,
        prStates: exists
          ? prev.prStates.filter((item) => item !== state)
          : [...prev.prStates, state],
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

  const handleSavePrompt = async () => {
    setIsSavingPrompt(true);
    setError(null);
    try {
      await onSaveAiPrompt(draftPrompt.trim());
    } catch (err) {
      setError((err as Error).message || dict.settingsModal.savePromptError);
    } finally {
      setIsSavingPrompt(false);
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

  const handleSwitchParabol = async (connectionId: string) => {
    setBusyParabolId(connectionId);
    setError(null);
    try {
      await onSwitchParabolConnection(connectionId);
    } catch (err) {
      setError((err as Error).message || 'Failed to switch Parabol account.');
    } finally {
      setBusyParabolId(null);
    }
  };

  const handleDeleteParabol = async (connectionId: string) => {
    setBusyParabolId(connectionId);
    setError(null);
    try {
      await onDeleteParabolConnection(connectionId);
      setConfirmingParabolId(null);
    } catch (err) {
      setError((err as Error).message || 'Failed to remove Parabol connection.');
    } finally {
      setBusyParabolId(null);
    }
  };

  const orgs = workspaces?.organizations ?? [];
  const hasActiveParabol = parabolConnections.some((c) => c.status === 'ACTIVE');
  const isPromptCustomized = draftPrompt.trim() !== DEFAULT_AI_PROMPT.trim();
  const savedPromptNormalized = customPrompt.trim() || DEFAULT_AI_PROMPT.trim();
  const isPromptDirty = draftPrompt.trim() !== savedPromptNormalized;

  const getExpirationTone = (expiresAt: string | null | undefined) => {
    const info = formatExpiration(expiresAt, locale);
    const toneClass = info.isExpired
      ? 'text-rose-300'
      : info.isExpiringSoon
        ? 'text-amber-300'
        : 'text-slate-400';
    return { label: info.label, toneClass };
  };

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

      {/* WAI-ARIA Accessible Tab Bar */}
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
            <span className="break-words">{error}</span>
          </div>
        )}

        {/* TAB 1: FETCH & SOURCES */}
        <div
          role="tabpanel"
          aria-labelledby="settings-tab-fetch"
          hidden={activeTab !== 'fetch'}
          className={activeTab === 'fetch' ? 'space-y-6' : 'hidden'}
        >
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

        {/* TAB 2: DISPLAY & INTERFACE */}
        <div
          role="tabpanel"
          aria-labelledby="settings-tab-display"
          hidden={activeTab !== 'display'}
          className={activeTab === 'display' ? 'space-y-6' : 'hidden'}
        >
          <section className="space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
              {dict.settingsModal.displaySection}
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
        </div>

        {/* TAB 3: REPORTS (AI SYNTHESIS PROMPT + REPORT DELIVERY PLATFORMS) */}
        <div
          role="tabpanel"
          aria-labelledby="settings-tab-reports"
          hidden={activeTab !== 'reports'}
          className={activeTab === 'reports' ? 'space-y-6' : 'hidden'}
        >
          {/* Section A: Tổng hợp Báo cáo AI */}
          <section ref={aiPromptSectionRef} id="settings-ai-prompt" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                {dict.settingsModal.aiSynthesisSection}
              </h3>
              {isPromptCustomized && (
                <button
                  type="button"
                  onClick={() => setDraftPrompt(DEFAULT_AI_PROMPT)}
                  disabled={isSavingPrompt}
                  className="inline-flex items-center gap-1 text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="w-3 h-3" aria-hidden="true" />
                  <span>{dict.settingsModal.resetPromptBtn}</span>
                </button>
              )}
            </div>

            <div className="rounded-xl bg-[#253349]/55 border border-slate-600/75 p-4 space-y-3">
              <label
                htmlFor="settings-ai-prompt-input"
                className="block text-xs font-medium text-slate-200"
              >
                {dict.settingsModal.customPromptLabel}
              </label>

              <textarea
                id="settings-ai-prompt-input"
                value={draftPrompt}
                onChange={(e) => setDraftPrompt(e.target.value)}
                maxLength={MAX_PROMPT_LENGTH}
                rows={6}
                disabled={isSavingPrompt}
                placeholder={dict.settingsModal.customPromptPlaceholder}
                className="w-full p-3.5 rounded-xl bg-[#152033] border border-slate-600/85 hover:border-slate-500 focus-visible:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-500/25 font-mono text-xs text-slate-100 placeholder:text-slate-400 leading-relaxed outline-none resize-y transition-colors disabled:opacity-50"
              />

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-mono text-slate-400 tabular-nums">
                  {t('settingsModal.promptCharCount', { count: draftPrompt.length })}
                </span>
                <button
                  type="button"
                  disabled={isSavingPrompt || !isPromptDirty}
                  onClick={() => void handleSavePrompt()}
                  className="inline-flex items-center gap-1.5 min-h-[32px] px-3.5 py-1 rounded-lg text-xs font-semibold text-slate-950 bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700/70 disabled:text-slate-300 disabled:border disabled:border-slate-600/80 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  {isSavingPrompt && (
                    <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                  )}
                  <span>
                    {isSavingPrompt
                      ? dict.settingsModal.savingPromptBtn
                      : dict.settingsModal.savePromptBtn}
                  </span>
                </button>
              </div>
            </div>
          </section>

          {/* Section B: Nền tảng báo cáo công việc */}
          <section
            ref={reportDeliverySectionRef}
            id="settings-report-delivery"
            className="space-y-3 pt-2 border-t border-slate-700/80"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                {dict.settingsModal.reportDeliverySection}
              </h3>
              <button
                type="button"
                onClick={onOpenAddReportPlatform}
                className="inline-flex items-center gap-1.5 min-h-[30px] px-2.5 py-1 rounded-lg text-xs font-medium text-sky-300 hover:text-sky-200 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/25 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{dict.settingsModal.addParabolBtn}</span>
              </button>
            </div>

            {/* Sub-group: Parabol */}
            <div className="rounded-xl bg-[#1B273B]/75 border border-slate-600/75 p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0"
                    aria-hidden="true"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm font-semibold text-slate-100">
                    {dict.settingsModal.platformParabolLabel}
                  </span>
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border shrink-0 ${
                    hasActiveParabol
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {hasActiveParabol
                    ? dict.settingsModal.connectedBadge
                    : dict.settingsModal.disconnectedBadge}
                </span>
              </div>

              <div className="rounded-xl bg-[#253349]/60 border border-slate-600/70">
                <ToggleSwitchRow
                  id="settings-parabol-enabled"
                  label={dict.settingsModal.showParabolActionLabel}
                  description={dict.settingsModal.showParabolActionDesc}
                  checked={parabolEnabled && hasActiveParabol}
                  disabled={!hasActiveParabol}
                  onChange={onToggleParabolEnabled}
                />
              </div>

              <div className="space-y-2">
                <span className="block text-xs font-medium text-slate-300">
                  {dict.settingsModal.parabolAccountsSection}
                </span>

                {parabolConnections.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#253349]/55 border border-slate-600/75 text-center">
                    <Send className="w-5 h-5 text-slate-400 mx-auto mb-2" aria-hidden="true" />
                    <p className="text-xs text-slate-400">
                      {dict.settingsModal.noParabolConnections}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {parabolConnections.map((conn) => {
                      const isBusy = busyParabolId === conn.id;
                      const isConfirming = confirmingParabolId === conn.id;
                      const exp = getExpirationTone(conn.expiresAt);
                      const subtitleParts = [
                        exp.label,
                        conn.parabolEmail,
                        conn.maskedPrefix,
                      ].filter(Boolean);

                      return (
                        <AccountRow
                          key={conn.id}
                          isActive={conn.isActive}
                          avatar={
                            <div
                              className="w-9 h-9 rounded-lg bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0"
                              aria-hidden="true"
                            >
                              <KeyRound className="w-4 h-4" />
                            </div>
                          }
                          title={conn.parabolName || conn.label}
                          badge={
                            conn.status === 'REVOKED' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30 shrink-0 whitespace-nowrap">
                                {dict.aiConsole.revokedBadge}
                              </span>
                            ) : conn.isActive ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0 whitespace-nowrap">
                                <Check className="w-3 h-3" aria-hidden="true" />
                                {dict.settingsModal.defaultLabel}
                              </span>
                            ) : null
                          }
                          subtitle={subtitleParts.join(' • ')}
                          subtitleToneClass={exp.toneClass}
                          actions={
                            !isConfirming ? (
                              <>
                                {!conn.isActive && (
                                  <button
                                    type="button"
                                    onClick={() => void handleSwitchParabol(conn.id)}
                                    disabled={isBusy}
                                    className="inline-flex items-center gap-1.5 min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium text-slate-100 hover:text-white bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.15] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                                  >
                                    {isBusy ? (
                                      <Loader2
                                        className="w-3.5 h-3.5 animate-spin"
                                        aria-hidden="true"
                                      />
                                    ) : (
                                      <span>{dict.settingsModal.setDefaultBtn}</span>
                                    )}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setConfirmingParabolId(conn.id)}
                                  disabled={isBusy}
                                  title={dict.settingsModal.deleteParabolBtn}
                                  aria-label={`${dict.settingsModal.deleteParabolBtn}: ${conn.label}`}
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/15 border border-transparent hover:border-rose-500/25 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteParabol(conn.id)}
                                  disabled={isBusy}
                                  className="inline-flex items-center gap-1 min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                                >
                                  {isBusy && (
                                    <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                                  )}
                                  <span>{dict.settingsModal.confirmDisconnectBtn}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmingParabolId(null)}
                                  disabled={isBusy}
                                  className="inline-flex items-center min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium text-slate-100 bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.15] transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  {dict.common.cancel}
                                </button>
                              </>
                            )
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* TAB 4: ACCOUNTS & AI PROVIDERS */}
        <div
          role="tabpanel"
          aria-labelledby="settings-tab-general"
          hidden={activeTab !== 'general'}
          className={activeTab === 'general' ? 'space-y-6' : 'hidden'}
        >
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                {dict.settingsModal.gitAccountsSection}
              </h3>
              <button
                type="button"
                onClick={onOpenAddAccount}
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
              <div className="space-y-2">
                {accounts.map((acc) => {
                  const isBusy = busyId === acc.id;
                  const isConfirming = confirmingId === acc.id;
                  const exp = getExpirationTone(acc.expiresAt);
                  const subtitle =
                    acc.tokenStatus && acc.tokenStatus !== 'ACTIVE'
                      ? `${acc.tokenStatus} • ${exp.label}`
                      : exp.label;

                  return (
                    <AccountRow
                      key={acc.id}
                      isActive={acc.isActive}
                      avatar={
                        acc.gitAvatar ? (
                          <img
                            src={acc.gitAvatar}
                            alt={acc.gitUsername}
                            className="w-9 h-9 rounded-full border border-white/15 object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-white/[0.1] border border-white/20 flex items-center justify-center text-xs font-semibold text-slate-200 shrink-0">
                            {acc.gitUsername.slice(0, 2).toUpperCase()}
                          </div>
                        )
                      }
                      title={`@${acc.gitUsername}`}
                      badge={
                        acc.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0 whitespace-nowrap">
                            <Check className="w-3 h-3" aria-hidden="true" />
                            {dict.settingsModal.activeLabel}
                          </span>
                        ) : null
                      }
                      subtitle={subtitle}
                      subtitleToneClass={exp.toneClass}
                      actions={
                        !isConfirming ? (
                          <>
                            {!acc.isActive && (
                              <button
                                type="button"
                                onClick={() => void handleSwitch(acc.id)}
                                disabled={isBusy}
                                className="inline-flex items-center gap-1.5 min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium text-slate-100 hover:text-white bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.15] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                              >
                                {isBusy ? (
                                  <Loader2
                                    className="w-3.5 h-3.5 animate-spin"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <span>{dict.settingsModal.switchToBtn}</span>
                                )}
                              </button>
                            )}
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
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleDisconnect(acc.id)}
                              disabled={isBusy}
                              className="inline-flex items-center gap-1 min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
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
                              className="inline-flex items-center min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium text-slate-100 bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.15] transition-colors cursor-pointer whitespace-nowrap"
                            >
                              {dict.common.cancel}
                            </button>
                          </>
                        )
                      }
                    />
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
                onClick={onOpenAddAi}
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
              <div className="space-y-2">
                {aiConnections.map((conn) => {
                  const isBusy = busyAiId === conn.id;
                  const isConfirming = confirmingAiId === conn.id;
                  const exp = getExpirationTone(conn.expiresAt);
                  const providerTitle = `${
                    conn.provider === 'GROQ'
                      ? dict.aiConsole.groqProviderLabel
                      : dict.aiConsole.geminiProviderLabel
                  } (${conn.label})`;

                  return (
                    <AccountRow
                      key={conn.id}
                      avatar={
                        <div
                          className="w-9 h-9 rounded-lg bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0"
                          aria-hidden="true"
                        >
                          <Sparkles className="w-4 h-4" />
                        </div>
                      }
                      title={providerTitle}
                      badge={
                        conn.status === 'REVOKED' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30 shrink-0 whitespace-nowrap">
                            {dict.aiConsole.revokedBadge}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0 whitespace-nowrap">
                            <Check className="w-3 h-3" aria-hidden="true" />
                            {t('settingsModal.aiModelsCount', {
                              count: conn.availableModels.length,
                            })}
                          </span>
                        )
                      }
                      subtitle={`${exp.label} • ${conn.maskedKey}`}
                      subtitleToneClass={exp.toneClass}
                      actions={
                        !isConfirming ? (
                          <>
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
                            <button
                              type="button"
                              onClick={() => onOpenUpdateAi(conn)}
                              disabled={isBusy}
                              title={dict.settingsModal.updateAiKeyBtn}
                              aria-label={`${dict.settingsModal.updateAiKeyBtn}: ${conn.label}`}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:text-white bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.15] transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
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
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleDeleteAi(conn.id)}
                              disabled={isBusy}
                              className="inline-flex items-center gap-1 min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
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
                              className="inline-flex items-center min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium text-slate-100 bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.15] transition-colors cursor-pointer whitespace-nowrap"
                            >
                              {dict.common.cancel}
                            </button>
                          </>
                        )
                      }
                    />
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Footer Bar */}
      {(activeTab === 'fetch' || activeTab === 'display') && (
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
