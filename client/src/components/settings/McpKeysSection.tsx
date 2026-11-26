'use client';

import React, { useEffect, useState } from 'react';
import { McpKeySummary, McpScope } from '../../types';
import { useTranslation } from '../../i18n';
import { api, MCP_ENDPOINT_URL } from '../../lib/api';
import { useToast } from '../ui/Toast';
import { Check, Code2, Copy, KeyRound, Loader2, Plus, Terminal, Trash2, X } from 'lucide-react';

interface McpKeysSectionProps {
  isOpen: boolean;
  onError: (message: string | null) => void;
}

const ALL_MCP_SCOPES: readonly McpScope[] = [
  'read:activity',
  'write:activity',
  'read:tasks',
  'write:tasks',
  'ai:summarize',
  'read:reports',
  'write:reports',
  'read:settings',
  'write:settings',
  'write:parabol',
];

const EXPIRY_OPTIONS = [30, 90, 180, 0] as const;

function buildMcpConfigSnippet(token: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        'git-pulse': {
          url: MCP_ENDPOINT_URL,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      },
    },
    null,
    2,
  );
}

function renderKeyStatusBadge(
  isRevoked: boolean,
  isExpired: boolean,
  labels: { revoked: string; expired: string; active: string },
) {
  if (isRevoked) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30 shrink-0">
        {labels.revoked}
      </span>
    );
  }
  if (isExpired) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
        {labels.expired}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
      <Check className="w-3 h-3" aria-hidden="true" />
      {labels.active}
    </span>
  );
}

