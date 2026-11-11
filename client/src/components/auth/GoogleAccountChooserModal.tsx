"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Plus,
  X,
  Loader2,
  ArrowRight,
  Database,
  RefreshCw,
} from "lucide-react";
import { api } from "../../lib/api";

export interface DevDbUser {
  id: string;
  username: string;
  email: string | null;
  role: string;
  avatarUrl?: string | null;
}

interface GoogleAccountChooserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAccount: (account: {
    username: string;
    email: string;
    name: string;
    googleId?: string;
  }) => Promise<void> | void;
  appName?: string;
}

export function GoogleAccountChooserModal({
  isOpen,
  onClose,
  onSelectAccount,
  appName = "Git-Pulse",
}: GoogleAccountChooserModalProps) {
  const [users, setUsers] = useState<DevDbUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customUsername, setCustomUsername] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [selectingUsername, setSelectingUsername] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);

    api.auth
      .getDevUsers()
      .then((data) => {
        if (isMounted && Array.isArray(data)) {
          setUsers(data);
        }
      })
      .catch(() => {
        if (isMounted) {
          setUsers([
            {
              id: "admin-fallback",
              username: "admin",
              email: "admin@wonderlab.local",
              role: "ADMIN",
            },
          ]);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelect = async (account: {
    username: string;
    email: string;
    name: string;
    googleId?: string;
  }) => {
    setSelectingUsername(account.username);
    try {
      await onSelectAccount(account);
    } finally {
      setSelectingUsername(null);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUsername.trim()) return;

    const uname = customUsername.trim();
    await handleSelect({
      username: uname,
      email: `${uname}@wonderlab.local`,
      name: uname,
      googleId: `google_${Date.now()}`,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-void/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md astral-card rounded-3xl p-6 border border-pulsar-cyan/30 shadow-[0_0_50px_rgba(6,182,212,0.2)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-600/30 to-emerald-600/30 border border-cyan-500/30 text-cyan-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide uppercase">
                Đăng nhập tài khoản Google
              </h3>
              <p className="text-xs text-slate-400">
                Ủy quyền & đồng bộ danh tính qua Central Gateway IAM
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="mb-4 p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-xs text-cyan-200/90 flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>Chọn một tài khoản để đăng nhập trực tiếp vào {appName}.</span>
        </div>

        {/* Account List */}
        <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-xs text-slate-400 gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Đang tải danh sách tài khoản Gateway...</span>
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-6">
              Không có tài khoản nào. Bạn có thể nhập tài khoản tùy chỉnh phía
              dưới.
            </p>
          ) : (
            users.map((u) => {
              const isSelected = selectingUsername === u.username;
              return (
                <button
                  key={u.id}
                  onClick={() =>
                    handleSelect({
                      username: u.username,
                      email: u.email || `${u.username}@wonderlab.local`,
                      name: u.username,
                      googleId: u.id,
                    })
                  }
                  disabled={Boolean(selectingUsername)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-void-subtle/80 hover:bg-void-surface border border-slate-700/60 hover:border-cyan-500/40 text-left transition-all group disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-950 to-indigo-950 border border-cyan-400/40 flex items-center justify-center text-xs font-bold text-cyan-200">
                      {u.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
                          {u.username}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold ${
                            u.role === "ADMIN"
                              ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {u.role}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        {u.email || `${u.username}@wonderlab.local`}
                      </p>
                    </div>
                  </div>

                  {isSelected ? (
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  ) : (
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Custom Username Input Toggle */}
        <div className="mt-4 pt-3 border-t border-slate-800">
          {!showCustomInput ? (
            <button
              onClick={() => setShowCustomInput(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-slate-400 hover:text-cyan-300 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Đăng nhập bằng tài khoản Google khác</span>
            </button>
          ) : (
            <form
              onSubmit={handleCustomSubmit}
              className="space-y-2 animate-in fade-in duration-150"
            >
              <label className="text-xs text-slate-300 font-medium">
                Nhập tên đăng nhập hoặc email Google:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customUsername}
                  onChange={(e) => setCustomUsername(e.target.value)}
                  placeholder="ví dụ: johndoe hoặc johndoe@gmail.com"
                  autoFocus
                  className="flex-1 px-3 py-2 rounded-xl bg-void-subtle border border-slate-700 text-xs text-white focus:border-cyan-400 focus:outline-none font-mono"
                />
                <button
                  type="submit"
                  disabled={
                    !customUsername.trim() || Boolean(selectingUsername)
                  }
                  className="px-4 py-2 rounded-xl text-xs font-bold text-void bg-cyan-400 hover:bg-cyan-300 transition-all disabled:opacity-40"
                >
                  Vào
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
