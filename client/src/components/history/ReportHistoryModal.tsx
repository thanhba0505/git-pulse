'use client';

import React, { useEffect, useState } from 'react';
import { ReportItem } from '../../types';
import { api } from '../../lib/api';
import { useTranslation } from '../../i18n';
import { ModalDialog } from '../ui/ModalDialog';
import { HistoryListSkeleton } from '../ui/Skeleton';
import { useToast } from '../ui/Toast';
import { History, X, Copy, Trash2, Calendar, Check } from 'lucide-react';

interface ReportHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ReportHistoryModal({ isOpen, onClose }: ReportHistoryModalProps) {
  const { locale, dict, t } = useTranslation();
  const { showToast } = useToast();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    setConfirmDeleteId(null);
    setIsLoading(true);
    api.reports
      .list()
      .then((data) => {
        if (mounted) setReports(data);
      })
      .catch(() => {
        if (mounted) setReports([]);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast({
      title: t('standupDock.copiedToast', { format: dict.standupDock.copyBullet }),
      variant: 'success',
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleConfirmDelete = async (id: string) => {
    try {
      await api.reports.delete(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
      showToast({
        title: dict.toasts.reportDeleted,
        variant: 'info',
      });
    } catch {
      // ignore
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const dateLocale = locale === 'en' ? 'en-US' : 'vi-VN';

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="history-modal-title"
      maxWidthClass="max-w-2xl"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400 shrink-0"
            aria-hidden="true"
          >
            <History className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2
              id="history-modal-title"
              className="text-base font-semibold text-slate-100 tracking-tight"
            >
              {dict.historyModal.title}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              {dict.historyModal.subtitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label={dict.common.close}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Scrollable Content List */}
      <div className="flex-1 overflow-y-auto gp-scroll-area p-6 space-y-3">
        {isLoading ? (
          <HistoryListSkeleton count={3} />
        ) : reports.length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-12">{dict.historyModal.empty}</p>
        ) : (
          <ul role="list" className="space-y-3">
            {reports.map((report, index) => {
              const isConfirming = confirmDeleteId === report.id;

              return (
                <li
                  key={report.id}
                  style={{ '--stagger-idx': index } as React.CSSProperties}
                  className="p-4 rounded-xl bg-[#0C0E14] border border-slate-800 hover:border-slate-700/90 transition-colors space-y-3 gp-stagger-item"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center flex-wrap gap-2 font-mono text-slate-400 min-w-0">
                      <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" aria-hidden="true" />
                      <span className="tabular-nums">
                        {new Date(report.createdAt).toLocaleString(dateLocale)}
                      </span>
                      <span className="text-slate-600" aria-hidden="true">
                        •
                      </span>
                      <span className="text-slate-200 font-medium truncate max-w-[180px]">
                        {report.modelName}
                      </span>
                      <span className="text-slate-600" aria-hidden="true">
                        •
                      </span>
                      <span className="text-emerald-400 tabular-nums">
                        {t('historyModal.prsCount', { count: report.prCount })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopy(report.id, report.summaryText)}
                        title={dict.historyModal.copyTooltip}
                        aria-label={dict.historyModal.copyTooltip}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        {copiedId === report.id ? (
                          <Check className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                        ) : (
                          <Copy className="w-4 h-4" aria-hidden="true" />
                        )}
                      </button>

                      {!isConfirming ? (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(report.id)}
                          title={dict.historyModal.deleteTooltip}
                          aria-label={dict.historyModal.deleteTooltip}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleConfirmDelete(report.id)}
                            className="px-2.5 py-1 rounded-md text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors cursor-pointer"
                          >
                            {dict.historyModal.confirmDeleteBtn}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2.5 py-1 rounded-md text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
                          >
                            {dict.common.cancel}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg bg-[#11141C] border border-slate-800/80 text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed break-words">
                    {report.summaryText}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ModalDialog>
  );
}
