// app/(dashboard)/dashboard/page.tsx
// Screen 1: Home / Today Summary Dashboard
// Purpose: "What should I know today?"
// Consumes live weather via /api/weather with deterministic demo fallback.

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { formatINR, formatQuintals, formatDate } from '@/lib/utils/format';
import { getActiveFarmContext, type ActiveFarmContext } from '@/lib/utils/farm-storage';
import { useTranslation } from '@/lib/i18n/context';
import type { WeatherForecast, WeatherCode } from '@/lib/types/weather';
import type { SellRecommendation } from '@/lib/types/recommendation';

// Demo data imports for initial SSR/fallback baseline
import farmData from '@/data/demo/farm-profile.json';
import yieldData from '@/data/demo/yield-prediction.json';
import recommendationData from '@/data/demo/recommendation.json';
import satelliteData from '@/data/demo/satellite-health.json';

function WeatherIcon({ code }: { code: WeatherCode | string }) {
  const icons: Record<string, string> = {
    sunny: '☀️',
    partly_cloudy: '⛅',
    cloudy: '☁️',
    drizzle: '🌦️',
    rain: '🌧️',
    heavy_rain: '⛈️',
    thunderstorm: '⛈️',
    fog: '🌫️',
    heatwave: '🌡️',
  };
  return <span>{icons[code] ?? '🌤️'}</span>;
}

function HealthBadge({ status, locale }: { status: string; locale: string }) {
  const config = {
    healthy: {
      label: locale === 'mr' ? 'निरोगी' : locale === 'hi' ? 'स्वस्थ' : 'Healthy',
      className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    },
    moderate: {
      label: locale === 'mr' ? 'मध्यम' : locale === 'hi' ? 'मध्यम' : 'Moderate',
      className: 'bg-amber-100 text-amber-700 border-amber-200',
    },
    stressed: {
      label: locale === 'mr' ? 'तणावग्रस्त' : locale === 'hi' ? 'तनावग्रस्त' : 'Stressed',
      className: 'bg-red-100 text-red-700 border-red-200',
    },
  };
  const c = config[status as keyof typeof config] ?? config.moderate;
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${c.className}`}>{c.label}</span>;
}

function RiskBadge({ level, locale }: { level: string; locale: string }) {
  const config = {
    low: {
      label: locale === 'mr' ? 'कमी जोखीम' : locale === 'hi' ? 'कम जोखिम' : 'Low Risk',
      className: 'bg-emerald-100 text-emerald-700',
    },
    moderate: {
      label: locale === 'mr' ? 'मध्यम जोखीम' : locale === 'hi' ? 'मध्यम जोखिम' : 'Moderate Risk',
      className: 'bg-amber-100 text-amber-700',
    },
    high: {
      label: locale === 'mr' ? 'अधिक जोखीम' : locale === 'hi' ? 'अधिक जोखिम' : 'Higher Risk',
      className: 'bg-red-100 text-red-700',
    },
  };
  const c = config[level as keyof typeof config] ?? config.moderate;
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.className}`}>{c.label}</span>;
}

