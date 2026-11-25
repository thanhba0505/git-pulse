'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';
import { useTranslation } from '../../i18n';
import { api } from '../../lib/api';
import {
  ParabolConnectionSummary,
  ParabolStandupMeeting,
  SubmitParabolStandupResponse,
} from '../../types';
import { Input } from '../ui/Input';
import { ModalDialog } from '../ui/ModalDialog';
import { Select, SelectOption } from '../ui/Select';
import { useToast } from '../ui/Toast';

interface ParabolSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  bullets: string[];
  connections: readonly ParabolConnectionSummary[];
  onConnectionsChanged: (next: ParabolConnectionSummary[]) => void;
  onSubmitted?: (result: SubmitParabolStandupResponse) => void;
}

const PARABOL_PROFILE_URL = 'https://action.parabol.co/me/profile';

export function ParabolSubmitModal({
  isOpen,
  onClose,
  bullets,
  connections,
  onConnectionsChanged,
  onSubmitted,
}: ParabolSubmitModalProps) {
  const { dict, t } = useTranslation();
  const { showToast } = useToast();

  const activeConnection = connections.find((c) => c.isActive) ?? connections[0] ?? null;

  const [showConnectForm, setShowConnectForm] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const [meetings, setMeetings] = useState<ParabolStandupMeeting[]>([]);
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState('');
  const [selectedPromptId, setSelectedPromptId] = useState('');

  const [draftText, setDraftText] = useState('');
  const [shareImmediately, setShareImmediately] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStandups = useCallback(
    async (opts?: { refresh?: boolean }) => {
      setIsLoadingMeetings(true);
      setError(null);
      try {
        const res = await api.parabol.listStandups({
          refresh: opts?.refresh,
        });
        if (!res.connected) {
          setMeetings([]);
          setShowConnectForm(true);
          return;
        }
        setMeetings(res.meetings);
        const firstMeeting = res.meetings[0];
        if (firstMeeting) {
          setSelectedMeetingId((prev) =>
            res.meetings.some((m) => m.id === prev) ? prev : firstMeeting.id,
          );
          const targetMeeting =
            res.meetings.find((m) => m.id === selectedMeetingId) ?? firstMeeting;
          const firstPrompt = targetMeeting.prompts[0];
          if (firstPrompt) {
            setSelectedPromptId((prev) =>
              targetMeeting.prompts.some((p) => p.id === prev) ? prev : firstPrompt.id,
            );
          }
        } else {
          setSelectedMeetingId('');
          setSelectedPromptId('');
        }
      } catch (err) {
        setError((err as Error).message || 'Failed to load Parabol Standups.');
      } finally {
        setIsLoadingMeetings(false);
      }
    },
    [selectedMeetingId],
  );

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setDraftText(bullets.length > 0 ? ['Today:', ...bullets.map((b) => `• ${b}`)].join('\n') : '');
    setShareImmediately(false);

    if (activeConnection && activeConnection.status === 'ACTIVE') {
      setShowConnectForm(false);
      void loadStandups();
    } else {
      setShowConnectForm(true);
      setMeetings([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const selectedMeeting = meetings.find((m) => m.id === selectedMeetingId) ?? meetings[0] ?? null;
  const activePrompts = selectedMeeting?.prompts ?? [];
  const effectivePromptId = activePrompts.some((p) => p.id === selectedPromptId)
    ? selectedPromptId
    : (activePrompts[0]?.id ?? '');

  const existingResponse = selectedMeeting?.viewerResponses.find(
    (r) => r.promptId === effectivePromptId,
  );

  const meetingOptions: SelectOption<string>[] = meetings.map((m) => ({
    value: m.id,
    label: `${m.name} (${m.teamName})`,
    description: `${m.prompts.length} prompt(s)`,
  }));

  const promptOptions: SelectOption<string>[] = activePrompts.map((p) => {
    const existing = selectedMeeting?.viewerResponses.find((r) => r.promptId === p.id);
    return {
      value: p.id,
      label: p.question,
      description: p.description || undefined,
      badge: existing
        ? existing.sharedAt
          ? dict.parabolModal.existingSharedBadge
          : dict.parabolModal.existingDraftBadge
        : undefined,
      badgeTone: existing ? (existing.sharedAt ? 'emerald' : 'amber') : undefined,
    };
  });

  const handleSelectMeeting = (nextMeetingId: string) => {
    setSelectedMeetingId(nextMeetingId);
    const nextMeeting = meetings.find((m) => m.id === nextMeetingId);
    if (nextMeeting?.prompts[0]) {
      setSelectedPromptId(nextMeeting.prompts[0].id);
    }
  };

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedToken = tokenInput.trim();
    if (!trimmedToken) {
      setError(dict.parabolModal.patHint);
      return;
    }

    setIsConnecting(true);
    setError(null);
    try {
      const saved = await api.parabol.saveConnection({
        token: trimmedToken,
        label: labelInput.trim() || undefined,
      });
      const updated = await api.parabol.listConnections().catch(() => [saved]);
      onConnectionsChanged(updated);
      setTokenInput('');
      setLabelInput('');
      setShowConnectForm(false);
      showToast({
        title: t('toasts.parabolConnected', { label: saved.label }),
        variant: 'success',
      });
      await loadStandups();
    } catch (err) {
      setError((err as Error).message || 'Failed to verify Parabol token.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSubmitStandup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeeting || !effectivePromptId) return;

    const lines = draftText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      setError(dict.standupDock.editPlaceholder);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await api.parabol.submitStandup({
        connectionId: activeConnection?.id,
        meetingId: selectedMeeting.id,
        promptId: effectivePromptId,
        bullets: lines,
        shareImmediately,
      });
      showToast({
        title: res.shared ? dict.toasts.parabolShared : dict.toasts.parabolDraftSaved,
        description: res.meetingName,
        variant: 'success',
      });
      onSubmitted?.(res);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Failed to submit standup to Parabol.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="parabol-modal-title"
      maxWidthClass="max-w-xl"
    >
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
              id="parabol-modal-title"
              className="text-base font-semibold text-slate-100 tracking-tight"
            >
              {dict.parabolModal.title}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              {dict.parabolModal.subtitle}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={dict.common.close}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700/80 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="p-6 space-y-5 max-h-[75dvh] overflow-y-auto gp-scroll-area">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-200"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
            <span className="break-words">{error}</span>
          </div>
        )}

        {showConnectForm || !activeConnection ? (
          <form onSubmit={(e) => void handleConnectSubmit(e)} className="space-y-4">
            <div className="p-4 rounded-xl bg-[#253349]/60 border border-slate-600/80 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
                  <span>{dict.parabolModal.connectTitle}</span>
                </h3>
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
              <p className="text-xs text-slate-400 leading-relaxed">
                {dict.parabolModal.connectDesc}
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="parabol-pat-input"
                className="block text-xs font-medium text-slate-200"
              >
                {dict.parabolModal.patLabel}
              </label>
              <Input
                id="parabol-pat-input"
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder={dict.parabolModal.patPlaceholder}
                autoComplete="off"
                required
              />
              <p className="text-xs text-slate-400">{dict.parabolModal.patHint}</p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="parabol-label-input"
                className="block text-xs font-medium text-slate-200"
              >
                {dict.parabolModal.labelInput}
              </label>
              <Input
                id="parabol-label-input"
                type="text"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                placeholder={dict.parabolModal.labelPlaceholder}
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              {activeConnection && activeConnection.status === 'ACTIVE' && (
                <button
                  type="button"
                  onClick={() => setShowConnectForm(false)}
                  className="min-h-[36px] px-4 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.15] cursor-pointer"
                >
                  {dict.common.cancel}
                </button>
              )}
              <button
                type="submit"
                disabled={isConnecting}
                className="gp-cta-shimmer inline-flex items-center gap-2 min-h-[36px] px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-950 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 cursor-pointer"
              >
                {isConnecting && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                )}
                <span>
                  {isConnecting ? dict.parabolModal.connectingBtn : dict.parabolModal.connectBtn}
                </span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={(e) => void handleSubmitStandup(e)} className="space-y-4">
            {/* Active Parabol connection strip */}
            <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#253349]/55 border border-slate-600/75">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                <span className="text-xs text-slate-200 truncate">
                  {t('parabolModal.connectedAs', {
                    name: activeConnection.parabolName || activeConnection.label,
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void loadStandups({ refresh: true })}
                  disabled={isLoadingMeetings}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-200 bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.14] cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${isLoadingMeetings ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  <span>{dict.parabolModal.refreshMeetingsBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowConnectForm(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-sky-300 hover:text-sky-200 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/25 cursor-pointer"
                >
                  <KeyRound className="w-3 h-3" aria-hidden="true" />
                  <span>{dict.parabolModal.manageConnectionBtn}</span>
                </button>
              </div>
            </div>

            {/* Standup Meeting Select */}
            <div>
              {meetings.length > 0 ? (
                <Select
                  id="parabol-meeting-select"
                  label={dict.parabolModal.meetingLabel}
                  value={selectedMeeting?.id ?? ''}
                  options={meetingOptions}
                  onChange={handleSelectMeeting}
                  disabled={isLoadingMeetings}
                  placeholder={dict.parabolModal.meetingPlaceholder}
                />
              ) : (
                <div className="p-3 rounded-xl bg-[#253349]/50 border border-slate-600/75 text-xs text-slate-300">
                  {isLoadingMeetings ? dict.common.loading : dict.parabolModal.noActiveMeetings}
                </div>
              )}
            </div>

            {/* Prompt Select */}
            {selectedMeeting && promptOptions.length > 0 && (
              <div className="space-y-1.5">
                <Select
                  id="parabol-prompt-select"
                  label={dict.parabolModal.promptLabel}
                  value={effectivePromptId}
                  options={promptOptions}
                  onChange={setSelectedPromptId}
                  placeholder={dict.parabolModal.promptPlaceholder}
                />
                {existingResponse && (
                  <p className="text-xs text-amber-300/90 leading-relaxed">
                    {dict.parabolModal.existingOverwriteHint}
                  </p>
                )}
              </div>
            )}

            {/* Preview & Quick Edit */}
            <div className="space-y-1.5">
              <label
                htmlFor="parabol-preview-textarea"
                className="block text-xs font-medium text-slate-200"
              >
                {dict.parabolModal.previewLabel}
              </label>
              <textarea
                id="parabol-preview-textarea"
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                rows={Math.max(4, Math.min(8, bullets.length + 1))}
                className="w-full p-3.5 rounded-xl bg-[#152033] border border-slate-600/80 focus:border-sky-400/70 focus:ring-2 focus:ring-sky-500/25 text-xs text-slate-100 leading-relaxed outline-none resize-y"
              />
            </div>

            {/* Options */}
            <div className="rounded-xl bg-[#253349]/45 border border-slate-600/75">
              <div className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <label
                    htmlFor="parabol-share-toggle"
                    className="block text-xs font-medium text-slate-200 cursor-pointer"
                  >
                    {dict.parabolModal.shareImmediatelyLabel}
                  </label>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    {dict.parabolModal.shareImmediatelyDesc}
                  </p>
                </div>
                <button
                  id="parabol-share-toggle"
                  type="button"
                  role="switch"
                  aria-checked={shareImmediately}
                  onClick={() => setShareImmediately((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors cursor-pointer ${
                    shareImmediately
                      ? 'bg-sky-500 border-sky-400'
                      : 'bg-slate-700 border-slate-500 hover:border-slate-400'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      shareImmediately ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[36px] px-4 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.15] cursor-pointer"
              >
                {dict.common.cancel}
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !selectedMeeting || !effectivePromptId}
                className="gp-cta-shimmer inline-flex items-center gap-2 min-h-[36px] px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-950 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>
                  {isSubmitting
                    ? dict.parabolModal.submittingBtn
                    : shareImmediately
                      ? dict.parabolModal.submitShareBtn
                      : dict.parabolModal.submitDraftBtn}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </ModalDialog>
  );
}
