'use client';

import React, { useState, useEffect } from 'react';
import { GitStatus } from '../../types';
import { useTranslation } from '../../i18n';
import { ModalDialog } from '../ui/ModalDialog';
import { Input } from '../ui/Input';
import {
  GitBranch,
  Key,
  ShieldCheck,
  ExternalLink,
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';

interface GitHubConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: GitStatus;
  mode?: 'connect' | 'add' | 'manage';
  onSavePat: (token: string) => Promise<void>;
  onDisconnect: (accountId?: string) => Promise<void>;
}

export function GitHubConnectModal({
  isOpen,
  onClose,
  status,
  mode = 'manage',
  onSavePat,
  onDisconnect,
}: GitHubConnectModalProps) {
  const { locale, dict } = useTranslation();
  const [patInput, setPatInput] = useState('');
  const [showPat, setShowPat] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setConfirmingDisconnect(false);
      setShowPat(false);
    }
  }, [isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patInput.trim()) {
      setError(dict.githubModal.patRequired);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await onSavePat(patInput.trim());
      setPatInput('');
      onClose();
    } catch (err) {
      setError((err as Error).message || dict.githubModal.patSaveError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmDisconnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onDisconnect(status.activeAccountId);
      setConfirmingDisconnect(false);
      onClose();
    } catch (err) {
      setError((err as Error).message || dict.githubModal.patSaveError);
    } finally {
      setIsLoading(false);
    }
  };

  const dateLocale = locale === 'en' ? 'en-US' : 'vi-VN';
  const showManageView = Boolean(status.connected && mode !== 'add');
  const modalTitle =
    mode === 'add'
      ? dict.githubModal.titleAdd
      : showManageView
        ? dict.githubModal.titleManage
        : dict.githubModal.titleConnect;

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="github-connect-title"
      maxWidthClass="max-w-lg"
    >
      {/* Modal Header */}
      <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-slate-700/80">
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0"
            aria-hidden="true"
          >
            <GitBranch className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2
              id="github-connect-title"
              className="text-base font-semibold text-slate-100 tracking-tight"
            >
              {modalTitle}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              {dict.githubModal.subtitle}
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

      {/* Modal Body */}
      <div className="p-6 space-y-5">
        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {showManageView ? (
          <div className="space-y-4">
            {/* Connected Profile Card */}
            <div className="p-4 rounded-xl bg-[#253349]/65 border border-slate-600/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                {status.gitAvatar && (
                  <img
                    src={status.gitAvatar}
                    alt={status.gitUsername || 'GitHub'}
                    className="w-11 h-11 rounded-full border border-slate-700 object-cover shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-100 text-sm truncate">
                      @{status.gitUsername}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 tabular-nums">
                    {dict.githubModal.lastSync}:{' '}
                    {status.lastSyncAt
                      ? new Date(status.lastSyncAt).toLocaleTimeString(dateLocale)
                      : dict.githubModal.neverSynced}
                  </p>
                  {status.expiresAt && (
                    <p className="text-xs text-amber-300 mt-0.5 tabular-nums">
                      {dict.githubModal.expiresAt}:{' '}
                      {new Date(status.expiresAt).toLocaleDateString(dateLocale)}
                    </p>
                  )}
                </div>
              </div>
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
            </div>

            {/* Over-privileged Scope Alert */}
            {status.hasExcessiveScopes && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs flex items-start gap-2.5">
                <AlertCircle
                  className="w-4 h-4 shrink-0 mt-0.5 text-amber-400"
                  aria-hidden="true"
                />
                <div className="leading-relaxed">
                  <p className="font-semibold text-amber-200">
                    {dict.githubModal.excessiveScopesTitle}
                  </p>
                  <p className="text-amber-200/85 mt-0.5">{dict.githubModal.excessiveScopesDesc}</p>
                </div>
              </div>
            )}

            {/* Token Revoked / Expired Alert */}
            {(status.tokenStatus === 'REVOKED' || status.tokenStatus === 'EXPIRED') && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" aria-hidden="true" />
                <div className="leading-relaxed">
                  <p className="font-semibold text-rose-200">
                    {dict.githubModal.tokenRevokedTitle}
                  </p>
                  <p className="text-rose-200/85 mt-0.5">{dict.githubModal.tokenRevokedDesc}</p>
                </div>
              </div>
            )}

            {/* Footer & Inline 2-Step Disconnect Confirmation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-700/80">
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
                <span>{dict.githubModal.securityNote}</span>
              </p>

              {!confirmingDisconnect ? (
                <button
                  type="button"
                  onClick={() => setConfirmingDisconnect(true)}
                  disabled={isLoading}
                  className="inline-flex items-center justify-center min-h-[36px] px-4 py-1.5 rounded-lg text-xs font-semibold text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {dict.githubModal.disconnectBtn}
                </button>
              ) : (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleConfirmDisconnect}
                    disabled={isLoading}
                    className="inline-flex items-center justify-center min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isLoading
                      ? dict.githubModal.disconnectingBtn
                      : dict.githubModal.disconnectConfirmBtn}
                  </button>
                  <button
                    type="button"
                    autoFocus
                    onClick={() => setConfirmingDisconnect(false)}
                    disabled={isLoading}
                    className="inline-flex items-center justify-center min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-100 bg-slate-700 hover:bg-slate-600 border border-slate-600 transition-colors cursor-pointer"
                  >
                    {dict.common.cancel}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            <Input
              type={showPat ? 'text' : 'password'}
              label={dict.githubModal.patLabel}
              requiredMark
              labelAction={
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo,read:user&description=GitPulse+Activity+Scanner"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 transition-colors"
                >
                  <span>{dict.githubModal.createTokenLink}</span>
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              }
              leftIcon={<Key className="w-4 h-4" />}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPat((prev) => !prev)}
                  aria-pressed={showPat}
                  aria-label={showPat ? dict.auth.hidePassword : dict.auth.showPassword}
                  className="p-2 rounded-md text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {showPat ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              }
              value={patInput}
              onChange={(e) => {
                setPatInput(e.target.value);
                if (error) setError(null);
              }}
              placeholder={dict.githubModal.patPlaceholder}
              hint={dict.githubModal.patHint}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className="font-mono"
            />

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-700/80">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center min-h-[38px] px-4 py-2 rounded-lg text-xs font-medium text-slate-200 hover:text-white bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.15] transition-colors cursor-pointer"
              >
                {dict.common.close}
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="gp-cta-shimmer inline-flex items-center justify-center min-h-[38px] px-5 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-sky-500 hover:bg-sky-400 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? dict.githubModal.savingBtn : dict.githubModal.saveBtn}
              </button>
            </div>
          </form>
        )}
      </div>
    </ModalDialog>
  );
}
