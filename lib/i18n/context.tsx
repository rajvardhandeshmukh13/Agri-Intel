// lib/i18n/context.tsx
// Lightweight i18n system for AgriIntel.
// Loads translations from /locales/{lang}/common.json.
// Persists selected language in localStorage.

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

import enTranslations from '@/locales/en/common.json';
import mrTranslations from '@/locales/mr/common.json';
import hiTranslations from '@/locales/hi/common.json';

// ── Types ──────────────────────────────────────────────────

export type AppLocale = 'en' | 'mr' | 'hi';

export interface LanguageOption {
  code: AppLocale;
  label: string;      // native script label
  labelEn: string;    // English name
  speechCode: string; // BCP-47 for Web Speech API
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'EN', labelEn: 'English', speechCode: 'en-IN' },
  { code: 'mr', label: 'मराठी', labelEn: 'Marathi', speechCode: 'mr-IN' },
  { code: 'hi', label: 'हिन्दी', labelEn: 'Hindi', speechCode: 'hi-IN' },
];

const STORAGE_KEY = 'agriintel_lang';

// ── Translation data ───────────────────────────────────────

type TranslationData = Record<string, Record<string, string>>;

const TRANSLATIONS: Record<AppLocale, TranslationData> = {
  en: enTranslations as unknown as TranslationData,
  mr: mrTranslations as unknown as TranslationData,
  hi: hiTranslations as unknown as TranslationData,
};

// ── Context ────────────────────────────────────────────────

interface LanguageContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (key: string, replacements?: Record<string, string>) => string;
  speechCode: string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(() => {
    if (typeof window === 'undefined') return 'en';
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as AppLocale | null;
      if (stored && (stored === 'en' || stored === 'mr' || stored === 'hi')) {
        return stored;
      }
    } catch {
      // localStorage unavailable
    }
    return 'en';
  });

  const setLocale = useCallback((newLocale: AppLocale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('agriintel_lang_change', { detail: newLocale }));
    } catch {
      // localStorage unavailable
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        if (e.newValue === 'en' || e.newValue === 'mr' || e.newValue === 'hi') {
          setLocaleState(e.newValue as AppLocale);
        }
      }
    };
    const handleCustom = (e: Event) => {
      const ce = e as CustomEvent<AppLocale>;
      if (ce.detail && (ce.detail === 'en' || ce.detail === 'mr' || ce.detail === 'hi')) {
        setLocaleState(ce.detail);
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('agriintel_lang_change', handleCustom);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('agriintel_lang_change', handleCustom);
    };
  }, [locale]);

  /**
   * Translation function. Keys use dot notation: "nav.home", "sell.disclaimer", etc.
   * Falls back to English if key missing in current locale.
   * Falls back to the raw key if missing everywhere.
   */
  const t = useCallback((key: string, replacements?: Record<string, string>): string => {
    const parts = key.split('.');
    if (parts.length !== 2) return key;
    const [ns, k] = parts;

    let value: string | undefined;
    // Try current locale
    value = TRANSLATIONS[locale]?.[ns]?.[k];
    // Fallback to English
    if (!value) {
      value = TRANSLATIONS['en']?.[ns]?.[k];
    }
    // Final fallback — raw key
    if (!value) return key;

    // Apply template replacements: {name} → actual value
    if (replacements) {
      for (const [rk, rv] of Object.entries(replacements)) {
        value = value.replace(`{${rk}}`, rv);
      }
    }

    return value;
  }, [locale]);

  const speechCode = useMemo(
    () => LANGUAGES.find((l) => l.code === locale)?.speechCode ?? 'en-IN',
    [locale]
  );

  const contextValue = useMemo(
    () => ({ locale, setLocale, t, speechCode }),
    [locale, setLocale, t, speechCode]
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return ctx;
}
