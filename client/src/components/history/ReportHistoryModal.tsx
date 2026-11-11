"use client";

import React, { useEffect, useState } from "react";
import { ReportItem } from "../../types";
import { api } from "../../lib/api";
import { History, X, Copy, Trash2, Calendar, Check } from "lucide-react";
import { BorderBeam } from "../cosmic/BorderBeam";

interface ReportHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ReportHistoryModal({
  isOpen,
  onClose,
}: ReportHistoryModalProps) {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    api.reports
      .list()
      .then((data) => setReports(data))
      .catch(() => setReports([]))
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xóa bản báo cáo này?")) return;
    try {
      await api.reports.delete(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-void/85 backdrop-blur-md">
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col cosmic-modal-card rounded-2xl p-7 sm:p-8 border border-pulsar-cyan/30 shadow-[0_0_50px_rgba(6,182,212,0.15)] animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        {/* Kinetic Border Beam */}
        <BorderBeam colorFrom="#06b6d4" colorTo="#8b5cf6" duration={6} />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Lịch Sử Báo Cáo Standup
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Các bản tóm tắt đã lưu trên cơ sở dữ liệu riêng của bạn.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {isLoading ? (
            <p className="text-center text-xs text-slate-400 py-8">
              Đang tải lịch sử...
            </p>
          ) : reports.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-8">
              Chưa có bản báo cáo nào được lưu.
            </p>
          ) : (
            reports.map((report) => (
              <div
                key={report.id}
                className="p-4 sm:p-5 rounded-xl bg-void-subtle/80 border border-slate-800 hover:border-cyan-500/30 transition-all space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-mono text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{new Date(report.createdAt).toLocaleString()}</span>
                    <span>•</span>
                    <span className="text-cyan-300 font-semibold">
                      {report.modelName}
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className="text-emerald-300">
                      {report.prCount} PRs
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopy(report.id, report.summaryText)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-cyan-300 hover:bg-slate-800 transition-colors"
                      title="Sao chép nội dung"
                    >
                      {copiedId === report.id ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(report.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      title="Xóa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-void/60 text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {report.summaryText}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
