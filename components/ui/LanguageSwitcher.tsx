// components/ui/LanguageSwitcher.tsx
// Compact language selector for the dashboard header.
// Renders EN / मराठी / हिन्दी pill buttons.

'use client';

import { cn } from '@/lib/utils/cn';
import { useTranslation, LANGUAGES } from '@/lib/i18n/context';

export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();

  return (
    <div className="flex items-center gap-0.5 bg-muted rounded-full p-0.5">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          id={`lang-switch-${lang.code}`}
          onClick={() => setLocale(lang.code)}
          className={cn(
            'px-2 py-0.5 rounded-full text-[10px] font-medium transition-all duration-200 leading-tight',
            locale === lang.code
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
          aria-label={`Switch to ${lang.labelEn}`}
          aria-pressed={locale === lang.code}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
