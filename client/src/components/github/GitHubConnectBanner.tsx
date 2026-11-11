"use client";

import React, { useState } from "react";
import { GitStatus } from "../../types";
import {
  GitBranch,
  Key,
  ShieldCheck,
  ExternalLink,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface GitHubConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: GitStatus;
  onSavePat: (token: string) => Promise<void>;
  onDisconnect: () => Promise<void>;
}

export function GitHubConnectModal({
  isOpen,
  onClose,
  status,
  onSavePat,
  onDisconnect,
}: GitHubConnectModalProps) {
  const [patInput, setPatInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patInput.trim()) {
      setError("Vui lòng nhập GitHub Personal Access Token.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await onSavePat(patInput.trim());
      setPatInput("");
      onClose();
    } catch (err) {
      setError((err as Error).message || "Không thể lưu token GitHub.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Bạn có chắc chắn muốn ngắt kết nối tài khoản GitHub này?"))
      return;
    setIsLoading(true);
    try {
      await onDisconnect();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-void/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg astral-card rounded-2xl p-6 border border-pulsar-cyan/30 shadow-[0_0_50px_rgba(6,182,212,0.15)] animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-600/30 to-indigo-600/30 border border-cyan-500/30 text-cyan-300">
            <GitBranch className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              {status.connected
                ? "Quản lý Kết nối GitHub"
                : "Cổng Kết Nối Quỹ Đạo GitHub"}
            </h3>
            <p className="text-xs text-slate-400">
              Cho phép Git-Pulse quét commit, PR trong ngày để tổng hợp Standup.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {status.connected ? (
          /* Connected State */
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-void-subtle/80 border border-emerald-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {status.gitAvatar && (
                  <img
                    src={status.gitAvatar}
                    alt={status.gitUsername}
                    className="w-12 h-12 rounded-full border border-emerald-400/40"
                  />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">
                      @{status.gitUsername}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {status.authType || "PAT"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Đồng bộ lần cuối:{" "}
                    {status.lastSyncAt
                      ? new Date(status.lastSyncAt).toLocaleTimeString()
                      : "Chưa có"}
                  </p>
                </div>
              </div>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                Token được mã hóa an toàn AES-256-GCM.
              </p>
              <button
                onClick={handleDisconnect}
                disabled={isLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:text-white bg-rose-950/30 hover:bg-rose-900/60 border border-rose-500/30 transition-all"
              >
                {isLoading ? "Đang xử lý..." : "Ngắt kết nối"}
              </button>
            </div>
          </div>
        ) : (
          /* Not Connected: Form to enter PAT */
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-cyan-400" />
                  GitHub Personal Access Token (PAT)
                </label>
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo,read:user&description=GitPulse+Standup+Scanner"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                >
                  Tạo Token mới trên GitHub
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <input
                type="password"
                value={patInput}
                onChange={(e) => setPatInput(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx hoặc github_pat_..."
                className="w-full px-4 py-2.5 rounded-xl bg-void-subtle/90 border border-slate-700 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-sm text-white placeholder-slate-500 outline-none transition-all font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1.5">
                Chỉ cần quyền <code className="text-cyan-300">repo</code> (với
                repo private) hoặc quyền đọc công khai. Token được mã hóa
                AES-256 trước khi lưu vào DB.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700 transition-colors"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-5 py-2 rounded-xl text-xs font-bold text-void bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] disabled:opacity-50"
              >
                {isLoading ? "Đang xác thực..." : "Lưu & Kích hoạt Git"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
