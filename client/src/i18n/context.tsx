'use client';

import * as React from 'react';
import { Locale, TranslationDictionary, DEFAULT_LOCALE, SUPPORTED_LOCALES } from './types';
import { vi } from './locales/vi';
import { en } from './locales/en';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (path: string, params?: Record<string, string | number>) => string;
  dict: TranslationDictionary;
}

const dictionaries: Record<Locale, TranslationDictionary> = {
  vi,
  en,
};

const I18nContext = React.createContext<I18nContextValue | null>(null);

const COOKIE_NAME = 'NEXT_LOCALE';
const STORAGE_KEY = 'git_pulse_locale';

function parseCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(^|;\\s*)(${name})=([^;]*)`));
  return match ? decodeURIComponent(match[3] || '') : null;
}

function resolveInitialLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;

  const cookieVal = parseCookie(COOKIE_NAME);
  if (cookieVal === 'en' || cookieVal === 'vi') {
    return cookieVal;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'vi') {
      return stored;
    }
  } catch {
    // Ignore localStorage access restrictions
  }

  try {
    const navLang = window.navigator.language?.toLowerCase() || '';
    if (navLang.startsWith('en')) {
      return 'en';
    }
  } catch {
    // Ignore navigator access restrictions
  }

  return DEFAULT_LOCALE;
}

export function formatMessage(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  let result = template;
  for (const [key, val] of Object.entries(params)) {
    result = result.replaceAll(`{${key}}`, String(val));
  }
  return result;
}

export interface I18nProviderProps {
  children: React.ReactNode;
  initialLocale?: Locale;
}

export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
  const [locale, setLocaleState] = React.useState<Locale>(initialLocale || DEFAULT_LOCALE);

  React.useEffect(() => {
    const detected = initialLocale || resolveInitialLocale();
    setLocaleState(detected);
    document.documentElement.lang = detected;
  }, [initialLocale]);

  const setLocale = React.useCallback((newLocale: Locale) => {
    if (!SUPPORTED_LOCALES.includes(newLocale)) return;

    setLocaleState(newLocale);

    if (typeof document !== 'undefined') {
      document.cookie = `${COOKIE_NAME}=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
      document.documentElement.lang = newLocale;
    }

    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, newLocale);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const dict = dictionaries[locale] || dictionaries[DEFAULT_LOCALE];

  const t = React.useCallback(
    (path: string, params?: Record<string, string | number>): string => {
      const segments = path.split('.');
      let current: unknown = dict;

      for (const segment of segments) {
        if (
          current &&
          typeof current === 'object' &&
          segment in (current as Record<string, unknown>)
        ) {
          current = (current as Record<string, unknown>)[segment];
        } else {
          let fallback: unknown = dictionaries[DEFAULT_LOCALE];
          for (const fbSegment of segments) {
            if (
              fallback &&
              typeof fallback === 'object' &&
              fbSegment in (fallback as Record<string, unknown>)
            ) {
              fallback = (fallback as Record<string, unknown>)[fbSegment];
            } else {
              return path;
            }
          }
          current = fallback;
          break;
        }
      }

      if (typeof current !== 'string') {
        return path;
      }

      return formatMessage(current, params);
    },
    [dict],
  );

  const value = React.useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      dict,
    }),
    [locale, setLocale, t, dict],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const context = React.useContext(I18nContext);
  if (!context) {
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: (path: string) => path,
      dict: dictionaries[DEFAULT_LOCALE],
    };
  }
  return context;
}

export function useLocale(): { locale: Locale; setLocale: (locale: Locale) => void } {
  const { locale, setLocale } = useTranslation();
  return { locale, setLocale };
}