export function McpKeysSection({ isOpen, onError }: McpKeysSectionProps) {
  const { locale, dict, t } = useTranslation();
  const { showToast } = useToast();

  const [keys, setKeys] = useState<McpKeySummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<McpScope[]>([...ALL_MCP_SCOPES]);
  const [expiryDays, setExpiryDays] = useState<number>(90);
  const [isCreating, setIsCreating] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [showConfigPreview, setShowConfigPreview] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    setIsLoading(true);
    setRevealedToken(null);
    setConfirmRevokeId(null);

    api.mcp
      .listKeys()
      .then((rows) => {
        if (mounted) setKeys(rows);
      })
      .catch(() => {
        if (mounted) setKeys([]);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  const toggleScope = (scope: McpScope) => {
    setSelectedScopes((prev) => {
      const exists = prev.includes(scope);
      if (exists && prev.length === 1) return prev;
      return exists ? prev.filter((item) => item !== scope) : [...prev, scope];
    });
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast({ title: dict.settingsModal.mcpCopiedToast, variant: 'success' });
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLabel = label.trim();
    if (!cleanLabel) return;

    setIsCreating(true);
    onError(null);
    try {
      const res = await api.mcp.createKey({
        label: cleanLabel,
        scopes: selectedScopes,
        ...(expiryDays > 0 ? { expiresInDays: expiryDays } : {}),
      });
      setKeys((prev) => [res.key, ...prev]);
      setRevealedToken(res.token);
      setLabel('');
      setIsFormOpen(false);
      showToast({ title: dict.settingsModal.mcpKeyCreatedToast, variant: 'success' });
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    setBusyId(id);
    onError(null);
    try {
      await api.mcp.revokeKey(id);
      setKeys((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, revokedAt: new Date().toISOString() } : item,
        ),
      );
      setConfirmRevokeId(null);
      showToast({ title: dict.settingsModal.mcpKeyRevokedToast, variant: 'info' });
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const dateLocale = locale === 'en' ? 'en-US' : 'vi-VN';

  return (
    <section className="space-y-3 pt-2 border-t border-slate-700/80">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
          {dict.settingsModal.mcpSection}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowConfigPreview((prev) => !prev)}
            className="inline-flex items-center gap-1.5 min-h-[30px] px-2.5 py-1 rounded-lg text-xs font-medium text-slate-200 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.14] transition-colors cursor-pointer"
          >
            <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>JSON</span>
          </button>
          <button
            type="button"
            onClick={() => setIsFormOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 min-h-[30px] px-2.5 py-1 rounded-lg text-xs font-medium text-sky-300 hover:text-sky-200 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/25 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{dict.settingsModal.mcpAddKeyBtn}</span>
          </button>
        </div>
      </div>

      {revealedToken && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/35 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-emerald-200">
                {dict.settingsModal.mcpTokenOnceTitle}
              </p>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                {dict.settingsModal.mcpTokenOnceDesc}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRevealedToken(null)}
              aria-label={dict.common.close}
              className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-300 hover:text-white hover:bg-white/[0.1] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="p-2.5 rounded-lg bg-[#152033] border border-slate-600/80 font-mono text-xs text-emerald-300 break-all select-all">
            {revealedToken}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopy(revealedToken)}
              className="inline-flex items-center gap-1.5 min-h-[32px] px-3 py-1 rounded-lg text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{dict.settingsModal.mcpCopyTokenBtn}</span>
            </button>
            <button
              type="button"
              onClick={() => void handleCopy(buildMcpConfigSnippet(revealedToken))}
              className="inline-flex items-center gap-1.5 min-h-[32px] px-3 py-1 rounded-lg text-xs font-medium text-slate-100 bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.16] transition-colors cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{dict.settingsModal.mcpCopyConfigBtn}</span>
            </button>
          </div>
        </div>
      )}

      {showConfigPreview && !revealedToken && (
        <div className="p-3.5 rounded-xl bg-[#152033] border border-slate-600/80 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-300">
              {dict.settingsModal.mcpConfigSnippetTitle}
            </span>
            <button
              type="button"
              onClick={() => void handleCopy(buildMcpConfigSnippet('gp_mcp_YOUR_TOKEN'))}
              className="inline-flex items-center gap-1 text-xs font-medium text-sky-400 hover:text-sky-300 cursor-pointer"
            >
              <Copy className="w-3 h-3" aria-hidden="true" />
              <span>{dict.settingsModal.mcpCopyConfigBtn}</span>
            </button>
          </div>
          <pre className="text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
            {buildMcpConfigSnippet('gp_mcp_YOUR_TOKEN')}
          </pre>
        </div>
      )}

      {isFormOpen && (
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="p-4 rounded-xl bg-[#253349]/70 border border-slate-600/80 space-y-3.5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label htmlFor="mcp-key-label" className="block text-xs font-medium text-slate-200">
                {dict.settingsModal.mcpKeyLabelInput}
              </label>
              <input
                id="mcp-key-label"
                type="text"
                required
                maxLength={80}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={dict.settingsModal.mcpKeyLabelPlaceholder}
                className="w-full min-h-[36px] px-3 py-1.5 rounded-lg bg-[#152033] border border-slate-600/85 focus-visible:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-500/25 text-xs text-slate-100 placeholder:text-slate-400 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="mcp-key-expiry" className="block text-xs font-medium text-slate-200">
                {dict.settingsModal.mcpExpiryLabel}
              </label>
              <select
                id="mcp-key-expiry"
                value={expiryDays}
                onChange={(e) => setExpiryDays(Number(e.target.value))}
                className="w-full min-h-[36px] px-3 py-1.5 rounded-lg bg-[#152033] border border-slate-600/85 focus-visible:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-500/25 text-xs text-slate-100 outline-none"
              >
                {EXPIRY_OPTIONS.map((days) => (
                  <option key={days} value={days}>
                    {days === 0
                      ? dict.settingsModal.mcpExpiryNever
                      : t('settingsModal.mcpExpiryDays', { days })}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-slate-200">
              {dict.settingsModal.mcpScopesLabel}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {ALL_MCP_SCOPES.map((scope) => {
                const active = selectedScopes.includes(scope);
                return (
                  <button
                    key={scope}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleScope(scope)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono border transition-colors cursor-pointer ${
                      active
                        ? 'bg-sky-500/20 text-sky-200 border-sky-400/40'
                        : 'bg-white/[0.05] text-slate-400 hover:text-slate-200 border-white/[0.12]'
                    }`}
                  >
                    {active && <Check className="w-3 h-3 text-sky-300" aria-hidden="true" />}
                    <span>{scope}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="min-h-[32px] px-3 py-1 rounded-lg text-xs font-medium text-slate-200 bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.15] cursor-pointer"
            >
              {dict.common.cancel}
            </button>
            <button
              type="submit"
              disabled={isCreating || !label.trim()}
              className="inline-flex items-center gap-1.5 min-h-[32px] px-3.5 py-1 rounded-lg text-xs font-semibold text-slate-950 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 cursor-pointer"
            >
              {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
              <span>
                {isCreating ? dict.settingsModal.mcpCreatingBtn : dict.settingsModal.mcpCreateBtn}
              </span>
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="p-4 rounded-xl bg-[#253349]/55 border border-slate-600/75 flex items-center justify-center gap-2 text-xs text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-sky-400" aria-hidden="true" />
          <span>{dict.common.loading}</span>
        </div>
      ) : keys.length === 0 ? (
        <div className="p-4 rounded-xl bg-[#253349]/55 border border-slate-600/75 text-center">
          <Terminal className="w-5 h-5 text-slate-400 mx-auto mb-2" aria-hidden="true" />
          <p className="text-xs text-slate-400 leading-relaxed">{dict.settingsModal.mcpNoKeys}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((item) => {
            const isRevoked = Boolean(item.revokedAt);
            const isExpired = Boolean(item.expiresAt && new Date(item.expiresAt) <= new Date());
            const isBusy = busyId === item.id;
            const isConfirming = confirmRevokeId === item.id;
            const lastUsed = item.lastUsedAt
              ? new Date(item.lastUsedAt).toLocaleDateString(dateLocale)
              : dict.settingsModal.mcpNeverUsed;

            return (
              <div
                key={item.id}
                className="px-3.5 py-3 rounded-xl bg-[#253349]/55 border border-slate-600/75 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="w-9 h-9 rounded-lg bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0"
                    aria-hidden="true"
                  >
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-semibold text-slate-100 truncate">
                        {item.label}
                      </span>
                      {renderKeyStatusBadge(isRevoked, isExpired, {
                        revoked: dict.settingsModal.mcpRevokedBadge,
                        expired: dict.settingsModal.mcpExpiredBadge,
                        active: dict.settingsModal.mcpActiveBadge,
                      })}
                    </div>
                    <p className="text-xs font-mono text-slate-400 truncate mt-0.5">
                      {item.maskedPrefix} • {item.scopes.length} scopes •{' '}
                      {dict.settingsModal.mcpLastUsedLabel}: {lastUsed}
                    </p>
                  </div>
                </div>

                {!isRevoked && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isConfirming ? (
                      <button
                        type="button"
                        onClick={() => setConfirmRevokeId(item.id)}
                        disabled={isBusy}
                        title={dict.settingsModal.mcpRevokeBtn}
                        aria-label={`${dict.settingsModal.mcpRevokeBtn}: ${item.label}`}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/15 border border-transparent hover:border-rose-500/25 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleRevoke(item.id)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1 min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                        >
                          {isBusy && (
                            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                          )}
                          <span>{dict.settingsModal.mcpConfirmRevokeBtn}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRevokeId(null)}
                          disabled={isBusy}
                          className="inline-flex items-center min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium text-slate-100 bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.15] transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {dict.common.cancel}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
