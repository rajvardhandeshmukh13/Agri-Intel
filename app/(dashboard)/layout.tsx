// app/(dashboard)/layout.tsx
// Dashboard shell: top header + bottom tab navigation.
// Mobile-first layout with sticky bottom nav.
// Switches to clean layout on landing page (/) unconditionally.

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { isDemoMode } from '@/lib/utils/demo-mode';
import { useTranslation } from '@/lib/i18n/context';
import { useAuth } from '@/lib/auth/context';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { getActiveFarmContext } from '@/lib/utils/farm-storage';

type NavKey = 'home' | 'farm' | 'market' | 'sell' | 'ask';

const NAV_ITEMS: { href: string; key: NavKey; icon: string }[] = [
  { href: '/dashboard', key: 'home', icon: '🌱' },
  { href: '/farm', key: 'farm', icon: '🗺️' },
  { href: '/market', key: 'market', icon: '📊' },
  { href: '/sell', key: 'sell', icon: '💰' },
  { href: '/ask', key: 'ask', icon: '🎙️' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const envDemo = isDemoMode();
  const { t, locale } = useTranslation();
  const { user, isAuthenticated, isDemo, signOut, enterDemoMode } = useAuth();

  const isDemoActive = isDemo || envDemo;

  const [farmInfo, setFarmInfo] = useState<{ name: string; location: string }>(() => {
    if (typeof window !== 'undefined') {
      const ctx = getActiveFarmContext();
      const name = ctx.isCustomFarm ? (ctx.village ? `${ctx.village} Farm` : 'My Farm') : 'Patil Farm';
      const loc = `${ctx.district}, MH`;
      return { name, location: loc };
    }
    return { name: 'Patil Farm', location: 'Latur, MH' };
  });

  useEffect(() => {
    function updateFarm() {
      const ctx = getActiveFarmContext();
      const name = ctx.isCustomFarm ? (ctx.village ? `${ctx.village} Farm` : 'My Farm') : 'Patil Farm';
      const loc = `${ctx.district}, MH`;
      setFarmInfo({ name, location: loc });
    }
    updateFarm();
    window.addEventListener('storage', updateFarm);
    return () => window.removeEventListener('storage', updateFarm);
  }, []);

  // Root route (/) ALWAYS renders the clean Landing Page layout without bottom dashboard tabs
  if (pathname === '/') {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  // If on inner authenticated route but unauthenticated and not in demo mode
  if (!isAuthenticated && !isDemoActive) {
    return (
      <div className="flex flex-col min-h-screen max-w-md mx-auto relative bg-background px-4 py-12 items-center justify-center text-center space-y-4">
        <span className="text-4xl">🔒</span>
        <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>
          {t('auth.loginTitle')}
        </h2>
        <p className="text-xs text-muted-foreground max-w-xs">
          Please log in to view your field analytics, or explore instantly in demo mode.
        </p>
        <div className="flex flex-col gap-2 w-full max-w-xs pt-2">
          <Link
            href="/login"
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs text-center"
          >
            {t('auth.login')}
          </Link>
          <button
            type="button"
            onClick={() => {
              enterDemoMode();
              router.push('/dashboard');
            }}
            className="w-full py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground font-semibold text-xs cursor-pointer"
          >
            ⚡ {t('auth.exploreDemoBtn')}
          </button>
          <Link
            href="/"
            className="text-xs text-muted-foreground hover:text-foreground pt-1"
          >
            ← Back to Landing Page
          </Link>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto relative bg-background">
      {/* Demo banner */}
      {isDemoActive && (
        <div className="sticky top-0 z-50 bg-amber-50 border-b border-amber-200 px-3 py-1.5 text-center flex items-center justify-between">
          <p className="text-xs text-amber-700 font-medium leading-tight text-center flex-1">
            📋 {t('common.demoMode')}
          </p>
        </div>
      )}

      {/* Header */}
      <header
        className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between"
        style={{ top: isDemoActive ? '32px' : '0' }}
      >
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-1.5" title="Return to Landing Page">
            <span className="text-2xl">🌾</span>
            <div>
              <h1 className="text-base font-bold text-primary leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>
                AgriIntel
              </h1>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
                {farmInfo.name} · {farmInfo.location}
              </p>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href="/"
            className="text-xs font-semibold px-2 py-1 rounded-md border border-border bg-card hover:bg-muted text-foreground transition-colors flex items-center gap-1"
            title="Landing Page & Actions"
          >
            <span>🏠</span>
            <span className="hidden sm:inline text-[11px]">{locale === 'mr' ? 'मुख्यपृष्ठ' : locale === 'hi' ? 'होम' : 'Home'}</span>
          </Link>
          <LanguageSwitcher />
          <Link
            href="/onboarding"
            className="text-xs text-muted-foreground hover:text-primary transition-colors p-1"
            aria-label="Farm settings"
            title="Farm setup / Change field"
          >
            ⚙️
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="text-xs text-muted-foreground hover:text-red-600 transition-colors p-1 cursor-pointer"
            aria-label="Sign out"
            title={user?.isDemo ? 'Exit Demo Mode' : 'Sign out'}
          >
            🚪
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-safe">
        {children}
      </main>

      {/* Bottom tab navigation */}
      <nav
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 bg-background/95 backdrop-blur border-t border-border"
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-around px-1 py-2">
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
            const label = t(`nav.${item.key}`);
            return (
              <Link
                key={item.href}
                href={item.href}
                id={`nav-${item.key}`}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-[56px]',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="text-xl leading-none">{item.icon}</span>
                <span className={cn('text-[10px] font-medium leading-tight', isActive && 'font-semibold')}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
        {/* Safe area padding for iOS */}
        <div className="h-safe-bottom" style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </nav>
    </div>
  );
}
