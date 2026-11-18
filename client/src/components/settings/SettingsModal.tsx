'use client';

import React, { useState } from 'react';
import { GitAccountSummary } from '../../types';
import { useTranslation } from '../../i18n';
import { useAmbientMotionPreference } from '../../lib/motion-preference';
import { ModalDialog } from '../ui/ModalDialog';
import { SegmentedControl } from '../ui/SegmentedControl';
import {
  Settings,
  X,
  Plus,
  Check,
  Trash2,
  GitBranch,
  AlertCircle,
  Loader2,
  Languages,
  Sparkles,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: GitAccountSummary[];
  onSwitchAccount: (accountId: string) => Promise<void>;
  onDisconnectAccount: (accountId: string) => Promise<void>;
  onOpenAddAccount: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  accounts,
  onSwitchAccount,
  onDisconnectAccount,
  onOpenAddAccount,
}: SettingsModalProps) {
  const { locale, setLocale, dict } = useTranslation();
  const { isPaused: isMotionPaused, toggleMotion } = useAmbientMotionPreference();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="settings-modal-title"
      maxWidthClass="max-w-lg"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-white/[0.08]">
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
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/[0.08] transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Body */}
      <div className="p-6 space-y-6 max-h-[70dvh] overflow-y-auto gp-scroll-area">
        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Interface Preferences */}
        <section className="space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
            {dict.settingsModal.interfaceSection}
          </h3>

          <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] divide-y divide-white/[0.06]">
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

        {/* Linked GitHub Accounts */}
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
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] text-center">
              <GitBranch className="w-5 h-5 text-slate-500 mx-auto mb-2" aria-hidden="true" />
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
                        ? 'bg-sky-500/[0.08] border-sky-400/35'
                        : 'bg-white/[0.03] border-white/[0.08]'
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
                        <div className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/15 flex items-center justify-center text-xs font-semibold text-slate-200 shrink-0">
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
                        {acc.tokenStatus && acc.tokenStatus !== 'ACTIVE' && (
                          <p className="text-xs text-rose-300 mt-0.5">{acc.tokenStatus}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 justify-end">
                      {!acc.isActive && !isConfirming && (
                        <button
                          type="button"
                          onClick={() => void handleSwitch(acc.id)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium text-slate-200 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] transition-colors cursor-pointer disabled:opacity-50"
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
                            className="inline-flex items-center min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium text-slate-200 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] transition-colors cursor-pointer"
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
    </ModalDialog>
  );
}
