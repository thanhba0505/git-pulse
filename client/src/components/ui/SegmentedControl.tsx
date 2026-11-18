'use client';

import React from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  size = 'md',
  fullWidth = false,
  className = '',
}: SegmentedControlProps<T>) {
  const paddingClass = size === 'sm' ? 'px-2.5 py-1' : 'px-3 py-1.5';

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex items-center p-1 rounded-lg bg-[#0C0E14] border border-slate-800 ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
    >
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(option.value)}
            className={`${paddingClass} ${
              fullWidth ? 'flex-1 justify-center' : ''
            } inline-flex items-center rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
              isActive
                ? 'bg-slate-800 text-slate-100 border border-slate-700/80 shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
