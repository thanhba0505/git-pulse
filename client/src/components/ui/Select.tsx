'use client';

import React, { useState, useRef, useEffect, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { useFloatingPosition } from '../../lib/use-floating-position';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface SelectProps<T extends string> {
  id?: string;
  label?: string;
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

  const floatingPos = useFloatingPosition({
    isOpen,
    anchorRef: triggerRef,
    align: align === 'right' ? 'end' : 'start',
    gap: 6,
    estimatedHeight: 240,
    matchWidth: true,
  });

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
      {label && (
        <label
          id={labelId}
          htmlFor={triggerId}
          className="block text-xs font-medium text-slate-300 mb-1.5"
        >
          {label}
        </label>
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
        className={`flex items-center justify-between gap-2.5 w-full min-h-[42px] px-3.5 py-2 rounded-lg bg-[#090B10]/45 backdrop-blur-md border text-left text-xs sm:text-sm transition-colors outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          isOpen
            ? 'border-sky-400/70 ring-2 ring-sky-500/20 text-slate-100'
            : 'border-white/[0.1] hover:border-white/[0.2] hover:bg-white/[0.06] text-slate-200 focus-visible:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-500/20'
        }`}
      >
        <span id={valueId} className="truncate font-medium">
          {selectedOption ? selectedOption.label : placeholder || ''}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-sky-400' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen &&
        floatingPos &&
        createPortal(
          <ul
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            aria-labelledby={label ? labelId : valueId}
            style={floatingPos.style}
            className="gp-glass-panel custom-scrollbar overflow-y-auto overscroll-contain rounded-xl p-1.5 gp-popover-in"
          >
            {options.map((option, idx) => {
              const isSelected = option.value === value;
              const isHighlighted = idx === highlightedIndex;

              return (
                <li
                  key={option.value}
                  id={`${listboxId}-opt-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled}
                  onMouseEnter={() => {
                    if (!option.disabled) setHighlightedIndex(idx);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                  }}
                  onClick={() => handleSelectOption(option)}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg transition-colors select-none ${
                    option.disabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    isSelected
                      ? 'bg-sky-500/10 text-slate-100'
                      : isHighlighted
                        ? 'bg-slate-800/90 text-slate-100'
                        : 'text-slate-300 hover:bg-slate-800/70'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-xs font-semibold truncate ${
                        isSelected ? 'text-sky-300' : 'text-slate-100'
                      }`}
                    >
                      {option.label}
                    </div>
                    {option.description && (
                      <div className="text-xs text-slate-400 mt-0.5 truncate">
                        {option.description}
                      </div>
                    )}
                  </div>

                  {isSelected && (
                    <Check className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
                  )}
                </li>
              );
            })}
          </ul>,
          floatingPos.portalTarget,
        )}
    </div>
  );
}
