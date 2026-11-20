'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n';
import { DEFAULT_AI_PROMPT } from '../../lib/ai-prompt.constants';
import { ModalDialog } from '../ui/ModalDialog';
import { AlertCircle, Loader2, RotateCcw, SlidersHorizontal, X } from 'lucide-react';

interface AiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customPrompt: string;
  onSave: (next: { customPrompt: string }) => Promise<void>;
}

const MAX_PROMPT_LENGTH = 2000;

export function AiSettingsModal({ isOpen, onClose, customPrompt, onSave }: AiSettingsModalProps) {
  const { dict, t } = useTranslation();
  const [draftPrompt, setDraftPrompt] = useState(
    customPrompt.trim() ? customPrompt : DEFAULT_AI_PROMPT,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDraftPrompt(customPrompt.trim() ? customPrompt : DEFAULT_AI_PROMPT);
    setError(null);
  }, [isOpen, customPrompt]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await onSave({ customPrompt: draftPrompt.trim() });
      onClose();
    } catch (err) {
      setError((err as Error).message || dict.aiSettingsModal.saveError);
    } finally {
      setIsSaving(false);
    }
  };

  const isPromptCustomized = draftPrompt.trim() !== DEFAULT_AI_PROMPT.trim();

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="ai-settings-modal-title"
      maxWidthClass="max-w-xl"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-slate-700/80 shrink-0">
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0"
            aria-hidden="true"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2
              id="ai-settings-modal-title"
              className="text-base font-semibold text-slate-100 tracking-tight"
            >
              {dict.aiSettingsModal.title}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              {dict.aiSettingsModal.subtitle}
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
        aria-labelledby="ai-settings-modal-title"
        className="p-6 space-y-5 overflow-y-auto gp-scroll-area"
      >
        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="ai-custom-prompt" className="text-xs font-medium text-slate-300">
              {dict.aiSettingsModal.customPromptLabel}
            </label>
            {isPromptCustomized && (
              <button
                type="button"
                onClick={() => setDraftPrompt(DEFAULT_AI_PROMPT)}
                disabled={isSaving}
                className="inline-flex items-center gap-1 text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                <span>{dict.aiSettingsModal.resetPromptBtn}</span>
              </button>
            )}
          </div>

          <textarea
            id="ai-custom-prompt"
            value={draftPrompt}
            onChange={(e) => setDraftPrompt(e.target.value)}
            maxLength={MAX_PROMPT_LENGTH}
            rows={10}
            disabled={isSaving}
            placeholder={dict.aiSettingsModal.customPromptPlaceholder}
            aria-describedby="ai-custom-prompt-hint"
            className="w-full p-3.5 rounded-xl bg-[#152033] border border-slate-600/85 hover:border-slate-500 focus-visible:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-500/25 font-mono text-xs text-slate-100 placeholder:text-slate-400 leading-relaxed outline-none resize-y transition-colors disabled:opacity-50"
          />

          <div className="flex items-start justify-between gap-3">
            <p id="ai-custom-prompt-hint" className="text-xs text-slate-400 leading-relaxed">
              {dict.aiSettingsModal.customPromptHint}
            </p>
            <span className="text-xs font-mono text-slate-400 tabular-nums shrink-0">
              {t('aiSettingsModal.charCount', { count: draftPrompt.length })}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-700/80">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="inline-flex items-center justify-center min-h-[38px] px-4 py-2 rounded-lg text-xs font-medium text-slate-200 hover:text-white bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.15] transition-colors cursor-pointer disabled:opacity-50"
          >
            {dict.common.cancel}
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="gp-cta-shimmer inline-flex items-center justify-center gap-2 min-h-[38px] px-5 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-sky-500 hover:bg-sky-400 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
            <span>{isSaving ? dict.aiSettingsModal.savingBtn : dict.aiSettingsModal.saveBtn}</span>
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
