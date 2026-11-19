'use client';

import React, { useLayoutEffect, useRef, useCallback } from 'react';

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
  disabled?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  size = 'md',
  fullWidth = false,
  disabled = false,
  className = '',
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const buttonRefs = useRef<Map<T, HTMLButtonElement>>(new Map());
  const paddingClass = size === 'sm' ? 'px-2.5 py-1' : 'px-3 py-1.5';

  const syncIndicator = useCallback(
    (animate: boolean) => {
      const container = containerRef.current;
      const indicator = indicatorRef.current;
      const activeBtn = buttonRefs.current.get(value);
      if (!container || !indicator || !activeBtn) return;

      const x = activeBtn.offsetLeft;
      const width = activeBtn.offsetWidth;
      if (width <= 0) return;

      if (!animate) {
        indicator.style.transition = 'none';
      } else {
        indicator.style.transition = '';
      }

      indicator.style.width = `${width}px`;
      indicator.style.transform = `translate3d(${x}px, 0, 0)`;
      indicator.style.opacity = '1';
      container.dataset.measured = 'true';

      if (!animate) {
        // Flush layout before re-enabling transitions
        void indicator.offsetWidth;
        indicator.style.transition = '';
      }
    },
    [value],
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    const isMeasured = container?.dataset.measured === 'true';
    syncIndicator(isMeasured);
  }, [syncIndicator, options]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      syncIndicator(false);
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [syncIndicator]);

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      data-measured="false"
      className={`group/seg relative inline-flex items-center p-1 rounded-lg bg-[#152033] border border-slate-600/80 transition-opacity ${
        disabled ? 'opacity-55 pointer-events-none select-none' : ''
      } ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {/* Gliding Active Pill Indicator */}
      <span
        ref={indicatorRef}
        aria-hidden="true"
        className="pointer-events-none absolute top-1 bottom-1 left-0 rounded-md bg-white/[0.14] border border-white/[0.2] shadow-sm opacity-0 motion-safe:transition-[transform,width] motion-safe:duration-300"
        style={{
          transitionTimingFunction: 'var(--ease-spring)',
        }}
      />

      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            ref={(el) => {
              if (el) {
                buttonRefs.current.set(option.value, el);
              } else {
                buttonRefs.current.delete(option.value);
              }
            }}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={disabled}
            onClick={() => {
              if (!disabled) onChange(option.value);
            }}
            className={`relative z-10 ${paddingClass} ${
              fullWidth ? 'flex-1 justify-center' : ''
            } inline-flex items-center rounded-md text-xs font-medium transition-colors duration-150 ${
              disabled ? 'cursor-not-allowed' : 'cursor-pointer'
            } whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
              isActive
                ? 'text-white font-semibold group-data-[measured=false]/seg:bg-slate-700/80'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
