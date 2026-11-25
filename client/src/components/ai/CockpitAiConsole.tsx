'use client';

import React, { useMemo } from 'react';
import { AiAvailabilityState, AiConnectionSummary, AiModelOption } from '../../types';
import { useTranslation } from '../../i18n';
import { Select, SelectOption } from '../ui/Select';
import { ShowcaseCard } from '../ui/ShowcaseCard';
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  RefreshCw,
  Settings,
  Sparkles,
} from 'lucide-react';

export const BUILTIN_GITHUB_TOOL_KEY = 'builtin:GITHUB_MODELS';
export const ADD_AI_PROVIDER_ACTION = '__ADD_AI_PROVIDER__';

interface CockpitAiConsoleProps {
  selectedToolKey: string;
  onSelectToolKey: (toolKey: string) => void;
  connections: readonly AiConnectionSummary[];
  githubModels: readonly AiModelOption[];
  selectedModel: string;
  onModelChange: (model: string) => void;
  hasCustomPrompt: boolean;
  onOpenAiSettings: () => void;
  availability: AiAvailabilityState;
  onRecheckAvailability: () => void;
  onRefreshModels: () => void;
  isRefreshingModels: boolean;
  onOpenAddAiModal: () => void;
  onOpenUpdateAiModal: (connection: AiConnectionSummary) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  error?: string | null;
  selectedPrCount: number;
  selectedCommitCount: number;
}

