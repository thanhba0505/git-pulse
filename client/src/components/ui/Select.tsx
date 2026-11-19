'use client';

import React, { useState, useRef, useEffect, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Plus } from 'lucide-react';
import { useFloatingPosition, usePopoverPresence } from '../../lib/use-floating-position';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
  badge?: string;
  badgeTone?: 'emerald' | 'amber' | 'rose' | 'sky';
  isAction?: boolean;
}

interface SelectProps<T extends string> {
  id?: string;
  label?: string;
  labelAction?: React.ReactNode;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  placeholder?: string;
  align?: 'left' | 'right';
  className?: string;
}

export function Select<T extends string>({
  id,
  label,
  labelAction,
  value,
  options,
  onChange,
  disabled = false,
  placeholder,
  align = 'left',
  className = '',
}: SelectProps<T>) {
  const generatedId = useId();
  const triggerId = id || `select-${generatedId}`;
  const labelId = `${triggerId}-label`;
  const valueId = `${triggerId}-value`;
  const listboxId = `${triggerId}-listbox`;

  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(() => {
    const idx = options.findIndex((o) => o.value === value);
    return idx >= 0 ? idx : 0;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  const { shouldRender, isClosing } = usePopoverPresence(isOpen, listboxRef);
  const floatingPos = useFloatingPosition({
    isOpen: shouldRender,
    anchorRef: triggerRef,
    align: align === 'right' ? 'end' : 'start',
    gap: 6,
    estimatedHeight: 260,
    matchWidth: true,
  });

  useEffect(() => {
    if (!isOpen) return;
    const targetEl = document.getElementById(`${listboxId}-opt-${highlightedIndex}`);
    targetEl?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, highlightedIndex, listboxId]);

  const selectedOption = options.find((opt) => opt.value === value);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  const openMenu = useCallback(() => {
    if (disabled) return;
    const currentIdx = options.findIndex((o) => o.value === value && !o.disabled);
    setHighlightedIndex(currentIdx >= 0 ? currentIdx : 0);
    setIsOpen(true);
  }, [disabled, options, value]);

  const handleSelectOption = useCallback(
    (option: SelectOption<T>) => {
      if (option.disabled) return;
      onChange(option.value);
      setIsOpen(false);
      triggerRef.current?.focus();
    },
    [onChange],
  );

  // Close on outside click (checking both trigger container and portaled listbox)
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !listboxRef.current?.contains(target)) {
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen, closeMenu]);

  const moveHighlight = (delta: 1 | -1) => {
    if (options.length === 0) return;
    let next = highlightedIndex;
    for (let step = 0; step < options.length; step++) {
      next = (next + delta + options.length) % options.length;
      if (!options[next]?.disabled) {
        setHighlightedIndex(next);
        return;
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!isOpen) {
          openMenu();
        } else {
          moveHighlight(1);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!isOpen) {
          openMenu();
        } else {
          moveHighlight(-1);
        }
        break;
      case 'Home':
        if (isOpen) {
          event.preventDefault();
          const firstEnabled = options.findIndex((o) => !o.disabled);
          if (firstEnabled >= 0) setHighlightedIndex(firstEnabled);
        }
        break;
      case 'End':
        if (isOpen) {
          event.preventDefault();
          for (let i = options.length - 1; i >= 0; i--) {
            if (!options[i]?.disabled) {
              setHighlightedIndex(i);
              break;
            }
          }
        }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!isOpen) {
          openMenu();
        } else {
          const activeOpt = options[highlightedIndex];
          if (activeOpt) {
            handleSelectOption(activeOpt);
          }
        }
        break;
      case 'Escape':
        if (isOpen) {
          event.preventDefault();
          closeMenu();
        }
        break;
      case 'Tab':
        if (isOpen) {
          closeMenu();
        }
        break;
    }
  };

  const activeDescendantId =
    isOpen && options[highlightedIndex] ? `${listboxId}-opt-${highlightedIndex}` : undefined;

  return (
    <div ref={containerRef} className={`relative w-full min-w-0 ${className}`}>
      {(label || labelAction) && (
        <div className="flex items-center justify-between gap-2 mb-1.5">
          {label && (
            <label id={labelId} htmlFor={triggerId} className="text-xs font-medium text-slate-300">
              {label}
            </label>
          )}
          {labelAction}
        </div>
      )}

      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-labelledby={label ? `${labelId} ${valueId}` : valueId}
        aria-activedescendant={activeDescendantId}
        disabled={disabled}
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        onKeyDown={handleKeyDown}
        className={`group flex items-center justify-between gap-2.5 w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#152033]/95 border text-left text-xs sm:text-sm shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] transition-[background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.99] motion-reduce:active:scale-100 outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          isOpen
            ? 'border-sky-400/80 bg-[#18263D] ring-2 ring-sky-500/25 shadow-[0_0_0_3px_rgba(14,165,233,0.12)] text-slate-50'
            : 'border-slate-600/85 hover:border-slate-500/90 hover:bg-[#19263D] text-slate-100 focus-visible:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-500/25'
        }`}
      >
        <span id={valueId} className="truncate font-medium">
          {selectedOption ? selectedOption.label : placeholder || ''}
        </span>
        <span
          className={`inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0 transition-colors duration-150 ${
            isOpen
              ? 'bg-sky-500/15 text-sky-300'
              : 'text-slate-400 group-hover:text-slate-200 group-hover:bg-white/[0.06]'
          }`}
          aria-hidden="true"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </span>
      </button>

      {shouldRender &&
        floatingPos &&
        createPortal(
          <ul
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            aria-labelledby={label ? labelId : valueId}
            data-state={isClosing ? 'closing' : 'open'}
            data-open-upward={floatingPos.openUpward ? 'true' : 'false'}
            style={floatingPos.style}
            className={`gp-menu-surface gp-menu-panel custom-scrollbar overflow-y-auto overscroll-contain rounded-xl py-1.5 px-1 space-y-0.5 ${
              floatingPos.openUpward ? 'origin-bottom' : 'origin-top'
            }`}
          >
            {options.map((option, idx) => {
              const isSelected = !option.isAction && option.value === value;
              const isHighlighted = idx === highlightedIndex;
              const badgeToneClass =
                option.badgeTone === 'rose'
                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                  : option.badgeTone === 'amber'
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : option.badgeTone === 'emerald'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-sky-500/15 text-sky-300 border-sky-500/30';

              return (
                <React.Fragment key={option.value}>
                  {option.isAction && idx > 0 && (
                    <li
                      role="separator"
                      aria-hidden="true"
                      className="my-1.5 mx-2 h-px bg-white/[0.1]"
                    />
                  )}
                  <li
                    id={`${listboxId}-opt-${idx}`}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled}
                    style={{ '--opt-idx': idx } as React.CSSProperties}
                    onMouseEnter={() => {
                      if (!option.disabled) setHighlightedIndex(idx);
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                    }}
                    onClick={() => handleSelectOption(option)}
                    className={`gp-menu-option-in relative flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg border transition-[background-color,border-color,color,transform] duration-150 select-none ${
                      option.disabled
                        ? 'opacity-45 cursor-not-allowed'
                        : 'cursor-pointer active:scale-[0.985] motion-reduce:active:scale-100'
                    } ${
                      option.isAction
                        ? isHighlighted
                          ? 'bg-sky-500/15 border-sky-400/35 text-sky-200'
                          : 'border-transparent text-sky-300 hover:bg-sky-500/12 hover:border-sky-400/25'
                        : isSelected
                          ? 'bg-gradient-to-r from-sky-500/[0.16] via-sky-500/[0.10] to-indigo-500/[0.06] border-sky-400/30 text-slate-50'
                          : isHighlighted
                            ? 'bg-white/[0.08] border-white/[0.10] text-slate-50'
                            : 'border-transparent text-slate-200 hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {isSelected && (
                        <span
                          aria-hidden="true"
                          className="w-[3px] self-stretch my-0.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.65)] shrink-0"
                        />
                      )}
                      {option.isAction && (
                        <span
                          aria-hidden="true"
                          className="w-6 h-6 rounded-md bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-300 shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`text-xs truncate ${
                              option.isAction
                                ? 'font-semibold text-sky-300'
                                : isSelected
                                  ? 'font-semibold text-sky-200'
                                  : 'font-medium text-slate-100'
                            }`}
                          >
                            {option.label}
                          </span>
                          {option.badge && (
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border shrink-0 ${badgeToneClass}`}
                            >
                              {option.badge}
                            </span>
                          )}
                        </div>
                        {option.description && (
                          <div
                            className={`text-xs mt-0.5 truncate ${
                              isSelected || isHighlighted ? 'text-slate-300/90' : 'text-slate-400'
                            }`}
                          >
                            {option.description}
                          </div>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <span
                        aria-hidden="true"
                        className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300 shrink-0"
                      >
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </li>
                </React.Fragment>
              );
            })}
          </ul>,
          floatingPos.portalTarget,
        )}
    </div>
  );
}
