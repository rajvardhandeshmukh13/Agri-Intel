// app/(dashboard)/sell/page.tsx
// Screen 4: Sell — THE CORE DECISION SCREEN
// Dynamically connected to /api/recommendations and the selling decision engine.
// Displays sell scenarios, net realization breakdown, and "Why?" reasoning based on farm context.
// Fully localized across English, Marathi, and Hindi.

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import { formatINR } from '@/lib/utils/format';
import {
  getActiveFarmContext,
  formatCropName,
  type ActiveFarmContext,
} from '@/lib/utils/farm-storage';
import { useTranslation, type AppLocale } from '@/lib/i18n/context';
import { localizeReason } from '@/lib/utils/format-reason';
import type { SellRecommendation, SellWindow, Scenario } from '@/lib/types/recommendation';

function RiskBadge({ level, locale }: { level: string; locale: AppLocale }) {
  const map = {
    low: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    moderate: 'bg-amber-100 text-amber-700 border-amber-300',
    high: 'bg-red-100 text-red-700 border-red-300',
  };
  const labels: Record<string, Record<AppLocale, string>> = {
    low: { en: 'Low Risk', mr: 'कमी जोखीम', hi: 'कम जोखिम' },
    moderate: { en: 'Moderate Risk', mr: 'मध्यम जोखीम', hi: 'मध्यम जोखिम' },
    high: { en: 'Higher Risk', mr: 'अधिक जोखीम', hi: 'अधिक जोखिम' },
  };
  const label = labels[level]?.[locale] ?? labels.moderate[locale];
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${map[level as keyof typeof map] ?? map.moderate}`}>
      {label}
    </span>
  );
}

function ConfidenceBadge({ level, locale }: { level: string; locale: AppLocale }) {
  const map = {
    high: 'bg-blue-100 text-blue-700',
    moderate: 'bg-slate-100 text-slate-600',
    low: 'bg-orange-100 text-orange-700',
  };
  const text =
    locale === 'mr'
      ? level === 'high' ? 'उच्च विश्वासार्हता' : level === 'low' ? 'कमी विश्वासार्हता' : 'मध्यम विश्वासार्हता'
      : locale === 'hi'
      ? level === 'high' ? 'उच्च विश्वसनीयता' : level === 'low' ? 'कम विश्वसनीयता' : 'मध्यम विश्वसनीयता'
      : `${level.charAt(0).toUpperCase() + level.slice(1)} confidence`;

  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[level as keyof typeof map] ?? map.moderate}`}>
      {text}
    </span>
  );
}

