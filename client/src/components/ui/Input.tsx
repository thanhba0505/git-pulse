'use client';

import React, { useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  labelAction?: React.ReactNode;
  error?: string | null;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
  requiredMark?: boolean;
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    id,
    label,
    labelAction,
    error,
    hint,
    leftIcon,
    rightElement,
    requiredMark = false,
    containerClassName = '',
    className = '',
    ...rest
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id || `input-${generatedId}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`w-full min-w-0 ${containerClassName}`}>
      {(label || labelAction) && (
        <div className="flex items-center justify-between gap-2 mb-1.5">
          {label && (
            <label htmlFor={inputId} className="text-xs font-medium text-slate-300">
              {label}
              {requiredMark && (
                <span className="text-rose-400 ml-1" aria-hidden="true">
                  *
                </span>
              )}
            </label>
          )}
          {labelAction}
        </div>
      )}

      <div className="relative flex items-center">
        {leftIcon && (
          <div
            className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400"
            aria-hidden="true"
          >
            {leftIcon}
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`w-full min-h-[42px] py-2.5 rounded-lg bg-[#090B10]/50 backdrop-blur-md border text-sm text-slate-100 placeholder:text-slate-400/65 outline-none transition-colors ${
            leftIcon ? 'pl-10' : 'pl-3.5'
          } ${rightElement ? 'pr-11' : 'pr-3.5'} ${
            error
              ? 'border-rose-500/80 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20'
              : 'border-white/[0.1] hover:border-white/[0.18] focus:border-sky-400/80 focus:bg-[#090B10]/70 focus:ring-2 focus:ring-sky-500/20'
          } ${className}`}
          {...rest}
        />

        {rightElement && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">{rightElement}</div>
        )}
      </div>

      {error && (
        <p id={errorId} role="alert" className="text-xs text-rose-400 mt-1.5 leading-relaxed">
          {error}
        </p>
      )}

      {hint && !error && (
        <p id={hintId} className="text-xs text-slate-400 mt-1.5 leading-relaxed">
          {hint}
        </p>
      )}
    </div>
  );
});
