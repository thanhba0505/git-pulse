'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, X, Loader2, ArrowRight } from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../i18n';
import { ModalDialog } from '../ui/ModalDialog';
import { Input } from '../ui/Input';

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
  appName = 'Git Pulse',
}: GoogleAccountChooserModalProps) {
  const { dict, t } = useTranslation();
  const [users, setUsers] = useState<DevDbUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customUsername, setCustomUsername] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [selectingUsername, setSelectingUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);
    setShowCustomInput(false);
    setCustomUsername('');

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
              id: 'admin-fallback',
              username: 'admin',
              email: 'admin@wonderlab.local',
              role: 'ADMIN',
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
      email: uname.includes('@') ? uname : `${uname}@wonderlab.local`,
      name: uname,
      googleId: `google_${Date.now()}`,
    });
  };

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="google-chooser-title"
      maxWidthClass="max-w-md"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-slate-700/80">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/25 text-sky-400 shrink-0"
            aria-hidden="true"
          >
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2
              id="google-chooser-title"
              className="text-base font-semibold text-slate-100 tracking-tight"
            >
              {dict.auth.chooser.title}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('auth.chooser.subtitle', { appName })}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label={dict.common.close}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700/80 transition-colors cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Body */}
      <div className="p-6 space-y-5">
        <div className="max-h-64 overflow-y-auto gp-scroll-area space-y-2 pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-xs text-slate-400 gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-sky-400" aria-hidden="true" />
              <span>{dict.auth.chooser.loading}</span>
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-8">{dict.auth.chooser.empty}</p>
          ) : (
            users.map((u) => {
              const isSelected = selectingUsername === u.username;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() =>
                    handleSelect({
                      username: u.username,
                      email: u.email || `${u.username}@wonderlab.local`,
                      name: u.username,
                      googleId: u.id,
                    })
                  }
                  disabled={Boolean(selectingUsername)}
                  className="w-full flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#152033] hover:bg-[#253349] border border-slate-600/80 hover:border-slate-500 text-left transition-colors group disabled:opacity-50 cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-semibold text-slate-100 shrink-0"
                      aria-hidden="true"
                    >
                      {u.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-slate-100 group-hover:text-sky-300 transition-colors block truncate">
                        {u.username}
                      </span>
                      <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                        {u.email || `${u.username}@wonderlab.local`}
                      </p>
                    </div>
                  </div>

                  {isSelected ? (
                    <Loader2
                      className="w-4 h-4 animate-spin text-sky-400 shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <ArrowRight
                      className="w-4 h-4 text-slate-400 group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all shrink-0"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Custom Username Entry */}
        <div className="pt-4 border-t border-slate-700/80">
          {!showCustomInput ? (
            <button
              type="button"
              onClick={() => setShowCustomInput(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-slate-400 hover:text-sky-400 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{dict.auth.chooser.otherAccountBtn}</span>
            </button>
          ) : (
            <form onSubmit={handleCustomSubmit} className="space-y-3 gp-fade-in">
              <div className="flex items-end gap-2">
                <Input
                  label={dict.auth.chooser.customLabel}
                  type="text"
                  value={customUsername}
                  onChange={(e) => setCustomUsername(e.target.value)}
                  placeholder={dict.auth.chooser.customPlaceholder}
                  autoFocus
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="font-mono"
                />
                <button
                  type="submit"
                  disabled={!customUsername.trim() || Boolean(selectingUsername)}
                  className="min-h-[42px] px-4 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-sky-500 hover:bg-sky-400 transition-colors disabled:opacity-45 cursor-pointer shrink-0"
                >
                  {dict.auth.chooser.continueBtn}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </ModalDialog>
  );
}