function NetRealizationRow({
  label,
  value,
  bold,
  negative,
}: {
  label: string;
  value: string;
  bold?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex justify-between items-center py-1.5',
        bold && 'font-semibold border-t border-border pt-2 mt-1'
      )}
    >
      <span className={cn('text-sm', bold ? 'text-foreground font-bold' : 'text-muted-foreground')}>
        {label}
      </span>
      <span
        className={cn(
          'text-sm font-medium',
          negative ? 'text-red-600' : bold ? 'text-primary text-base font-bold' : 'text-foreground'
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Deterministic fallback recommendation when offline or API is unavailable.
 * Never crashes and scales properly with farm harvest and input costs.
 */
function buildFallbackRecommendation(farm: ActiveFarmContext): SellRecommendation {
  const harvestQ = farm.totalHarvestQ || 68.25;
  const inputCost = farm.inputCostTotal || 63000;
  const mandi = farm.nearestMandi || 'Latur';

  const basePrice = 4280;
  const pNow = basePrice;
  const p7d = Math.round(basePrice * 1.04);
  const p14d = Math.round(basePrice * 1.065);
  const transRate = 18;

  const scenarios: [Scenario, Scenario, Scenario] = [
    {
      window: 'now',
      label: 'Sell Now',
      mandi,
      estimatedModalPricePerQuintal: pNow,
      estimatedGross: Math.round(harvestQ * pNow),
      transportCostTotal: Math.round(harvestQ * transRate),
      sellingCostTotal: Math.round(harvestQ * pNow * 0.02),
      farmCostTotal: inputCost,
      estimatedNet: Math.round(harvestQ * pNow) - Math.round(harvestQ * transRate) - Math.round(harvestQ * pNow * 0.02),
      riskLevel: 'low',
      confidence: 'high',
      weatherRisk: 'low',
      priceRiskPct: 2.1,
    },
    {
      window: '7_days',
      label: 'Wait ~7 Days',
      mandi,
      estimatedModalPricePerQuintal: p7d,
      estimatedGross: Math.round(harvestQ * p7d),
      transportCostTotal: Math.round(harvestQ * transRate),
      sellingCostTotal: Math.round(harvestQ * p7d * 0.02),
      farmCostTotal: inputCost,
      estimatedNet: Math.round(harvestQ * p7d) - Math.round(harvestQ * transRate) - Math.round(harvestQ * p7d * 0.02),
      riskLevel: 'moderate',
      confidence: 'high',
      weatherRisk: 'low',
      priceRiskPct: 4.5,
    },
    {
      window: '14_days',
      label: 'Wait ~14 Days',
      mandi,
      estimatedModalPricePerQuintal: p14d,
      estimatedGross: Math.round(harvestQ * p14d),
      transportCostTotal: Math.round(harvestQ * transRate),
      sellingCostTotal: Math.round(harvestQ * p14d * 0.02),
      farmCostTotal: inputCost,
      estimatedNet: Math.round(harvestQ * p14d) - Math.round(harvestQ * transRate) - Math.round(harvestQ * p14d * 0.02),
      riskLevel: 'moderate',
      confidence: 'moderate',
      weatherRisk: 'low',
      priceRiskPct: 7.2,
    },
  ];

  return {
    farmSeasonId: farm.id,
    generatedAt: new Date().toISOString(),
    recommendedWindow: 'now',
    suggestedMandi: mandi,
    estimatedNetRealization: scenarios[0].estimatedNet,
    riskLevel: 'low',
    confidence: 'high',
    reasons: [
      `${formatCropName(farm.crop)} price trend is relatively stable — moderate opportunity to wait`,
      'Mandi arrivals are stable — no immediate supply-side pressure',
      'Weather outlook is favorable for the next 7 days — good transport window',
      `${mandi} offers the best estimated net price after transport — ₹${pNow}/qtl`,
      'Selling now locks in current favorable mandi rates and avoids holding risk',
    ],
    scenarios,
    source: 'demo' as const,
  };
}

export default function SellPage() {
  const { t, locale } = useTranslation();
  const [selectedWindow, setSelectedWindow] = useState<SellWindow>('now');
  const [showWhy, setShowWhy] = useState(true);
  const [farmContext, setFarmContext] = useState<ActiveFarmContext | null>(null);
  const [recommendation, setRecommendation] = useState<SellRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineFallback, setIsOfflineFallback] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      const activeFarm = getActiveFarmContext();
      setFarmContext(activeFarm);

      const payload = {
        farmSeasonId: activeFarm.id,
        crop: activeFarm.crop,
        commodity: activeFarm.commodity,
        area: activeFarm.areaHectares,
        areaHectares: activeFarm.areaHectares,
        sowingDate: activeFarm.sowingDate,
        district: activeFarm.district,
        village: activeFarm.village,
        state: activeFarm.state,
        lat: activeFarm.lat,
        lng: activeFarm.lng,
        inputCosts: activeFarm.inputCostPerHa,
        inputCostPerHa: activeFarm.inputCostPerHa,
        inputCostTotal: activeFarm.inputCostTotal,
        soilType: activeFarm.soilType,
        irrigationType: activeFarm.irrigationType,
        totalHarvestQ: activeFarm.totalHarvestQ,
      };

      try {
        const res = await fetch('/api/recommendations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }

        const json = await res.json();
        if (!json.data || !json.data.scenarios || !json.data.scenarios[0]) {
          throw new Error('Incomplete recommendation data received');
        }

        if (!cancelled) {
          const rec = json.data as SellRecommendation;
          setRecommendation(rec);
          setSelectedWindow(rec.recommendedWindow);
          setIsOfflineFallback(false);
          setError(null);
          setFarmContext(activeFarm);

          if (json.farmContext?.totalHarvestQ) {
            setFarmContext((prev) =>
              prev ? { ...prev, totalHarvestQ: json.farmContext.totalHarvestQ } : prev
            );
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.warn('[sell-page] Engine API fetch failed; using deterministic fallback:', err);
        if (!cancelled) {
          setIsOfflineFallback(true);
          const fallback = buildFallbackRecommendation(activeFarm);
          setRecommendation(fallback);
          setSelectedWindow(fallback.recommendedWindow);
          setFarmContext(activeFarm);
          setIsLoading(false);
        }
      }
    }

    load();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'agriintel_farm') {
        setIsLoading(true);
        load();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      cancelled = true;
      window.removeEventListener('storage', handleStorage);
    };
  }, [reloadKey]);

  if (isLoading) {
    return (
      <div className="px-4 pt-4 space-y-4 animate-pulse">
        <div>
          <div className="h-6 w-44 bg-muted rounded mb-1" />
          <div className="h-4 w-56 bg-muted/60 rounded" />
        </div>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="h-3 w-20 bg-muted rounded" />
            <div className="h-6 w-52 bg-muted rounded" />
            <div className="h-4 w-40 bg-muted rounded" />
            <div className="flex gap-2 pt-1">
              <div className="h-5 w-16 bg-muted rounded-full" />
              <div className="h-5 w-24 bg-muted rounded-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !recommendation || !recommendation.scenarios || !recommendation.scenarios[0]) {
    return (
      <div className="px-4 pt-10 text-center space-y-4">
        <span className="text-4xl block">⚠️</span>
        <h2 className="text-lg font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>
          {t('common.error')}
        </h2>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          {error || 'No recommendation could be generated for this farm profile.'}
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <button
            onClick={() => {
              setIsLoading(true);
              setReloadKey((k) => k + 1);
            }}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
          >
            {t('common.retry')}
          </button>
          <Link
            href="/onboarding"
            className="px-4 py-2 border border-border bg-card text-foreground text-sm font-semibold rounded-xl hover:border-primary/40 transition-colors"
          >
            {t('onboarding.title')}
          </Link>
        </div>
      </div>
    );
  }

  const { scenarios, recommendedWindow, reasons, suggestedMandi, riskLevel, confidence, source } = recommendation;
  const selectedScenario = scenarios.find((s) => s.window === selectedWindow) ?? scenarios[0]!;
  const harvestQ = farmContext?.totalHarvestQ ?? 68.25;
  const currentCrop = farmContext?.crop || 'soybean';
  const cropLabel = formatCropName(currentCrop, locale);
  const seasonLabel = farmContext?.season ?? 'Kharif 2024';

  const windowLabel = (window: string) => {
    if (window === 'now') return t('sell.sellNow');
    if (window === '7_days') return t('sell.wait7');
    return t('sell.wait14');
  };

  return (
    <div className="px-4 pt-4 space-y-4 pb-24">
      {/* HEADER */}
      <div>
        <h2 className="text-xl font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>
          {t('sell.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {cropLabel} · {harvestQ} {t('market.quintals')} · {seasonLabel}
        </p>
      </div>

      {/* RECOMMENDATION BANNER */}
      <Card className="border-primary bg-primary/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <span className="text-3xl">🎯</span>
            <div className="flex-1">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">
                {t('sell.recommendation')}
              </p>
              <p className="text-lg font-bold text-foreground leading-snug">
                {windowLabel(recommendedWindow)}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t('sell.suggestedMandi')}: <span className="font-semibold text-foreground">{suggestedMandi}</span>
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <RiskBadge level={riskLevel} locale={locale} />
                <ConfidenceBadge level={confidence} locale={locale} />
                {(isOfflineFallback || source === 'demo') && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                    {isOfflineFallback ? 'Offline fallback' : 'Demo data'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SCENARIO TABS (WHAT-IF SCENARIOS) */}
      <div>
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">
          {t('sell.simulate')}
        </p>
        <div className="flex gap-2">
          {scenarios.map((s) => {
            const isRec = s.window === recommendedWindow;
            const isSelected = s.window === selectedWindow;
            const scenarioLabel = windowLabel(s.window);
            return (
              <button
                key={s.window}
                id={`scenario-${s.window}`}
                onClick={() => setSelectedWindow(s.window as SellWindow)}
                className={cn(
                  'flex-1 rounded-xl border py-3 px-2 text-center transition-all duration-200 relative',
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : 'border-border bg-card hover:border-primary/40'
                )}
              >
                {isRec && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap">
                    {t('common.suggested')}
                  </span>
                )}
                <p className="text-[11px] font-semibold text-foreground leading-tight">{scenarioLabel}</p>
                <p className="text-sm font-bold text-primary mt-1">
                  {formatINR(s.estimatedNet)}
                </p>
                <p className="text-[10px] text-muted-foreground">{t('sell.netRealization')}</p>
                <div className="mt-1.5">
                  <RiskBadge level={s.riskLevel} locale={locale} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* NET REALIZATION BREAKDOWN */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base">
            {windowLabel(selectedScenario.window)} — {t('sell.netRealization')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            <NetRealizationRow
              label={t('sell.estPriceAt', { mandi: selectedScenario.mandi })}
              value={`₹${selectedScenario.estimatedModalPricePerQuintal.toLocaleString('en-IN')}/${t('market.quintals')}`}
            />
            <NetRealizationRow
              label={`${t('sell.grossValue')} (${harvestQ} ${t('market.quintals')})`}
              value={formatINR(selectedScenario.estimatedGross)}
            />
            <NetRealizationRow
              label={t('sell.transportCost')}
              value={`− ${formatINR(selectedScenario.transportCostTotal)}`}
              negative
            />
            <NetRealizationRow
              label={t('sell.sellingCosts')}
              value={`− ${formatINR(selectedScenario.sellingCostTotal)}`}
              negative
            />
            <NetRealizationRow
              label={t('sell.netRealization')}
              value={formatINR(selectedScenario.estimatedNet)}
              bold
            />
            <NetRealizationRow
              label={t('sell.farmCosts')}
              value={`− ${formatINR(selectedScenario.farmCostTotal)}`}
              negative
            />
            <NetRealizationRow
              label={t('sell.estimatedProfit')}
              value={formatINR(selectedScenario.estimatedNet - selectedScenario.farmCostTotal)}
              bold
            />
          </div>
          <p className="text-xs text-muted-foreground italic mt-3">
            {t('sell.disclaimer')}
          </p>
        </CardContent>
      </Card>

      {/* WHY THIS RECOMMENDATION */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <button
            id="why-explanation-toggle"
            onClick={() => setShowWhy(!showWhy)}
            className="w-full flex items-center justify-between text-left"
          >
            <span className="text-sm font-semibold text-foreground">
              💡 {t('sell.whyTitle')}
            </span>
            <span className="text-muted-foreground text-sm">{showWhy ? '▲' : '▼'}</span>
          </button>

          {showWhy && (
            <div className="mt-3 space-y-2">
              {reasons.map((reason, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                  <p className="text-muted-foreground leading-snug">
                    {localizeReason(reason, locale, currentCrop)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <Card className="border-dashed border-muted-foreground/30">
        <CardContent className="pt-3 pb-3">
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            ⚠️ {t('sell.disclaimer')}
          </p>
        </CardContent>
      </Card>

      <div className="h-2" />
    </div>
  );
}
