// components/providers/ClientProviders.tsx
// Client-side providers wrapper.
// Wraps children with LanguageProvider (and future providers).

'use client';

import { LanguageProvider } from '@/lib/i18n/context';
import { AuthProvider } from '@/lib/auth/context';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <LanguageProvider>
        {children}
      </LanguageProvider>
    </AuthProvider>
  );
}