export default function DashboardPage() {
  const { t, locale } = useTranslation();

  const [activeFarm] = useState<ActiveFarmContext>(() => {
    if (typeof window !== 'undefined') {
      return getActiveFarmContext();
    }
    return {
      id: farmData.farm.id,
      crop: farmData.season.crop,
      commodity: farmData.season.crop,
      state: farmData.farm.state,
      district: farmData.farm.district,
      village: farmData.farm.village,
      areaHectares: farmData.farm.areaHectares,
      sowingDate: farmData.season.sowingDate,
      season: 'Kharif 2024',
      lat: farmData.farm.lat,
      lng: farmData.farm.lng,
      nearestMandi: 'Latur',
      inputCostPerHa: farmData.season.inputCostPerHa,
      inputCostTotal: Math.round(farmData.farm.areaHectares * farmData.season.inputCostPerHa),
      expectedYieldQPerHa: yieldData.expectedYieldQPerHa,
      totalHarvestQ: yieldData.totalHarvestQ,
      isCustomFarm: false,
    };
  });

  const [rec, setRec] = useState<SellRecommendation>(recommendationData as unknown as SellRecommendation);
  const [weatherForecast, setWeatherForecast] = useState<WeatherForecast | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const farmContext = getActiveFarmContext();

    const lat = farmContext.lat ?? 18.2333;
    const lng = farmContext.lng ?? 76.7167;

    // 1. Fetch selling recommendation dynamically based on active farm
    async function loadRecommendation() {
      try {
        const payload = {
          farmSeasonId: farmContext.id,
          crop: farmContext.crop,
          commodity: farmContext.commodity,
          area: farmContext.areaHectares,
          areaHectares: farmContext.areaHectares,
          sowingDate: farmContext.sowingDate,
          district: farmContext.district,
          village: farmContext.village,
          state: farmContext.state,
          lat: farmContext.lat,
          lng: farmContext.lng,
          inputCosts: farmContext.inputCostPerHa,
          inputCostPerHa: farmContext.inputCostPerHa,
          inputCostTotal: farmContext.inputCostTotal,
          soilType: farmContext.soilType,
          irrigationType: farmContext.irrigationType,
          totalHarvestQ: farmContext.totalHarvestQ,
        };

        const res = await fetch('/api/recommendations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const json = await res.json();
          if (isMounted && json?.data?.scenarios) {
            setRec(json.data as SellRecommendation);
          }
        }
      } catch (err) {
        console.warn('[DashboardPage] Recommendation fetch failed, using fallback:', err);
      }
    }

    // 2. Fetch weather forecast
    async function loadWeather() {
      try {
        const res = await fetch(`/api/weather?lat=${lat}&lng=${lng}&action=forecast`);
        if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
        const data = await res.json() as { data: WeatherForecast };
        if (isMounted && data?.data) {
          setWeatherForecast(data.data);
        }
      } catch (err) {
        console.warn('[DashboardPage] Live weather fetch failed, attempting demo fallback:', err);
        try {
          const fallbackRes = await fetch('/api/weather?mode=demo&action=forecast');
          const fallbackData = await fallbackRes.json() as { data: WeatherForecast };
          if (isMounted && fallbackData?.data) {
            setWeatherForecast(fallbackData.data);
          }
        } catch {
          // Keep null if both fail
        }
      } finally {
        if (isMounted) setWeatherLoading(false);
      }
    }

    loadRecommendation();
    loadWeather();

    return () => {
      isMounted = false;
    };
  }, []);

  const windowLabel = rec.recommendedWindow === 'now'
    ? t('sell.sellNow')
    : rec.recommendedWindow === '7_days'
    ? t('sell.wait7')
    : t('sell.wait14');

  const todayWeather = weatherForecast?.days?.[0];
  const extremeDays = weatherForecast?.days?.filter((d) => d.isExtremeRisk) ?? [];
  const isLive = weatherForecast?.source === 'live' || weatherForecast?.source === 'open-meteo';
  const currentModalPrice = rec.scenarios?.[0]?.estimatedModalPricePerQuintal || 4280;
  const suggestedMandiName = rec.suggestedMandi || activeFarm.nearestMandi || 'Latur';

  return (
    <div className="px-4 pt-4 space-y-4 pb-24">
      {/* Page title with active farm badge */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>
            {t('home.title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {activeFarm.village ? `${activeFarm.village}, ` : ''}{activeFarm.district} · {activeFarm.season}
          </p>
        </div>
        <Link
          href="/onboarding"
          className="text-xs bg-muted hover:bg-muted/80 text-foreground font-medium px-2.5 py-1 rounded-lg border border-border transition-colors"
          title="Switch or reconfigure farm"
        >
          ⚙️ Change Farm
        </Link>
      </div>

      {/* TODAY'S ACTION — highest priority card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <span className="text-3xl">💰</span>
            <div className="flex-1">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">{t('home.todayAction')}</p>
              <p className="text-base font-bold text-foreground leading-snug">{windowLabel}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('sell.netRealization')}: <span className="font-semibold text-foreground">{formatINR(rec.estimatedNetRealization)}</span>
                {' '}· <span className="font-medium">{suggestedMandiName} mandi</span>
              </p>
              <div className="flex items-center gap-2 mt-2">
                <RiskBadge level={rec.riskLevel} locale={locale} />
                <Link href="/sell" className="text-xs text-primary font-semibold underline underline-offset-2">
                  {t('sell.fullAnalysis')} →
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weather alert if extreme */}
      {extremeDays.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">{t('home.weatherAlert')}</p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${
                    isLive ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}>
                    {isLive ? 'Live Open-Meteo' : 'Demo Data'}
                  </span>
                </div>
                <p className="text-sm font-semibold text-amber-900">
                  Heavy rain forecast ({extremeDays[0]!.rainfallMm}mm) on {formatDate(extremeDays[0]!.date)}
                </p>
                <p className="text-xs text-amber-700 mt-0.5">Plan transport before rain arrives to avoid delays.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 2-col summary grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Yield */}
        <Card className="col-span-1">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">{t('yield.expectedYield')}</p>
            <p className="text-2xl font-bold text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>
              {formatQuintals(rec.totalHarvestQ || activeFarm.totalHarvestQ)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {(rec.expectedYieldQPerHa || activeFarm.expectedYieldQPerHa).toFixed(1)} qtl/ha
            </p>
            <Link href="/farm" className="text-xs text-primary font-medium mt-2 block">Details →</Link>
          </CardContent>
        </Card>

        {/* Market */}
        <Card className="col-span-1">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">{t('market.currentPrice')}</p>
            <p className="text-2xl font-bold text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>
              ₹{currentModalPrice.toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">per quintal · {suggestedMandiName}</p>
            <Link href="/market" className="text-xs text-primary font-medium mt-2 block">Compare →</Link>
          </CardContent>
        </Card>

        {/* Crop Health */}
        <Card className="col-span-1">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">{t('farm.cropHealth')}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl">🌿</span>
              <HealthBadge status={satelliteData.latestStatus} locale={locale} />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              NDVI {satelliteData.latestNdvi.toFixed(2)} · {satelliteData.trend}
            </p>
            <Link href="/farm" className="text-xs text-primary font-medium mt-2 block">Field map →</Link>
          </CardContent>
        </Card>

        {/* Weather Today — Connected dynamically to /api/weather */}
        <Card className="col-span-1">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Weather</p>
              {weatherForecast && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${
                  isLive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {isLive ? 'Live' : 'Demo'}
                </span>
              )}
            </div>

            {weatherLoading && !todayWeather ? (
              <div className="animate-pulse space-y-2 mt-2">
                <div className="h-6 w-16 bg-muted rounded" />
                <div className="h-3 w-24 bg-muted rounded" />
              </div>
            ) : todayWeather ? (
              <>
                <div className="flex items-center gap-2 mt-1">
                  <WeatherIcon code={todayWeather.weatherCode} />
                  <span className="text-xl font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>
                    {Math.round(todayWeather.tempMaxC)}°C
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {todayWeather.rainfallMm > 0 ? `${todayWeather.rainfallMm}mm rain` : 'No rain'} · {todayWeather.humidityPct}% humidity
                </p>
              </>
            ) : (
              <div className="text-xs text-muted-foreground mt-2">
                Weather unavailable
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Harvest window info */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Sown / Expected Harvest</p>
              <p className="text-sm font-semibold">
                {formatDate(activeFarm.sowingDate)} → {formatDate('2024-10-15')}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeFarm.areaHectares} ha · {activeFarm.crop} · {activeFarm.irrigationType || 'rainfed'}
              </p>
            </div>
            <span className="text-3xl">📅</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
