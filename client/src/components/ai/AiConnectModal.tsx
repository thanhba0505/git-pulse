'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AiConnectionSummary, AiModelOption, AiProviderType } from '../../types';
import { api } from '../../lib/api';
import { useTranslation } from '../../i18n';
import { ModalDialog } from '../ui/ModalDialog';
import { Input } from '../ui/Input';
import { Select, SelectOption } from '../ui/Select';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';

interface AiConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultUsername: string;
  editingConnection?: AiConnectionSummary | null;
  onSaved: (connection: AiConnectionSummary, isUpdate: boolean, preferredModel?: string) => void;
}

export function AiConnectModal({
  isOpen,
  onClose,
  defaultUsername,
  editingConnection = null,
  onSaved,
}: AiConnectModalProps) {
  const { dict, t } = useTranslation();
  const [provider, setProvider] = useState<AiProviderType>('GOOGLE_GEMINI');
  const [labelInput, setLabelInput] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasTouchedKey, setHasTouchedKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewModels, setPreviewModels] = useState<AiModelOption[]>([]);
  const [previewSelectedModel, setPreviewSelectedModel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const apiKeyRef = useRef<HTMLInputElement>(null);
  const isUpdateMode = Boolean(editingConnection);

  useEffect(() => {
    if (!isOpen) return;
    setProvider(editingConnection?.provider ?? 'GOOGLE_GEMINI');
    setLabelInput(editingConnection?.label ?? '');
    setApiKeyInput('');
    setShowKey(false);
    setHasTouchedKey(false);
    setApiKeyError(null);
    setServerError(null);
    setIsPreviewing(false);
    setPreviewModels([]);
    setPreviewSelectedModel('');
  }, [isOpen, editingConnection]);

  const providerOptions: readonly SelectOption<AiProviderType>[] = [
    {
      value: 'GOOGLE_GEMINI',
      label: dict.aiModal.providerGeminiLabel,
      description: dict.aiModal.providerGeminiDesc,
    },
  ];

  const previewModelOptions: readonly SelectOption<string>[] = previewModels.map((m) => ({
    value: m.id,
    label: m.label,
    description: m.description,
  }));

  const handlePreviewModels = async () => {
    const cleanKey = apiKeyInput.trim();
    if (!cleanKey) {
      setApiKeyError(dict.aiModal.apiKeyRequired);
      apiKeyRef.current?.focus();
      return;
    }

    setIsPreviewing(true);
    setApiKeyError(null);
    setServerError(null);
    try {
      const res = await api.ai.previewModels({ provider, apiKey: cleanKey });
      setPreviewModels(res.models);
      setPreviewSelectedModel(res.models[0]?.id ?? '');
    } catch (err) {
      setPreviewModels([]);
      setPreviewSelectedModel('');
      setServerError((err as Error).message || dict.aiModal.saveError);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanKey = apiKeyInput.trim();
    if (!cleanKey) {
      setApiKeyError(dict.aiModal.apiKeyRequired);
      apiKeyRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    setApiKeyError(null);
    setServerError(null);
    try {
      const payload = {
        provider,
        apiKey: cleanKey,
        ...(labelInput.trim() ? { label: labelInput.trim() } : {}),
      };
      const saved = editingConnection
        ? await api.ai.updateConnection(editingConnection.id, payload)
        : await api.ai.createConnection(payload);

      setApiKeyInput('');
      onSaved(saved, Boolean(editingConnection), previewSelectedModel || undefined);
      onClose();
    } catch (err) {
      setServerError((err as Error).message || dict.aiModal.saveError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBusy = isSubmitting || isPreviewing;

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="ai-connect-modal-title"
      maxWidthClass="max-w-lg"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-slate-700/80 shrink-0">
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0"
            aria-hidden="true"
          >
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2
              id="ai-connect-modal-title"
              className="text-base font-semibold text-slate-100 tracking-tight"
            >
              {isUpdateMode ? dict.aiModal.titleUpdate : dict.aiModal.titleAdd}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{dict.aiModal.subtitle}</p>
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
        aria-labelledby="ai-connect-modal-title"
        className="p-6 space-y-5 overflow-y-auto gp-scroll-area"
      >
        {serverError && (
          <div
            role="alert"
            className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
            <span className="leading-relaxed">{serverError}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <Select
            id="ai-modal-provider"
            label={dict.aiModal.providerLabel}
            value={provider}
            options={providerOptions}
            onChange={(next) => {
              setProvider(next);
              setPreviewModels([]);
              setPreviewSelectedModel('');
            }}
            disabled={isBusy || isUpdateMode}
          />
          <p className="text-xs text-slate-400 leading-relaxed">{dict.aiModal.providerScopeNote}</p>
        </div>

        <Input
          id="ai-modal-label"
          name="label"
          type="text"
          label={dict.aiModal.labelField}
          value={labelInput}
          onChange={(e) => setLabelInput(e.target.value)}
          placeholder={t('aiModal.labelPlaceholder', { username: defaultUsername })}
          hint={t('aiModal.labelHint', { username: defaultUsername })}
          maxLength={80}
          autoComplete="off"
          disabled={isBusy}
        />

        <div className="space-y-3">
          <Input
            ref={apiKeyRef}
            id="ai-modal-api-key"
            name="apiKey"
            type={showKey ? 'text' : 'password'}
            label={dict.aiModal.apiKeyLabel}
            required
            requiredMark
            labelAction={
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 transition-colors"
              >
                <span>{dict.aiModal.getGeminiKeyLink}</span>
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>
            }
            leftIcon={<Key className="w-4 h-4" />}
            rightElement={
              <button
                type="button"
                onClick={() => setShowKey((prev) => !prev)}
                aria-pressed={showKey}
                aria-label={showKey ? dict.auth.hidePassword : dict.auth.showPassword}
                className="p-2 rounded-md text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                {showKey ? (
                  <EyeOff className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            }
            value={apiKeyInput}
            onChange={(e) => {
              const nextVal = e.target.value;
              setApiKeyInput(nextVal);
              if (nextVal.trim()) setHasTouchedKey(true);
              if (apiKeyError) setApiKeyError(null);
              if (serverError) setServerError(null);
              if (previewModels.length > 0) {
                setPreviewModels([]);
                setPreviewSelectedModel('');
              }
            }}
            onBlur={() => {
              if (hasTouchedKey && !apiKeyInput.trim()) {
                setApiKeyError(dict.aiModal.apiKeyRequired);
              }
            }}
            error={apiKeyError}
            placeholder={dict.aiModal.apiKeyPlaceholder}
            hint={dict.aiModal.apiKeyHint}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            className="font-mono"
            disabled={isBusy}
          />

          <button
            type="button"
            onClick={() => void handlePreviewModels()}
            disabled={isBusy}
            className="inline-flex items-center gap-2 min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-medium text-sky-300 hover:text-sky-200 bg-sky-500/10 hover:bg-sky-500/15 border border-sky-400/25 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isPreviewing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>
              {isPreviewing ? dict.aiModal.previewingModelsBtn : dict.aiModal.previewModelsBtn}
            </span>
          </button>

          {previewModels.length > 0 && (
            <div className="p-3.5 rounded-xl bg-emerald-500/[0.07] border border-emerald-500/25 space-y-3">
              <div
                role="status"
                aria-live="polite"
                className="flex items-center gap-2 text-xs font-medium text-emerald-300"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                <span>{t('aiModal.previewSuccess', { count: previewModels.length })}</span>
              </div>

              <Select
                id="ai-modal-default-model"
                label={dict.aiModal.defaultModelLabel}
                value={previewSelectedModel}
                options={previewModelOptions}
                onChange={setPreviewSelectedModel}
                disabled={isBusy}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-700/80">
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
            <span>{dict.githubModal.securityNote}</span>
          </p>

          <div className="flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center min-h-[38px] px-4 py-2 rounded-lg text-xs font-medium text-slate-200 hover:text-white bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.15] transition-colors cursor-pointer disabled:opacity-50"
            >
              {dict.common.cancel}
            </button>
            <button
              type="submit"
              disabled={isBusy}
              className="gp-cta-shimmer inline-flex items-center justify-center gap-2 min-h-[38px] px-5 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-sky-500 hover:bg-sky-400 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
              <span>
                {isSubmitting
                  ? dict.aiModal.savingBtn
                  : isUpdateMode
                    ? dict.aiModal.updateBtn
                    : dict.aiModal.saveBtn}
              </span>
            </button>
          </div>
        </div>
      </form>
    </ModalDialog>
  );
}