export function CockpitAiConsole({
  selectedToolKey,
  onSelectToolKey,
  connections,
  githubModels,
  selectedModel,
  onModelChange,
  hasCustomPrompt,
  onOpenAiSettings,
  availability,
  onRecheckAvailability,
  onRefreshModels,
  isRefreshingModels,
  onOpenAddAiModal,
  onOpenUpdateAiModal,
  onGenerate,
  isGenerating,
  error,
  selectedPrCount,
  selectedCommitCount,
}: CockpitAiConsoleProps) {
  const { dict, t } = useTranslation();

  const activeConnection = useMemo(() => {
    if (!selectedToolKey.startsWith('conn:')) return null;
    const targetId = selectedToolKey.slice(5);
    return connections.find((c) => c.id === targetId) ?? null;
  }, [selectedToolKey, connections]);

  const providerOptions = useMemo<readonly SelectOption<string>[]>(() => {
    const items: SelectOption<string>[] = [
      {
        value: BUILTIN_GITHUB_TOOL_KEY,
        label: dict.aiConsole.githubModelsLabel,
        description: dict.aiConsole.githubModelsDesc,
      },
      ...connections.map((conn) => {
        const providerName =
          conn.provider === 'GROQ'
            ? dict.aiConsole.groqProviderLabel
            : dict.aiConsole.geminiProviderLabel;
        return {
          value: `conn:${conn.id}`,
          label: `${providerName} (${conn.label})`,
          description: dict.aiModal.apiKeyLabel,
          ...(conn.status === 'REVOKED'
            ? { badge: dict.aiConsole.revokedBadge, badgeTone: 'rose' as const }
            : {}),
        };
      }),
      {
        value: ADD_AI_PROVIDER_ACTION,
        label: dict.aiConsole.addProviderOptionLabel,
        description: dict.aiConsole.addProviderOptionDesc,
        isAction: true,
      },
    ];
    return items;
  }, [connections, dict]);

  const modelOptions = useMemo<readonly SelectOption<string>[]>(() => {
    if (activeConnection) {
      return activeConnection.availableModels.map((m) => ({
        value: m.id,
        label: m.label,
        description: m.description,
      }));
    }

    if (githubModels.length > 0) {
      return githubModels.map((m) => ({
        value: m.id,
        label: m.label,
        description: m.description,
      }));
    }

    return [
      {
        value: 'openai/gpt-4o-mini',
        label: dict.aiConsole.models.gpt4oMiniLabel,
        description: dict.aiConsole.models.gpt4oMiniDesc,
      },
      {
        value: 'meta/llama-3.3-70b-instruct',
        label: dict.aiConsole.models.llama33Label,
        description: dict.aiConsole.models.llama33Desc,
      },
    ];
  }, [activeConnection, githubModels, dict]);

  const handleToolChange = (nextKey: string) => {
    if (nextKey === ADD_AI_PROVIDER_ACTION) {
      onOpenAddAiModal();
      return;
    }
    onSelectToolKey(nextKey);
  };

  const hasSelection = selectedPrCount > 0;
  const isChecking = availability.status === 'checking';
  const isUnavailable = availability.status === 'unavailable';
  const isGenerateDisabled =
    !hasSelection || isGenerating || isRefreshingModels || isChecking || isUnavailable;

  const ctaText = isGenerating
    ? dict.aiConsole.generatingBtn
    : selectedCommitCount > 0
      ? t('aiConsole.generateSelectedBtn', { count: selectedCommitCount })
      : dict.aiConsole.generateBtn;

  return (
    <ShowcaseCard as="section" aria-labelledby="ai-console-heading" className="p-5 sm:p-6">
      <div className="space-y-4">
        {/* Header + AI Prompt & Language Settings Trigger */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-700/80 pb-4">
          <div className="min-w-0">
            <h2
              id="ai-console-heading"
              className="text-base font-semibold text-slate-100 tracking-tight"
            >
              {dict.aiConsole.title}
            </h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {dict.aiConsole.description}
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenAiSettings}
            title={dict.aiConsole.aiSettingsBtn}
            aria-label={dict.aiConsole.aiSettingsBtn}
            className="relative inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.14] hover:border-white/[0.24] transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
          >
            <Settings className="w-4 h-4" aria-hidden="true" />
            {hasCustomPrompt && (
              <span
                aria-hidden="true"
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.85)]"
              />
            )}
          </button>
        </div>

        {/* AI Provider Select */}
        <Select
          id="ai-provider-select"
          label={dict.aiConsole.providerLabel}
          value={selectedToolKey}
          options={providerOptions}
          onChange={handleToolChange}
          disabled={isGenerating || isRefreshingModels}
        />

        {/* Full-Width AI Model Select */}
        <Select
          id="ai-model-select"
          label={dict.aiConsole.modelLabel}
          labelAction={
            <button
              type="button"
              onClick={onRefreshModels}
              disabled={isGenerating || isRefreshingModels}
              title={dict.aiConsole.refreshModelsBtn}
              aria-label={dict.aiConsole.refreshModelsBtn}
              className="inline-flex items-center gap-1 text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3 h-3 ${isRefreshingModels ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>
                {isRefreshingModels
                  ? dict.aiConsole.refreshingModelsBtn
                  : dict.aiConsole.refreshModelsBtn}
              </span>
            </button>
          }
          value={selectedModel}
          options={modelOptions}
          onChange={onModelChange}
          disabled={isGenerating || isRefreshingModels}
        />

        {/* Live Model Availability Status */}
        <div aria-live="polite">
          {isChecking && (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-[#152033] border border-slate-700/80 text-xs text-slate-300">
              <Loader2 className="w-4 h-4 text-sky-400 animate-spin shrink-0" aria-hidden="true" />
              <span>{dict.aiConsole.checkingAvailability}</span>
            </div>
          )}

          {availability.status === 'available' && (
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg bg-emerald-500/[0.08] border border-emerald-500/25 text-xs text-emerald-300">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                <span className="truncate font-medium">{dict.aiConsole.availableStatus}</span>
              </div>
              {typeof availability.latencyMs === 'number' && (
                <span className="font-mono text-xs text-emerald-300/85 tabular-nums shrink-0">
                  {availability.latencyMs}ms
                </span>
              )}
            </div>
          )}

          {isUnavailable && (
            <div
              role="status"
              className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-xs text-rose-200 space-y-2.5"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
                <p className="leading-relaxed">
                  <span className="font-semibold text-rose-100">
                    {dict.aiConsole.unavailablePrefix}{' '}
                  </span>
                  {availability.reason}
                </p>
              </div>

              <div className="flex items-center flex-wrap gap-2 pl-6">
                <button
                  type="button"
                  onClick={onRecheckAvailability}
                  className="inline-flex items-center gap-1.5 min-h-[30px] px-2.5 py-1 rounded-md text-xs font-medium text-slate-100 bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.16] transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" aria-hidden="true" />
                  <span>{dict.aiConsole.recheckBtn}</span>
                </button>

                {activeConnection &&
                  (availability.reasonCode === 'INVALID_KEY' ||
                    availability.reasonCode === 'DECRYPT_ERROR' ||
                    availability.reasonCode === 'NOT_CONNECTED') && (
                    <button
                      type="button"
                      onClick={() => onOpenUpdateAiModal(activeConnection)}
                      className="inline-flex items-center gap-1.5 min-h-[30px] px-2.5 py-1 rounded-md text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 transition-colors cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{dict.aiConsole.updateKeyQuickBtn}</span>
                    </button>
                  )}
              </div>
            </div>
          )}
        </div>

        {/* Inline Generate Error Alert */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Primary Generate Button */}
        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerateDisabled}
          className="gp-cta-shimmer w-full min-h-[42px] flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-slate-950 bg-sky-500 hover:bg-sky-400 active:scale-[0.98] transition-all cursor-pointer disabled:bg-slate-700/70 disabled:text-slate-300 disabled:border disabled:border-slate-600/80 disabled:active:scale-100 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
          ) : (
            <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
          )}
          <span>{ctaText}</span>
          {!isGenerating && !isGenerateDisabled && (
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-slate-950/20 text-xs font-mono font-semibold text-slate-950/80 ml-1">
              ⌘↵
            </kbd>
          )}
        </button>
      </div>
    </ShowcaseCard>
  );
}
