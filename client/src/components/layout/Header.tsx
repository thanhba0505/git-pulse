'use client';

import React from 'react';
import { User, GitStatus } from '../../types';
import { useTranslation } from '../../i18n';
import { DropdownMenu } from '../ui/DropdownMenu';
import {
  Activity,
  Check,
  ChevronDown,
  ChevronsUpDown,
  GitBranch,
  History,
  LogOut,
  Plus,
  Search,
  Settings,
  User as UserIcon,
} from 'lucide-react';

interface HeaderProps {
  user: User | null;
  gitStatus: GitStatus;
  onSelectGitAccount: (accountId: string) => void;
  onOpenAddGitAccount: () => void;
  onOpenCommandPalette: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export function Header({
  user,
  gitStatus,
  onSelectGitAccount,
  onOpenAddGitAccount,
  onOpenCommandPalette,
  onOpenHistory,
  onOpenSettings,
  onLogout,
}: HeaderProps) {
  const { dict } = useTranslation();
  const accounts = gitStatus.accounts ?? [];
  const hasConnectedAccounts = Boolean(gitStatus.connected && accounts.length > 0);

  return (
    <header className="relative shrink-0 z-40 w-full border-b border-white/[0.12] shadow-[0_8px_32px_rgba(2,6,23,0.32)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[#0F172A]/85 backdrop-blur-xl"
      />
      <div className="relative max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-3">
        {/* Left: Brand + Contextual GitHub Account Selector */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-400/30 text-sky-400 shrink-0 shadow-[0_0_16px_rgba(56,189,248,0.16)]"
              aria-hidden="true"
            >
              <Activity className="w-4 h-4" />
            </div>
            <span className="hidden sm:inline font-bold text-base sm:text-lg tracking-tight text-slate-100 whitespace-nowrap">
              {dict.header.brand}
            </span>
          </div>

          <span className="text-slate-400/70 font-light select-none shrink-0" aria-hidden="true">
            /
          </span>

          {/* Multi-Account GitHub Selector OR Connect CTA */}
          {!hasConnectedAccounts ? (
            <button
              type="button"
              onClick={onOpenAddGitAccount}
              title={dict.header.connectGit}
              className="inline-flex items-center gap-2 min-h-[34px] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-amber-300 bg-amber-500/[0.1] hover:bg-amber-500/[0.18] border border-amber-400/25 hover:border-amber-400/40 backdrop-blur-md transition-colors cursor-pointer min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
            >
              <GitBranch className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
              <span className="truncate max-w-[140px] sm:max-w-none">
                {dict.header.gitConnectPrompt}
              </span>
            </button>
          ) : (
            <DropdownMenu
              align="start"
              widthClass="w-64"
              trigger={({ id, isOpen, onClick, onKeyDown, ariaProps }) => (
                <button
                  id={id}
                  type="button"
                  onClick={onClick}
                  onKeyDown={onKeyDown}
                  aria-label={dict.header.gitSwitcherLabel}
                  className={`inline-flex items-center gap-2 min-h-[34px] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium border backdrop-blur-md transition-colors cursor-pointer max-w-[175px] sm:max-w-[240px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 ${
                    isOpen
                      ? 'bg-white/[0.14] border-sky-400/50 text-white'
                      : 'bg-white/[0.07] hover:bg-white/[0.11] border-white/[0.14] text-slate-100'
                  }`}
                  {...ariaProps}
                >
                  {gitStatus.gitAvatar ? (
                    <img
                      src={gitStatus.gitAvatar}
                      alt={gitStatus.gitUsername || 'GitHub'}
                      className="w-4 h-4 rounded-full border border-white/20 object-cover shrink-0"
                    />
                  ) : (
                    <span
                      className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <span className="font-mono truncate">@{gitStatus.gitUsername}</span>
                  <ChevronsUpDown
                    className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-auto"
                    aria-hidden="true"
                  />
                </button>
              )}
            >
              {({ close }) => (
                <div className="space-y-1">
                  <div className="px-2.5 py-1.5 text-xs font-mono uppercase tracking-wider text-slate-400">
                    {dict.header.gitAccountsHeading}
                  </div>

                  {accounts.map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        close();
                        if (!account.isActive) {
                          onSelectGitAccount(account.id);
                        }
                      }}
                      className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                        account.isActive
                          ? 'bg-sky-500/15 text-sky-200 font-medium'
                          : 'text-slate-200 hover:bg-white/[0.08]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {account.gitAvatar ? (
                          <img
                            src={account.gitAvatar}
                            alt={account.gitUsername}
                            className="w-5 h-5 rounded-full border border-white/15 object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-white/[0.08] flex items-center justify-center text-xs font-mono text-slate-300 shrink-0">
                            {account.gitUsername.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <span className="font-mono truncate">@{account.gitUsername}</span>
                      </div>

                      {account.isActive && (
                        <Check
                          className="w-3.5 h-3.5 text-emerald-400 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  ))}

                  <hr className="border-white/[0.12] my-1" />

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      close();
                      onOpenAddGitAccount();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-sky-300 hover:text-sky-200 hover:bg-sky-500/15 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{dict.header.addGitAccount}</span>
                  </button>
                </div>
              )}
            </DropdownMenu>
          )}
        </div>

        {/* Right: Quick Command Palette (when connected) + User Icon Dropdown */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {hasConnectedAccounts && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              title={dict.header.commandPaletteTooltip}
              aria-label={dict.header.commandPaletteTooltip}
              className="hidden md:inline-flex items-center gap-2 min-h-[36px] px-3 py-1.5 rounded-lg text-xs text-slate-200 hover:text-white bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.14] hover:border-white/[0.22] backdrop-blur-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
            >
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
              <span>{dict.header.commandPaletteBtn}</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] border border-white/[0.14] text-xs font-mono text-slate-200">
                ⌘K
              </kbd>
            </button>
          )}

          {user && (
            <DropdownMenu
              align="end"
              widthClass="w-60"
              trigger={({ id, isOpen, onClick, onKeyDown, ariaProps }) => (
                <button
                  id={id}
                  type="button"
                  onClick={onClick}
                  onKeyDown={onKeyDown}
                  aria-label={dict.header.userMenuLabel}
                  className={`inline-flex items-center gap-2 min-h-[36px] p-1 sm:pr-2.5 rounded-full sm:rounded-xl border backdrop-blur-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 ${
                    isOpen
                      ? 'bg-white/[0.14] border-sky-400/50 text-white'
                      : 'bg-white/[0.07] hover:bg-white/[0.11] border-white/[0.14] text-slate-100'
                  }`}
                  {...ariaProps}
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.username}
                      className="w-7 h-7 rounded-full border border-white/15 object-cover shrink-0"
                    />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-full bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-300 shrink-0"
                      aria-hidden="true"
                    >
                      <UserIcon className="w-3.5 h-3.5" />
                    </div>
                  )}
                  <span className="hidden sm:inline text-xs font-medium text-slate-200 max-w-[110px] truncate">
                    {user.username}
                  </span>
                  <ChevronDown
                    className={`hidden sm:block w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>
              )}
            >
              {({ close }) => (
                <div className="space-y-1">
                  {/* User Identity Summary */}
                  <div className="px-2.5 py-2">
                    <p className="text-xs font-semibold text-slate-100 truncate">{user.username}</p>
                    {user.email && (
                      <p className="text-xs text-slate-400 truncate mt-0.5">{user.email}</p>
                    )}
                  </div>

                  <hr className="border-white/[0.12] my-1" />

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      close();
                      onOpenHistory();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-200 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                    <span>{dict.header.history}</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      close();
                      onOpenSettings();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-200 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                    <span>{dict.header.settings}</span>
                  </button>

                  <hr className="border-white/[0.12] my-1" />

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      close();
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-rose-300 hover:text-rose-200 hover:bg-rose-500/15 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{dict.header.logout}</span>
                  </button>
                </div>
              )}
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
