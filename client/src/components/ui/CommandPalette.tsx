'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ModalDialog } from './ModalDialog';
import { useTranslation } from '../../i18n';
import { useAmbientMotionPreference } from '../../lib/motion-preference';
import {
  Search,
  RefreshCw,
  Sparkles,
  Globe,
  Plus,
  History,
  GitBranch,
  Languages,
  CornerDownLeft,
  Pause,
  Play,
  ListChecks,
  Send,
  KeyRound,
  Settings,
  SlidersHorizontal,
} from 'lucide-react';
import { AiConnectionSummary } from '../../types';

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
  hasSelectableCommits: boolean;
  showParabolAction: boolean;
  canSendToParabol: boolean;
  aiConnections: readonly AiConnectionSummary[];
  onSyncRange: (range: 'today' | '24h' | '7d') => void;
  onOpenCommitSelector: () => void;
  onGenerate: () => void;
  onSelectAiTool: (toolKey: string) => void;
  onOpenAddAiModal: () => void;
  onOpenParabolSubmit: () => void;
  onOpenAddReportPlatform: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onOpenReportSettings: () => void;
  onOpenGitModal: () => void;
  onToggleLanguage: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  canGenerate,
  hasSelectableCommits,
  showParabolAction,
  canSendToParabol,
  aiConnections,
  onSyncRange,
  onOpenCommitSelector,
  onGenerate,
  onSelectAiTool,
  onOpenAddAiModal,
  onOpenParabolSubmit,
  onOpenAddReportPlatform,
  onOpenHistory,
  onOpenSettings,
  onOpenReportSettings,
  onOpenGitModal,
  onToggleLanguage,
}: CommandPaletteProps) {
  const { dict } = useTranslation();
  const { isPaused: isMotionPaused, toggleMotion } = useAmbientMotionPreference();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [isOpen]);

  const commands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
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
        id: 'select-commits',
        label: dict.commandPalette.actions.selectCommits,
        group: dict.commandPalette.groups.git,
        disabled: !hasSelectableCommits,
        icon: ListChecks,
        onSelect: onOpenCommitSelector,
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
        onSelect: () => onSelectAiTool('builtin:GITHUB_MODELS'),
      },
      ...aiConnections.map((conn) => {
        const providerName =
          conn.provider === 'GROQ'
            ? dict.aiConsole.groqProviderLabel
            : dict.aiConsole.geminiProviderLabel;
        return {
          id: `engine-conn-${conn.id}`,
          label: `${providerName} (${conn.label})`,
          group: dict.commandPalette.groups.ai,
          icon: Sparkles,
          onSelect: () => onSelectAiTool(`conn:${conn.id}`),
        };
      }),
      {
        id: 'engine-add-ai',
        label: dict.commandPalette.actions.addGeminiAi,
        group: dict.commandPalette.groups.ai,
        icon: Plus,
        onSelect: onOpenAddAiModal,
      },
      ...(showParabolAction
        ? [
            {
              id: 'send-to-parabol',
              label: dict.commandPalette.actions.sendToParabol,
              group: dict.commandPalette.groups.reports,
              disabled: !canSendToParabol,
              icon: Send,
              onSelect: onOpenParabolSubmit,
            },
          ]
        : []),
      {
        id: 'connect-report-platform',
        label: dict.commandPalette.actions.connectReportPlatform,
        group: dict.commandPalette.groups.reports,
        icon: KeyRound,
        onSelect: onOpenAddReportPlatform,
      },
      {
        id: 'open-history',
        label: dict.commandPalette.actions.openHistory,
        group: dict.commandPalette.groups.reports,
        icon: History,
        onSelect: onOpenHistory,
      },
      {
        id: 'open-settings',
        label: dict.commandPalette.actions.openSettings,
        group: dict.commandPalette.groups.navigation,
        icon: Settings,
        onSelect: onOpenSettings,
      },
      {
        id: 'open-report-settings',
        label: dict.commandPalette.actions.openReportSettings,
        group: dict.commandPalette.groups.navigation,
        icon: SlidersHorizontal,
        onSelect: onOpenReportSettings,
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
      {
        id: 'toggle-motion',
        label: isMotionPaused
          ? dict.commandPalette.actions.toggleMotionPlay
          : dict.commandPalette.actions.toggleMotionPause,
        group: dict.commandPalette.groups.navigation,
        icon: isMotionPaused ? Play : Pause,
        onSelect: toggleMotion,
      },
    ];
    return items;
  }, [
    dict,
    canGenerate,
    hasSelectableCommits,
    showParabolAction,
    canSendToParabol,
    aiConnections,
    isMotionPaused,
    onSyncRange,
    onOpenCommitSelector,
    onGenerate,
    onSelectAiTool,
    onOpenAddAiModal,
    onOpenParabolSubmit,
    onOpenAddReportPlatform,
    onOpenHistory,
    onOpenSettings,
    onOpenReportSettings,
    onOpenGitModal,
    onToggleLanguage,
    toggleMotion,
  ]);

  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (cmd) => cmd.label.toLowerCase().includes(q) || cmd.group.toLowerCase().includes(q),
    );
  }, [commands, query]);

  const safeActiveIndex =
    filteredCommands.length > 0 ? Math.min(activeIndex, filteredCommands.length - 1) : 0;

  useEffect(() => {
    itemRefs.current[safeActiveIndex]?.scrollIntoView({ block: 'nearest' });
  }, [safeActiveIndex]);

  const executeItem = (item: CommandItem) => {
    if (item.disabled) return;
    onClose();
    item.onSelect();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredCommands.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((safeActiveIndex + 1) % filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((safeActiveIndex - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredCommands[safeActiveIndex];
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
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-700/80">
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
          className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-400 outline-none"
        />
        <kbd className="px-2 py-0.5 rounded-md bg-[#152033] border border-slate-600/80 text-xs font-mono text-slate-300">
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
            const isActive = idx === safeActiveIndex;

            return (
              <button
                key={item.id}
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                type="button"
                disabled={item.disabled}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => executeItem(item)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                  isActive ? 'bg-sky-500/15 text-slate-50' : 'text-slate-200 hover:bg-slate-700/60'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-md border flex items-center justify-center shrink-0 ${
                      isActive
                        ? 'bg-sky-500/20 border-sky-400/40 text-sky-300'
                        : 'bg-[#152033] border-slate-600/80 text-slate-300'
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
                  <kbd className="px-2 py-0.5 rounded-md bg-[#152033] border border-slate-600/80 text-xs font-mono text-slate-300 shrink-0">
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
      <div className="px-4 py-2.5 border-t border-slate-700/80 bg-[#152033]/85 text-xs text-slate-400 flex items-center justify-between">
        <span>{dict.commandPalette.shortcutHint}</span>
      </div>
    </ModalDialog>
  );
}
