'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AiEngine } from '../../types';
import { useTranslation } from '../../i18n';
import { Select, SelectOption } from '../ui/Select';
import { ShowcaseCard } from '../ui/ShowcaseCard';
import { Sparkles, Cpu, Globe, Loader2, AlertCircle, HardDrive, CheckCircle2 } from 'lucide-react';

interface CockpitAiConsoleProps {
  engine: AiEngine;
  onEngineChange: (engine: AiEngine) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  language: 'vi' | 'en';
  onLanguageChange: (lang: 'vi' | 'en') => void;
  onGenerate: () => void;
  isGenerating: boolean;
  error?: string | null;
  webLlmProgressText?: string;
  webLlmProgressPercent?: number;
  selectedPrCount: number;
}

export function CockpitAiConsole({
  engine,
  onEngineChange,
  selectedModel,
  onModelChange,
  language,
  onLanguageChange,
  onGenerate,
  isGenerating,
  error,
  webLlmProgressText,
  webLlmProgressPercent,
  selectedPrCount,
}: CockpitAiConsoleProps) {
  const { dict, t } = useTranslation();
  const isWebLLM = engine === 'WEB_LLM';
  const [hasWebGpuCache, setHasWebGpuCache] = useState(false);

  useEffect(() => {
    if (!isWebLLM || typeof window === 'undefined' || !('caches' in window)) return;

    let mounted = true;
    window.caches
      .keys()
      .then((keys) => {
        if (mounted) {
          setHasWebGpuCache(keys.some((k) => k.toLowerCase().includes('webllm')));
        }
      })
      .catch(() => {
        if (mounted) setHasWebGpuCache(false);
      });

    return () => {
      mounted = false;
    };
  }, [isWebLLM]);

  const preloadWebLlm = () => {
    void import('../../lib/webllm');
  };

  const modelOptions = useMemo<readonly SelectOption<string>[]>(() => {
    if (isWebLLM) {
      return [
        {
          value: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
          label: dict.aiConsole.models.llama32LocalLabel,
          description: dict.aiConsole.models.llama32LocalDesc,
        },
        {
          value: 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
          label: dict.aiConsole.models.qwenLocalLabel,
          description: dict.aiConsole.models.qwenLocalDesc,
        },
      ];
    }

    return [
      {
        value: 'gpt-4o-mini',
        label: dict.aiConsole.models.gpt4oMiniLabel,
        description: dict.aiConsole.models.gpt4oMiniDesc,
      },
      {
        value: 'meta-llama-3.3-70b-instruct',
        label: dict.aiConsole.models.llama33Label,
        description: dict.aiConsole.models.llama33Desc,
      },
    ];
  }, [isWebLLM, dict]);

  const outputLanguageOptions = useMemo<readonly SelectOption<'vi' | 'en'>[]>(
    () => [
      { value: 'vi', label: dict.aiConsole.outputLangVi },
      { value: 'en', label: dict.aiConsole.outputLangEn },
    ],
    [dict],
  );

  const progressPct = Math.max(0, Math.min(100, Math.round((webLlmProgressPercent || 0) * 100)));
  const hasSelection = selectedPrCount > 0;
  const ctaText = isGenerating
    ? dict.aiConsole.generatingBtn
    : hasSelection
      ? t('aiConsole.generateSelectedBtn', { count: selectedPrCount })
      : dict.aiConsole.generateBtn;

  return (
    <ShowcaseCard as="section" aria-labelledby="ai-console-heading" className="p-5 sm:p-6">
      <div className="space-y-5">
        {/* Header */}
        <div className="border-b border-slate-800/80 pb-4">
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

        {/* Engine Radio Selection */}
        <div
          role="radiogroup"
          aria-label={dict.aiConsole.engineGroupLabel}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          {/* Cloud Engine */}
          <button
            type="button"
            role="radio"
            aria-checked={engine === 'GITHUB_MODELS'}
            onClick={() => {
              onEngineChange('GITHUB_MODELS');
              onModelChange('gpt-4o-mini');
            }}
            className={`flex flex-col justify-between p-4 rounded-xl text-left border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
              engine === 'GITHUB_MODELS'
                ? 'bg-sky-500/10 border-sky-500/60 text-slate-100'
                : 'bg-[#161A24] border-slate-800 hover:border-slate-700 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2 w-full">
              <div className="flex items-center gap-2 min-w-0">
                <Globe
                  className={`w-4 h-4 shrink-0 ${
                    engine === 'GITHUB_MODELS' ? 'text-sky-400' : 'text-slate-400'
                  }`}
                  aria-hidden="true"
                />
                <span className="text-xs font-semibold text-slate-100 truncate">
                  {dict.aiConsole.cloudTitle}
                </span>
              </div>
              <span
                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  engine === 'GITHUB_MODELS'
                    ? 'border-sky-400 bg-sky-500/20'
                    : 'border-slate-600 bg-[#0C0E14]'
                }`}
                aria-hidden="true"
              >
                {engine === 'GITHUB_MODELS' && <span className="w-2 h-2 rounded-full bg-sky-400" />}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{dict.aiConsole.cloudDesc}</p>
          </button>

          {/* Browser WebGPU Engine with Predictive Chunk Preload */}
          <button
            type="button"
            role="radio"
            aria-checked={engine === 'WEB_LLM'}
            onPointerEnter={preloadWebLlm}
            onFocus={preloadWebLlm}
            onClick={() => {
              preloadWebLlm();
              onEngineChange('WEB_LLM');
              onModelChange('Llama-3.2-1B-Instruct-q4f16_1-MLC');
            }}
            className={`flex flex-col justify-between p-4 rounded-xl text-left border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
              engine === 'WEB_LLM'
                ? 'bg-sky-500/10 border-sky-500/60 text-slate-100'
                : 'bg-[#161A24] border-slate-800 hover:border-slate-700 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2 w-full">
              <div className="flex items-center gap-2 min-w-0">
                <Cpu
                  className={`w-4 h-4 shrink-0 ${
                    engine === 'WEB_LLM' ? 'text-sky-400' : 'text-slate-400'
                  }`}
                  aria-hidden="true"
                />
                <span className="text-xs font-semibold text-slate-100 truncate">
                  {dict.aiConsole.localTitle}
                </span>
              </div>
              <span
                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  engine === 'WEB_LLM'
                    ? 'border-sky-400 bg-sky-500/20'
                    : 'border-slate-600 bg-[#0C0E14]'
                }`}
                aria-hidden="true"
              >
                {engine === 'WEB_LLM' && <span className="w-2 h-2 rounded-full bg-sky-400" />}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{dict.aiConsole.localDesc}</p>
          </button>
        </div>

        {/* Model & Report Language Select Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label={dict.aiConsole.modelLabel}
            value={selectedModel}
            options={modelOptions}
            onChange={onModelChange}
            disabled={isGenerating}
          />

          <Select
            label={dict.aiConsole.outputLangLabel}
            value={language}
            options={outputLanguageOptions}
            onChange={onLanguageChange}
            disabled={isGenerating}
          />
        </div>

        {/* WebGPU Local Cache Indicator */}
        {isWebLLM && (
          <div className="flex items-center gap-2 text-xs text-slate-400 px-3 py-2 rounded-lg bg-[#0C0E14] border border-slate-800">
            {hasWebGpuCache ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
            ) : (
              <HardDrive className="w-3.5 h-3.5 text-sky-400 shrink-0" aria-hidden="true" />
            )}
            <span className="leading-snug">
              {hasWebGpuCache ? dict.aiConsole.webgpuCachedHint : dict.aiConsole.webgpuDownloadHint}
            </span>
          </div>
        )}

        {/* Inline Error Alert */}
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
          disabled={!hasSelection || isGenerating}
          className="gp-cta-shimmer w-full min-h-[42px] flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-slate-950 bg-sky-500 hover:bg-sky-400 active:scale-[0.98] transition-all cursor-pointer disabled:bg-slate-800 disabled:text-slate-400 disabled:border disabled:border-slate-700/80 disabled:active:scale-100 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
          ) : (
            <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
          )}
          <span>{ctaText}</span>
          {!isGenerating && hasSelection && (
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-slate-950/20 text-xs font-mono font-semibold text-slate-950/80 ml-1">
              ⌘↵
            </kbd>
          )}
        </button>

        {/* WebGPU Download / Init Progress */}
        {isGenerating && isWebLLM && (
          <div className="p-3.5 rounded-lg bg-[#0C0E14] border border-slate-800 space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs text-slate-300 font-mono">
              <span className="truncate">{webLlmProgressText || dict.aiConsole.loadingModel}</span>
              <span className="tabular-nums text-sky-400 shrink-0">{progressPct}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-sky-500 transition-all duration-200"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </ShowcaseCard>
  );
}
