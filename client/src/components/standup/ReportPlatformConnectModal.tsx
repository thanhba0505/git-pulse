'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';
import { useTranslation } from '../../i18n';
import { formatExpiration } from '../../lib/activity-utils';
import { api } from '../../lib/api';
import { Input } from '../ui/Input';
import { ModalDialog } from '../ui/ModalDialog';
import { Select, SelectOption } from '../ui/Select';

export type ReportPlatformId = 'parabol';

interface VerifiedParabolProfile {
  suggestedLabel: string;
  name: string | null;
  email: string | null;
  expiresAt: string | null;
}

interface ReportPlatformConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveParabolConnection: (token: string, label?: string) => Promise<void>;
}

const PARABOL_PROFILE_URL = 'https://action.parabol.co/me/profile';
const FOREIGN_TOKEN_PREFIX_RE = /^(ghp_|github_pat_|gho_|gsk_|AIza|sk-)/i;

function normalizeTokenInput(raw: string): string {
  return raw
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/^Bearer\s+/i, '')
    .trim();
}

function isForeignTokenPrefix(token: string): boolean {
  return FOREIGN_TOKEN_PREFIX_RE.test(token);
}

export function ReportPlatformConnectModal({
  isOpen,
  onClose,
  onSaveParabolConnection,
}: ReportPlatformConnectModalProps) {
  const { dict, t, locale } = useTranslation();

  const [platform, setPlatform] = useState<ReportPlatformId>('parabol');
  const [labelInput, setLabelInput] = useState('');
  const [isLabelCustomized, setIsLabelCustomized] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedProfile, setVerifiedProfile] = useState<VerifiedParabolProfile | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tokenRef = useRef<HTMLInputElement>(null);
  const lastVerifiedTokenRef = useRef('');
  const verifySeqRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLabelCustomizedRef = useRef(isLabelCustomized);
  isLabelCustomizedRef.current = isLabelCustomized;

  const clearDebounce = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      clearDebounce();
      return;
    }
    setPlatform('parabol');
    setLabelInput('');
    setIsLabelCustomized(false);
    setTokenInput('');
    setShowToken(false);
    setIsVerifying(false);
    setVerifiedProfile(null);
    setError(null);
    lastVerifiedTokenRef.current = '';
    verifySeqRef.current += 1;
  }, [isOpen, clearDebounce]);

  useEffect(() => clearDebounce, [clearDebounce]);

  const runVerifyToken = useCallback(
    async (rawToken: string) => {
      const trimmed = normalizeTokenInput(rawToken);
      if (!trimmed) {
        setError(dict.settingsModal.parabolPatRequired);
        tokenRef.current?.focus();
        return;
      }

      if (isForeignTokenPrefix(trimmed)) {
        setVerifiedProfile(null);
        setError(dict.parabolModal.invalidTokenFormat);
        return;
      }

      const seq = ++verifySeqRef.current;
      lastVerifiedTokenRef.current = trimmed;
      setIsVerifying(true);
      setError(null);

      try {
        const res = await api.parabol.verifyToken(trimmed);
        if (seq !== verifySeqRef.current) return;

        setVerifiedProfile({
          suggestedLabel: res.suggestedLabel,
          name: res.name,
          email: res.email,
          expiresAt: res.expiresAt ?? null,
        });
        if (!isLabelCustomizedRef.current) {
          setLabelInput(res.suggestedLabel);
        }
      } catch (err) {
        if (seq !== verifySeqRef.current) return;
        setVerifiedProfile(null);
        const msg = (err as Error).message || '';
        const isFormatErr =
          /persistedqueryonly|invalid parabol token format|start with "pat_"/i.test(msg);
        setError(
          isFormatErr
            ? dict.parabolModal.invalidTokenFormat
            : msg || dict.settingsModal.parabolPatHint,
        );
      } finally {
        if (seq === verifySeqRef.current) {
          setIsVerifying(false);
        }
      }
    },
    [
      dict.parabolModal.invalidTokenFormat,
      dict.settingsModal.parabolPatHint,
      dict.settingsModal.parabolPatRequired,
    ],
  );

  const platformOptions: readonly SelectOption<ReportPlatformId>[] = [
    {
      value: 'parabol',
      label: dict.settingsModal.platformParabolLabel,
      description: dict.settingsModal.platformParabolDesc,
    },
  ];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearDebounce();
    const trimmedToken = normalizeTokenInput(tokenInput);
    if (!trimmedToken) {
      setError(dict.settingsModal.parabolPatRequired);
      tokenRef.current?.focus();
      return;
    }

    if (isForeignTokenPrefix(trimmedToken)) {
      setError(dict.parabolModal.invalidTokenFormat);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSaveParabolConnection(trimmedToken, labelInput.trim() || undefined);
      setTokenInput('');
      setLabelInput('');
      setVerifiedProfile(null);
      onClose();
    } catch (err) {
      const msg = (err as Error).message || '';
      const isFormatErr = /persistedqueryonly|invalid parabol token format|start with "pat_"/i.test(
        msg,
      );
      setError(
        isFormatErr
          ? dict.parabolModal.invalidTokenFormat
          : msg || dict.settingsModal.parabolPatHint,
      );
    } finally {
      setIsSaving(false);
    }
  };

  const isBusy = isSaving || isVerifying;
  const verifiedDisplayName =
    verifiedProfile?.name || verifiedProfile?.email || verifiedProfile?.suggestedLabel || '';

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="report-platform-connect-title"
      maxWidthClass="max-w-lg"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-slate-700/80 shrink-0">
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0"
            aria-hidden="true"
          >
            <Send className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2
              id="report-platform-connect-title"
              className="text-base font-semibold text-slate-100 tracking-tight"
            >
              {dict.reportConnectModal.title}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              {dict.reportConnectModal.subtitle}
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

      {/* Form Body */}
      <form
        onSubmit={(e) => void handleSubmit(e)}
        noValidate
        className="p-6 space-y-4 overflow-y-auto gp-scroll-area"
      >
        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
            <span className="leading-relaxed break-words">{error}</span>
          </div>
        )}

        {/* Platform Select */}
        <Select
          id="report-connect-platform-select"
          label={dict.settingsModal.platformLabel}
          value={platform}
          options={platformOptions}
          onChange={setPlatform}
          disabled={isBusy}
        />

        {/* Label Input */}
        <div className="space-y-1.5">
          <label
            htmlFor="report-connect-label"
            className="block text-xs font-medium text-slate-200"
          >
            {dict.parabolModal.labelInput}
          </label>
          <Input
            id="report-connect-label"
            type="text"
            value={labelInput}
            onChange={(e) => {
              const val = e.target.value;
              setLabelInput(val);
              setIsLabelCustomized(val.trim().length > 0);
            }}
            placeholder={dict.parabolModal.labelPlaceholder}
            disabled={isSaving}
          />
        </div>

        {/* Token Expiration (Auto-detected, Read-Only) */}
        <Input
          id="report-connect-expiration"
          name="expiresAtDisplay"
          type="text"
          label={dict.parabolModal.expiresAtLabel}
          value={
            verifiedProfile
              ? formatExpiration(verifiedProfile.expiresAt, locale).label
              : dict.parabolModal.expiresPending
          }
          leftIcon={<Clock className="w-4 h-4" />}
          disabled
          readOnly
        />

        {/* PAT Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label
              htmlFor="report-connect-token"
              className="block text-xs font-medium text-slate-200"
            >
              {dict.settingsModal.parabolPatLabel}
            </label>
            <a
              href={PARABOL_PROFILE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-sky-300 hover:text-sky-200"
            >
              <span>{dict.parabolModal.openSettingsLink}</span>
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          </div>

          <div className="relative">
            <Input
              ref={tokenRef}
              id="report-connect-token"
              type={showToken ? 'text' : 'password'}
              value={tokenInput}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text').trim();
                if (pasted.length >= 8) {
                  clearDebounce();
                  void runVerifyToken(pasted);
                }
              }}
              onChange={(e) => {
                const next = e.target.value;
                setTokenInput(next);
                if (error) setError(null);
                const trimmed = next.trim();
                if (trimmed !== lastVerifiedTokenRef.current) {
                  setVerifiedProfile(null);
                  if (!isLabelCustomizedRef.current) {
                    setLabelInput('');
                  }
                }
                clearDebounce();
                if (trimmed.length >= 8 && trimmed !== lastVerifiedTokenRef.current) {
                  debounceTimerRef.current = setTimeout(() => {
                    void runVerifyToken(trimmed);
                  }, 450);
                }
              }}
              placeholder={dict.settingsModal.parabolPatPlaceholder}
              autoComplete="off"
              disabled={isSaving}
              className="pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowToken((prev) => !prev)}
              aria-label={showToken ? dict.auth.hidePassword : dict.auth.showPassword}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-slate-200 hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              {showToken ? (
                <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </button>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            {dict.settingsModal.parabolPatHint}
          </p>
        </div>

        {verifiedProfile && (
          <div
            role="status"
            aria-live="polite"
            className="p-3 rounded-xl bg-emerald-500/[0.07] border border-emerald-500/25 flex items-center gap-2 text-xs font-medium text-emerald-300"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {t('parabolModal.verifySuccess', { name: verifiedDisplayName })}
            </span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-700/80 flex-wrap">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="min-h-[38px] px-4 py-2 rounded-lg text-xs font-medium text-slate-200 bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.15] cursor-pointer disabled:opacity-50"
          >
            {dict.common.cancel}
          </button>

          <button
            type="button"
            onClick={() => {
              clearDebounce();
              void runVerifyToken(tokenInput);
            }}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 min-h-[38px] px-4 py-2 rounded-lg text-xs font-medium text-sky-300 hover:text-sky-200 bg-sky-500/10 hover:bg-sky-500/15 border border-sky-400/30 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isVerifying ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>
              {isVerifying ? dict.parabolModal.verifyingBtn : dict.parabolModal.verifyBtn}
            </span>
          </button>

          <button
            type="submit"
            disabled={isBusy}
            className="gp-cta-shimmer inline-flex items-center gap-2 min-h-[38px] px-5 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>
              {isSaving ? dict.settingsModal.parabolSavingBtn : dict.settingsModal.parabolSaveBtn}
            </span>
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
