'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ModalDialog } from './ModalDialog';
import { useTranslation } from '../../i18n';
import {
  Search,
  RefreshCw,
  Sparkles,
  Globe,
  Cpu,
  History,
  GitBranch,
  Languages,
  CornerDownLeft,
} from 'lucide-react';

export interface CommandItem {
  id: string;
  label: string;
  group: string;
  shortcut?: string;
  disabled?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  canGenerate: boolean;
  onSyncRange: (range: 'today' | '24h' | '7d') => void;
  onGenerate: () => void;
  onSwitchEngine: (engine: 'GITHUB_MODELS' | 'WEB_LLM') => void;
  onOpenHistory: () => void;
  onOpenGitModal: () => void;
  onToggleLanguage: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  canGenerate,
  onSyncRange,
  onGenerate,
  onSwitchEngine,
  onOpenHistory,
  onOpenGitModal,
  onToggleLanguage,
}: CommandPaletteProps) {
  const { dict } = useTranslation();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [isOpen]);

  const commands = useMemo<CommandItem[]>(
    () => [
      {
        id: 'sync-today',
        label: dict.commandPalette.actions.syncToday,
        group: dict.commandPalette.groups.git,
        icon: RefreshCw,
        onSelect: () => onSyncRange('today'),
      },
      {
        id: 'sync-24h',
        label: dict.commandPalette.actions.sync24h,
        group: dict.commandPalette.groups.git,
        icon: RefreshCw,
        onSelect: () => onSyncRange('24h'),
      },
      {
        id: 'sync-7d',
        label: dict.commandPalette.actions.sync7d,
        group: dict.commandPalette.groups.git,
        icon: RefreshCw,
        onSelect: () => onSyncRange('7d'),
      },
      {
        id: 'generate-standup',
        label: dict.commandPalette.actions.generateStandup,
        group: dict.commandPalette.groups.ai,
        shortcut: '⌘↵',
        disabled: !canGenerate,
        icon: Sparkles,
        onSelect: onGenerate,
      },
      {
        id: 'engine-cloud',
        label: dict.commandPalette.actions.switchCloudAi,
        group: dict.commandPalette.groups.ai,
        icon: Globe,
        onSelect: () => onSwitchEngine('GITHUB_MODELS'),
      },
      {
        id: 'engine-webgpu',
        label: dict.commandPalette.actions.switchWebGpuAi,
        group: dict.commandPalette.groups.ai,
        icon: Cpu,
        onSelect: () => onSwitchEngine('WEB_LLM'),
      },
      {
        id: 'open-history',
        label: dict.commandPalette.actions.openHistory,
        group: dict.commandPalette.groups.navigation,
        icon: History,
        onSelect: onOpenHistory,
      },
      {
        id: 'open-git-modal',
        label: dict.commandPalette.actions.openGitModal,
        group: dict.commandPalette.groups.navigation,
        icon: GitBranch,
        onSelect: onOpenGitModal,
      },
      {
        id: 'toggle-locale',
        label: dict.commandPalette.actions.toggleLanguage,
        group: dict.commandPalette.groups.navigation,
        icon: Languages,
        onSelect: onToggleLanguage,
      },
    ],
    [
      dict,
      canGenerate,
      onSyncRange,
      onGenerate,
      onSwitchEngine,
      onOpenHistory,
      onOpenGitModal,
      onToggleLanguage,
    ],
  );

  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (cmd) => cmd.label.toLowerCase().includes(q) || cmd.group.toLowerCase().includes(q),
    );
  }, [commands, query]);

  const executeItem = (item: CommandItem) => {
    if (item.disabled) return;
    onClose();
    item.onSelect();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredCommands.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredCommands[activeIndex];
      if (target) {
        executeItem(target);
      }
    }
  };

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="command-palette-title"
      maxWidthClass="max-w-lg"
    >
      <h2 id="command-palette-title" className="sr-only">
        {dict.commandPalette.dialogTitle}
      </h2>

      {/* Search Input Bar */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800/80">
        <Search className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder={dict.commandPalette.placeholder}
          autoFocus
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-label={dict.commandPalette.placeholder}
          className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-400/70 outline-none"
        />
        <kbd className="px-2 py-0.5 rounded-md bg-[#0C0E14] border border-slate-800 text-xs font-mono text-slate-400">
          Esc
        </kbd>
      </div>

      {/* Command List */}
      <div className="max-h-80 overflow-y-auto gp-scroll-area p-2 space-y-1">
        {filteredCommands.length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-8">{dict.commandPalette.empty}</p>
        ) : (
          filteredCommands.map((item, idx) => {
            const Icon = item.icon;
            const isActive = idx === activeIndex;

            return (
              <button
                key={item.id}
                type="button"
                disabled={item.disabled}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => executeItem(item)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                  isActive ? 'bg-sky-500/10 text-slate-100' : 'text-slate-300 hover:bg-[#191E2A]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-md border flex items-center justify-center shrink-0 ${
                      isActive
                        ? 'bg-sky-500/15 border-sky-500/30 text-sky-400'
                        : 'bg-[#0C0E14] border-slate-800 text-slate-400'
                    }`}
                    aria-hidden="true"
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-100 truncate">{item.label}</div>
                    <div className="text-xs text-slate-400 truncate">{item.group}</div>
                  </div>
                </div>

                {item.shortcut ? (
                  <kbd className="px-2 py-0.5 rounded-md bg-[#0C0E14] border border-slate-800 text-xs font-mono text-slate-400 shrink-0">
                    {item.shortcut}
                  </kbd>
                ) : isActive && !item.disabled ? (
                  <CornerDownLeft
                    className="w-3.5 h-3.5 text-sky-400 shrink-0"
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            );
          })
        )}
      </div>

      {/* Footer Hint */}
      <div className="px-4 py-2.5 border-t border-slate-800/80 bg-[#0C0E14]/60 text-xs text-slate-400 flex items-center justify-between">
        <span>{dict.commandPalette.shortcutHint}</span>
      </div>
    </ModalDialog>
  );
}
