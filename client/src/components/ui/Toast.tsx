'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Info, AlertCircle, X } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { getTopOpenModalDialog, subscribeTopOpenModalDialog } from './ModalDialog';

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

interface DocumentWithAriaNotify extends Document {
  ariaNotify?: (text: string, options?: { priority?: 'normal' | 'high' }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function getToastPortalTarget(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const supportsPopover =
    typeof HTMLElement !== 'undefined' && Object.hasOwn(HTMLElement.prototype, 'popover');
  const topDialog = getTopOpenModalDialog();
  if (supportsPopover && topDialog && topDialog.isConnected && topDialog.open) {
    return topDialog;
  }
  return document.body;
}

function getServerPortalTarget(): HTMLElement | null {
  return null;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { dict } = useTranslation();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const regionRef = useRef<HTMLDivElement>(null);
  const portalTarget = useSyncExternalStore(
    subscribeTopOpenModalDialog,
    getToastPortalTarget,
    getServerPortalTarget,
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

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

      const announcement = description ? `${title}. ${description}` : title;
      if (typeof document !== 'undefined') {
        const doc = document as DocumentWithAriaNotify;
        if (typeof doc.ariaNotify === 'function') {
          doc.ariaNotify(announcement, {
            priority: variant === 'error' ? 'high' : 'normal',
          });
        } else {
          setLiveAnnouncement(announcement);
        }
      }

      const timer = setTimeout(() => {
        dismissToast(id);
      }, durationMs);
      timersRef.current.set(id, timer);
    },
    [dismissToast],
  );

  useLayoutEffect(() => {
    const el = regionRef.current;
    if (!el || toasts.length === 0) return;

    const supportsPopover =
      typeof HTMLElement !== 'undefined' && Object.hasOwn(HTMLElement.prototype, 'popover');
    if (!supportsPopover || typeof el.showPopover !== 'function') return;

    if (el.getAttribute('popover') !== 'manual') {
      el.setAttribute('popover', 'manual');
    }

    try {
      if (el.matches(':popover-open')) {
        el.hidePopover();
      }
      el.showPopover();
    } catch {
      // Ignore if element is temporarily disconnected during portal move
    }
  }, [toasts, portalTarget]);

  const value = useMemo<ToastContextValue>(
    () => ({ showToast, dismissToast }),
    [showToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      {portalTarget &&
        createPortal(
          <>
            <div aria-live="polite" aria-atomic="true" className="sr-only">
              {liveAnnouncement}
            </div>

            {toasts.length > 0 && (
              <div
                ref={regionRef}
                role="region"
                aria-label={dict.common.notificationsRegion}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                className="gp-toast-region flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] pointer-events-none"
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
                      className={`pointer-events-auto gp-toast-enter gp-glass-panel flex items-start gap-3 p-3.5 rounded-xl border ${borderClass}`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconClass}`} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-100 leading-snug">
                          {item.title}
                        </p>
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
                        className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-700/80 transition-colors cursor-pointer shrink-0"
                      >
                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>,
          portalTarget,
        )}
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
