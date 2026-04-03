'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { Locale, defaultLocale } from './config';
import ko from './messages/ko.json';
import en from './messages/en.json';

const messages: Record<Locale, Record<string, any>> = { ko, en };

interface LocaleContextType {
  locale: Locale;
  t: (key: string, params?: Record<string, string | number>) => string;
  currency: 'KRW' | 'USD';
}

const LocaleContext = createContext<LocaleContextType>({
  locale: defaultLocale,
  t: (key: string) => key,
  currency: 'KRW',
});

function detectLocale(): Locale {
  if (typeof window === 'undefined') return defaultLocale;

  // 1. 쿠키 우선
  const saved = document.cookie.match(/gijilai_locale=(\w+)/)?.[1];
  if (saved === 'ko' || saved === 'en') return saved;

  // 2. 브라우저 언어
  const browserLang = navigator.language.toLowerCase();
  return browserLang.startsWith('ko') ? 'ko' : 'en';
}

function getNestedValue(obj: Record<string, any>, path: string): string | undefined {
  const result = path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
  return typeof result === 'string' ? result : undefined;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(defaultLocale);

  useEffect(() => {
    setLocale(detectLocale());
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    let value = getNestedValue(messages[locale], key) ?? getNestedValue(messages[defaultLocale], key) ?? key;

    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        value = value.replace(`{${k}}`, String(v));
      });
    }

    return value;
  }, [locale]);

  const currency = locale === 'ko' ? 'KRW' as const : 'USD' as const;

  return (
    <LocaleContext.Provider value={{ locale, t, currency }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
