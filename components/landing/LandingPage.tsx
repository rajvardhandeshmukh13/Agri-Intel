// components/landing/LandingPage.tsx
// Public landing page for AgriIntel.
// Mobile-first, trustworthy, farmer-oriented presentation.
// Features a complete, ordered sequence of action buttons for all appropriate farmer actions.

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/context';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useAuth } from '@/lib/auth/context';
import { Card, CardContent } from '@/components/ui/card';
import { getActiveFarmContext, type ActiveFarmContext } from '@/lib/utils/farm-storage';

interface LandingPageProps {
  onEnterDemo?: () => void;
}

export function LandingPage({ onEnterDemo }: LandingPageProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const { enterDemoMode, isAuthenticated, user } = useAuth();

  const [activeFarm, setActiveFarm] = useState<ActiveFarmContext | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        return getActiveFarmContext();
      } catch {
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    function handleStorage() {
      try {
        setActiveFarm(getActiveFarmContext());
      } catch {
        // Fallback gracefully
      }
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleDemoClick = () => {
    enterDemoMode();
    if (onEnterDemo) {
      onEnterDemo();
    } else {
      router.push('/dashboard');
    }
  };

  const workflowSteps = [
    {
      num: '1',
      title: "Today's Action & Alerts",
      route: '/dashboard',
      desc: 'Check daily selling recommendation, heavy rain alerts, and prevailing APMC rates.',
      icon: '🌱',
      badge: 'Step 1',
    },
    {
      num: '2',
      title: 'Satellite Field Map & Health',
      route: '/farm',
      desc: 'Inspect high-res satellite imagery, NDVI crop vigor zones, and ML yield forecasts.',
      icon: '🗺️',
      badge: 'Step 2',
    },
    {
      num: '3',
      title: 'APMC Market Comparison',
      route: '/market',
      desc: 'Compare live Agmarknet mandi modal prices, arrival volumes, and price trends.',
      icon: '📊',
      badge: 'Step 3',
    },
    {
      num: '4',
      title: 'Sell Decision & Net Profit',
      route: '/sell',
      desc: 'Calculate optimal selling window (Now vs Wait) with transport cost deduction.',
      icon: '💰',
      badge: 'Step 4',
    },
    {
      num: '5',
      title: 'Multilingual Voice AI',
      route: '/ask',
      desc: 'Ask questions in Marathi, Hindi, or English and get instant answers with active farm data.',
      icon: '🎙️',
      badge: 'Step 5',
    },
  ];

  const features = [
    { title: t('landing.featHealthTitle'), desc: t('landing.featHealthDesc'), icon: '🌱', tag: 'NDVI Satellite' },
    { title: t('landing.featWeatherTitle'), desc: t('landing.featWeatherDesc'), icon: '🌦️', tag: 'Rain Alerts' },
    { title: t('landing.featYieldTitle'), desc: t('landing.featYieldDesc'), icon: '📊', tag: 'ML Prediction' },
    { title: t('landing.featMarketTitle'), desc: t('landing.featMarketDesc'), icon: '📈', tag: 'Agmarknet APMC' },
    { title: t('landing.featSellTitle'), desc: t('landing.featSellDesc'), icon: '💰', tag: 'Net Realization' },
    { title: t('landing.featAiTitle'), desc: t('landing.featAiDesc'), icon: '🎙️', tag: 'Voice in 3 Languages' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col max-w-md mx-auto relative px-4 pb-12">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border py-3 -mx-4 px-4 flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌾</span>
          <div>
            <h1 className="text-base font-bold text-primary leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>
              AgriIntel
            </h1>
            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">{t('common.tagline')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors"
            >
              {t('auth.login')}
            </Link>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="text-center py-4 space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-xs font-medium">
          <span>🇮🇳</span> Designed for Farmers in Maharashtra
        </div>

        <h2
          className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight"
          style={{ fontFamily: 'Outfit, sans-serif' }}
        >
          {t('landing.heroTitle')}
        </h2>

        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed px-1">
          {t('landing.heroSubtitle')}
        </p>
      </section>

      {/* ========================================================================= */}
      {/* COMPLETE ORDERED ACTION SEQUENCE — Primary interactive decision hub       */}
      {/* ========================================================================= */}
      <section className="space-y-3 my-2" aria-label="Farmer Action Center">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <span>⚡</span> Farmer Action Center
            </h3>
            <p className="text-xs text-muted-foreground">Select an action to proceed with your farm workflow</p>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            Ordered Flow
          </span>
        </div>

        <div className="space-y-2.5">
          {/* ACTION 1: Open Dashboard (Primary) */}
          <Card className="border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-card shadow-sm hover:border-primary transition-all">
            <CardContent className="p-3.5 space-y-2.5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Open Farmer Dashboard</h4>
                    <p className="text-[11px] text-muted-foreground">
                      {activeFarm?.village
                        ? `Active Farm: ${activeFarm.village}, ${activeFarm.district} · ${activeFarm.areaHectares} ha (${activeFarm.crop})`
                        : activeFarm
                        ? `Active Farm: ${activeFarm.district} · ${activeFarm.areaHectares} ha (${activeFarm.crop})`
                        : 'Patil Farm, Latur · 2.0 ha (Soybean)'}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Ready
                </span>
              </div>

              <Link
                href="/dashboard"
                id="action-open-dashboard"
                className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-xs transition-colors text-center flex items-center justify-center gap-1.5"
              >
                <span>🌾</span> Open Today&apos;s Dashboard →
              </Link>
            </CardContent>
          </Card>

          {/* ACTION 2: Set Up / Onboard Farm */}
          <Card className="border border-border bg-card hover:border-border/80 transition-all">
            <CardContent className="p-3.5 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Set Up / Change Your Farm</h4>
                    <p className="text-[11px] text-muted-foreground">
                      Pinpoint your field on satellite map, draw custom boundaries, and set crop.
                    </p>
                  </div>
                </div>
              </div>

              <Link
                href="/onboarding"
                id="hero-get-started"
                className="w-full py-2.5 px-4 rounded-xl border border-border bg-muted/40 hover:bg-muted text-foreground font-semibold text-xs transition-colors text-center flex items-center justify-center gap-1.5"
              >
                <span>🌱</span> Start Farm Setup / Change Field →
              </Link>
            </CardContent>
          </Card>

          {/* ACTION 3: Explore Demo Mode */}
          <Card className="border border-amber-200 bg-amber-50/40 hover:bg-amber-50/70 transition-all">
            <CardContent className="p-3.5 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-200 text-amber-900 text-xs font-bold flex items-center justify-center shrink-0">
                    3
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold text-amber-950">Explore Sample Demo Field</h4>
                    <p className="text-[11px] text-amber-800">
                      Instantly load Patil Farm in Latur with pre-computed Sentinel NDVI and APMC prices.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  Instant
                </span>
              </div>

              <button
                type="button"
                id="hero-explore-demo"
                onClick={handleDemoClick}
                className="w-full py-2.5 px-4 rounded-xl border border-amber-300 bg-amber-100/60 hover:bg-amber-200/60 text-amber-950 font-semibold text-xs transition-colors text-center flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>⚡</span> Load Sample Demo Farm →
              </button>
            </CardContent>
          </Card>

          {/* ACTION 4: Farmer Login / Account */}
          <Card className="border border-border bg-card hover:border-border/80 transition-all">
            <CardContent className="p-3.5 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center shrink-0">
                    4
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      {isAuthenticated ? `Signed in as ${user?.email || 'Farmer'}` : 'Farmer Login / Sign Up'}
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Secure cloud account to sync multiple field boundaries across mobile devices.
                    </p>
                  </div>
                </div>
              </div>

              <Link
                href="/login"
                id="action-login"
                className="w-full py-2.5 px-4 rounded-xl border border-border bg-card hover:bg-muted text-foreground font-semibold text-xs transition-colors text-center flex items-center justify-center gap-1.5"
              >
                <span>🔑</span> {isAuthenticated ? 'Switch Account / Profile →' : 'Sign In / Register →'}
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Core Mission Banner */}
      <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1 my-3">
        <p className="text-xs font-semibold text-primary uppercase tracking-wider">Our Promise</p>
        <p className="text-xs text-foreground font-medium italic">
          &ldquo;{t('landing.corePromise')}&rdquo;
        </p>
      </div>

      {/* ========================================================================= */}
      {/* 5-STEP GUIDED WORKFLOW (How the platform flows)                           */}
      {/* ========================================================================= */}
      <section className="py-4 space-y-3">
        <div>
          <h3 className="text-base font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>
            {t('landing.howItWorksTitle')}
          </h3>
          <p className="text-xs text-muted-foreground">How AgriIntel guides farmers through each stage</p>
        </div>

        <div className="space-y-2">
          {workflowSteps.map((st) => (
            <Link
              key={st.num}
              href={st.route}
              className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors block"
            >
              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                {st.num}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <span>{st.icon}</span> {st.title}
                  </p>
                  <span className="text-[10px] text-primary font-medium">View →</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{st.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Feature Cards Grid */}
      <section className="py-3 space-y-3">
        <div>
          <h3 className="text-base font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>
            {t('landing.featuresTitle')}
          </h3>
          <p className="text-xs text-muted-foreground">Built around actual agricultural decision moments</p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {features.map((f, i) => (
            <Card key={i} className="border border-border bg-card">
              <CardContent className="p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xl">{f.icon}</span>
                  <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-medium">
                    {f.tag}
                  </span>
                </div>
                <p className="text-xs font-semibold text-foreground leading-tight">{f.title}</p>
                <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How To Use AgriIntel Section */}
      <section className="py-3 space-y-2">
        <h3 className="text-base font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>
          {t('landing.howToUseTitle')}
        </h3>
        <Card className="border border-border bg-card/40">
          <CardContent className="p-3.5 space-y-2 text-xs text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground">1. Morning Check:</strong> Open AgriIntel every morning to see Today’s Action summary, rain alerts, and prevailing APMC rates.
            </p>
            <p>
              <strong className="text-foreground">2. Pre-Harvest:</strong> Check the Satellite view on &ldquo;My Farm&rdquo; to track field maturity and inspect stressed zones.
            </p>
            <p>
              <strong className="text-foreground">3. Mandi Selection:</strong> Use the &ldquo;Sell&rdquo; screen to calculate whether transporting to a neighboring mandi offers higher net profit after deducting transport costs.
            </p>
            <p>
              <strong className="text-foreground">4. Ask in Your Voice:</strong> Speak into the AI assistant in Marathi, Hindi, or English to get immediate clarity on decisions.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Farmer Disclaimer */}
      <footer className="mt-4 pt-4 border-t border-border text-center space-y-2 text-[10px] text-muted-foreground">
        <p className="leading-normal">
          {t('landing.disclaimer')}
        </p>
        <p className="font-semibold text-muted-foreground/80">
          AgriIntel &copy; {new Date().getFullYear()} · Transparent Decision Support for Farmers
        </p>
      </footer>
    </div>
  );
}
