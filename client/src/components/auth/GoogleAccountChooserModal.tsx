"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Plus,
  X,
  Loader2,
  ArrowRight,
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
  appName = "Git Pulse",
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md cosmic-modal-card rounded-3xl p-7 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/[0.08] pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 text-cyan-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide uppercase">
                Tài khoản Google
              </h3>
              <p className="text-xs text-slate-400">
                Đăng nhập vào {appName} qua Central Gateway
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Account List */}
        <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-xs text-slate-400 gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Đang tải danh sách tài khoản...</span>
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-8">
              Không có tài khoản nào có sẵn.
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
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] hover:border-cyan-500/30 text-left transition-all group disabled:opacity-50 cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-950 to-indigo-950 border border-cyan-400/30 flex items-center justify-center text-xs font-bold text-cyan-200">
                      {u.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
                        {u.username}
                      </span>
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
        <div className="mt-5 pt-4 border-t border-white/[0.08]">
          {!showCustomInput ? (
            <button
              onClick={() => setShowCustomInput(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-slate-400 hover:text-cyan-300 transition cursor-pointer"
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
                Tên đăng nhập hoặc email Google:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customUsername}
                  onChange={(e) => setCustomUsername(e.target.value)}
                  placeholder="ví dụ: johndoe hoặc johndoe@gmail.com"
                  autoFocus
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white focus:border-cyan-400 focus:outline-none font-mono"
                />
                <button
                  type="submit"
                  disabled={
                    !customUsername.trim() || Boolean(selectingUsername)
                  }
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#030712] bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 transition-all disabled:opacity-40 cursor-pointer"
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
