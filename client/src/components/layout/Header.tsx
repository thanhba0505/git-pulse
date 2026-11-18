'use client';

import React from 'react';
import { User, GitStatus } from '../../types';
import { useTranslation } from '../../i18n';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Activity, GitBranch, History, LogOut } from 'lucide-react';

interface HeaderProps {
  user: User | null;
  gitStatus: GitStatus;
  onOpenHistory: () => void;
  onOpenGitModal: () => void;
  onLogout: () => void;
}

export function Header({ user, gitStatus, onOpenHistory, onOpenGitModal, onLogout }: HeaderProps) {
  const { locale, setLocale, dict } = useTranslation();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/90 bg-[#090B10]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Brand Identity */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/25 text-sky-400 shrink-0"
            aria-hidden="true"
          >
            <Activity className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-bold text-base sm:text-lg tracking-tight text-slate-100 whitespace-nowrap">
              {dict.header.brand}
            </span>
            <span className="hidden lg:inline-block border-l border-slate-800 pl-3 text-xs text-slate-400 truncate">
              {dict.header.subtitle}
            </span>
          </div>
        </div>

        {/* Right Toolbar */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* UI Language Switcher */}
          <SegmentedControl
            value={locale}
            onChange={setLocale}
            ariaLabel={dict.header.languageSwitchLabel}
            size="sm"
            options={[
              { value: 'vi', label: 'VI' },
              { value: 'en', label: 'EN' },
            ]}
          />

          {/* History Action */}
          <button
            type="button"
            onClick={onOpenHistory}
            title={dict.header.historyTitle}
            aria-label={dict.header.historyTitle}
            className="inline-flex items-center gap-1.5 min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:text-white bg-[#11141C] hover:bg-[#161A24] border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
          >
            <History className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">{dict.header.history}</span>
          </button>

          {/* GitHub Connection Status */}
          {gitStatus.connected ? (
            <button
              type="button"
              onClick={onOpenGitModal}
              title={dict.header.manageGitTitle}
              aria-label={`${dict.header.manageGitTitle}: @${gitStatus.gitUsername || ''}`}
              className="inline-flex items-center gap-2 min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-mono text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/25 hover:border-emerald-500/40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" aria-hidden="true" />
              <span className="truncate max-w-[90px] sm:max-w-[140px]">
                @{gitStatus.gitUsername}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenGitModal}
              title={dict.header.connectGit}
              aria-label={dict.header.connectGit}
              className="inline-flex items-center gap-1.5 min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/25 hover:border-amber-500/40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
            >
              <GitBranch className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{dict.header.connectGit}</span>
            </button>
          )}

          {/* User Profile & Logout */}
          {user && (
            <div className="flex items-center gap-2 pl-2 sm:pl-2.5 border-l border-slate-800">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  className="w-8 h-8 rounded-full border border-slate-700 object-cover shrink-0"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-slate-200 shrink-0"
                  aria-hidden="true"
                >
                  {user.username.slice(0, 2).toUpperCase()}
                </div>
              )}

              <div className="hidden xl:block text-left text-xs min-w-0 max-w-[150px]">
                <p className="font-medium text-slate-200 truncate">{user.username}</p>
                {user.email && <p className="text-xs text-slate-400 truncate">{user.email}</p>}
              </div>

              <button
                type="button"
                onClick={onLogout}
                title={dict.header.logout}
                aria-label={dict.header.logout}
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
