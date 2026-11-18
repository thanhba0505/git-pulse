'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Info, AlertCircle, X } from 'lucide-react';
import { useTranslation } from '../../i18n';

export type ToastVariant = 'success' | 'info' | 'error';

export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

interface ToastItem extends Required<Pick<ToastInput, 'title' | 'variant'>> {
  id: string;
  description?: string;
}

interface ToastContextValue {
  showToast: (input: ToastInput) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { dict } = useTranslation();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const existingTimer = timersRef.current.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    ({ title, description, variant = 'success', durationMs = 3200 }: ToastInput) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, title, description, variant }]);

      const timer = setTimeout(() => {
        dismissToast(id);
      }, durationMs);
      timersRef.current.set(id, timer);
    },
    [dismissToast],
  );

  const value = useMemo<ToastContextValue>(
    () => ({ showToast, dismissToast }),
    [showToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] pointer-events-none"
      >
        {toasts.map((item) => {
          const isError = item.variant === 'error';
          const isInfo = item.variant === 'info';

          const Icon = isError ? AlertCircle : isInfo ? Info : CheckCircle2;
          const borderClass = isError
            ? 'border-rose-500/35'
            : isInfo
              ? 'border-sky-500/35'
              : 'border-emerald-500/35';
          const iconClass = isError
            ? 'text-rose-400'
            : isInfo
              ? 'text-sky-400'
              : 'text-emerald-400';

          return (
            <div
              key={item.id}
              role={isError ? 'alert' : 'status'}
              className={`pointer-events-auto gp-toast-enter flex items-start gap-3 p-3.5 rounded-xl bg-[#141821]/95 backdrop-blur-md border ${borderClass} shadow-[0_16px_40px_-10px_rgba(0,0,0,0.75)]`}
            >
              <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconClass}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-100 leading-snug">{item.title}</p>
                {item.description && (
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    {item.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(item.id)}
                aria-label={dict.common.close}
                className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: () => {},
      dismissToast: () => {},
    };
  }
  return ctx;
}
