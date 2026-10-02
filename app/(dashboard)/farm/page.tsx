// app/(dashboard)/farm/page.tsx
// Screen 2: My Farm — field map, NDVI health, yield prediction, and dynamic weather conditions
// Consumes weather through /api/weather with deterministic demo fallback.

'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatQuintals, formatHectares, formatDate, formatNDVI } from '@/lib/utils/format';
import { getActiveFarmContext, formatCropName, type ActiveFarmContext } from '@/lib/utils/farm-storage';
import type { WeatherForecast, WeatherCode } from '@/lib/types/weather';
import type { SatelliteHealth, HealthStatus, NDVIReading } from '@/lib/types/satellite';
import { normalizeSatelliteHealth } from '@/lib/services/satellite/utils';

import satelliteData from '@/data/demo/satellite-health.json';
import yieldData from '@/data/demo/yield-prediction.json';
import farmData from '@/data/demo/farm-profile.json';

// Dynamically import Leaflet field map with SSR disabled
const FieldMap = dynamic(() => import('@/components/farm/FieldMap'), {
  ssr: false,
  loading: () => (
    <div className="h-64 bg-muted/40 rounded-lg flex flex-col items-center justify-center p-4 text-center animate-pulse">
      <span className="text-3xl mb-1">🗺️</span>
      <p className="text-xs text-muted-foreground">Loading interactive field map...</p>
    </div>
  ),
});

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

function HealthBar({ healthy, moderate, stressed }: { healthy: number; moderate: number; stressed: number }) {
  return (
    <div className="flex h-3 w-full rounded-full overflow-hidden gap-0.5">
      <div className="bg-emerald-500 h-full rounded-l-full transition-all" style={{ width: `${healthy}%` }} title={`${healthy}% healthy`} />
      <div className="bg-amber-400 h-full transition-all" style={{ width: `${moderate}%` }} title={`${moderate}% moderate`} />
      <div className="bg-red-500 h-full rounded-r-full transition-all" style={{ width: `${stressed}%` }} title={`${stressed}% stressed`} />
    </div>
  );
}

function NDVITrend({ readings }: { readings: NDVIReading[] }) {
  const sorted = [...readings].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  const max = Math.max(...sorted.map((r) => r.ndvi));
  return (
    <div className="flex items-end gap-1 h-12">
      {sorted.map((r, i) => {
        const heightPct = max > 0 ? (r.ndvi / max) * 100 : 50;
        const color =
          r.healthStatus === 'healthy' ? 'bg-emerald-500' :
          r.healthStatus === 'moderate' ? 'bg-amber-400' : 'bg-red-400';
        return (
          <div key={i} className="flex-1 flex flex-col justify-end">
            <div
              className={`${color} rounded-t-sm opacity-90 transition-all`}
              style={{ height: `${heightPct}%` }}
              title={`NDVI ${r.ndvi} on ${r.observedAt.split('T')[0]}`}
            />
          </div>
        );
      })}
    </div>
  );
}

function formatDayOfWeek(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { weekday: 'short' });
  } catch {
    return dateStr;
  }
}

import { useTranslation } from '@/lib/i18n/context';
import type { YieldPrediction } from '@/lib/types/yield';

export default function FarmPage() {
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
      fieldGeoJson: farmData.farm.fieldGeoJson as unknown as GeoJSON.Polygon,
    };
  });

  const [yieldPrediction, setYieldPrediction] = useState<YieldPrediction>(yieldData as unknown as YieldPrediction);

  const [satellite, setSatellite] = useState<SatelliteHealth>(() => {
    return normalizeSatelliteHealth(
      {
        farmId: activeFarm.id,
        latestNdvi: satelliteData.latestNdvi,
        latestStatus: satelliteData.latestStatus as HealthStatus,
        trend: satelliteData.trend as SatelliteHealth['trend'],
        readings: satelliteData.readings as unknown as NDVIReading[],
        healthyPct: satelliteData.healthyPct,
        moderatePct: satelliteData.moderatePct,
        stressedPct: satelliteData.stressedPct,
        lastObservedAt: satelliteData.lastObservedAt,
        source: 'demo' as const,
      },
      activeFarm.id,
      activeFarm.lat,
      activeFarm.lng,
      activeFarm.fieldGeoJson
    );
  });

  const [weatherForecast, setWeatherForecast] = useState<WeatherForecast | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      const currentFarm = getActiveFarmContext();

      const lat = currentFarm.lat ?? 18.2333;
      const lng = currentFarm.lng ?? 76.7167;
      const farmId = currentFarm.id || 'demo-soybean-maharashtra';

      // 1. Fetch satellite health data with stored farm polygon
      try {
        let satUrl = `/api/satellite?lat=${lat}&lng=${lng}&farmId=${encodeURIComponent(farmId)}`;
        if (currentFarm.fieldGeoJson) {
          satUrl += `&polygon=${encodeURIComponent(JSON.stringify(currentFarm.fieldGeoJson))}`;
        }
        const satRes = await fetch(satUrl);
        if (!satRes.ok) throw new Error(`Satellite fetch failed: ${satRes.status}`);
        const satJson = await satRes.json() as { data: SatelliteHealth };
        if (isMounted && satJson?.data) {
          setSatellite(satJson.data);
        }
      } catch (err) {
        console.warn('[FarmPage] Satellite fetch failed, using fallback:', err);
      }

      // 2. Fetch weather forecast data
      try {
        const weatherRes = await fetch(`/api/weather?lat=${lat}&lng=${lng}&action=forecast&days=7`);
        if (!weatherRes.ok) throw new Error(`Weather fetch failed: ${weatherRes.status}`);
        const weatherJson = await weatherRes.json() as { data: WeatherForecast };
        if (isMounted && weatherJson?.data) {
          setWeatherForecast(weatherJson.data);
        }
      } catch (err) {
        console.warn('[FarmPage] Live weather fetch failed, attempting demo fallback:', err);
        try {
          const fallbackRes = await fetch('/api/weather?mode=demo&action=forecast&days=7');
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

      // 3. Fetch yield prediction & recommendations
      try {
        const payload = {
          farmSeasonId: currentFarm.id,
          crop: currentFarm.crop,
          commodity: currentFarm.commodity,
          area: currentFarm.areaHectares,
          areaHectares: currentFarm.areaHectares,
          sowingDate: currentFarm.sowingDate,
          district: currentFarm.district,
          state: currentFarm.state,
          lat: currentFarm.lat,
          lng: currentFarm.lng,
          soilType: currentFarm.soilType,
          irrigationType: currentFarm.irrigationType,
          totalHarvestQ: currentFarm.totalHarvestQ,
        };
        const recRes = await fetch('/api/recommendations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (recRes.ok) {
          const json = await recRes.json();
          if (isMounted && json?.farmContext) {
            setYieldPrediction((prev) => ({
              ...prev,
              expectedYieldQPerHa: json.farmContext.expectedYieldQPerHa ?? currentFarm.expectedYieldQPerHa,
              totalHarvestQ: json.farmContext.totalHarvestQ ?? currentFarm.totalHarvestQ,
              confidenceLow: json.farmContext.confidenceLow ?? Math.round((json.farmContext.expectedYieldQPerHa ?? currentFarm.expectedYieldQPerHa) * 0.85 * 10) / 10,
              confidenceHigh: json.farmContext.confidenceHigh ?? Math.round((json.farmContext.expectedYieldQPerHa ?? currentFarm.expectedYieldQPerHa) * 1.15 * 10) / 10,
              source: json.farmContext.yieldSource ?? 'fallback',
              explanation: json.data?.yieldExplanation ?? prev.explanation,
            }));
          }
        }
      } catch (err) {
        console.warn('[FarmPage] Yield prediction fetch failed:', err);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const healthStatusConfig = {
    healthy: { label: 'Healthy', icon: '🟢', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    moderate: { label: 'Moderate', icon: '🟡', color: 'text-amber-700 bg-amber-50 border-amber-200' },
    stressed: { label: 'Stressed', icon: '🔴', color: 'text-red-700 bg-red-50 border-red-200' },
  };
  const healthConfig = healthStatusConfig[satellite.latestStatus as keyof typeof healthStatusConfig] ?? healthStatusConfig.moderate;

  const trendConfig = {
    improving: { label: 'Improving', icon: '↑', color: 'text-emerald-600' },
    stable: { label: 'Stable', icon: '→', color: 'text-muted-foreground' },
    declining: { label: 'Declining', icon: '↓', color: 'text-red-600' },
  };
  const trendCfg = trendConfig[satellite.trend as keyof typeof trendConfig] ?? trendConfig.stable;

  const isWeatherLive = weatherForecast?.source === 'live' || weatherForecast?.source === 'open-meteo';
  const isSatelliteLive = satellite.source === 'live' || satellite.source === 'sentinel-hub';
  const todayWeather = weatherForecast?.days?.[0];
  const weeklyRainfall = weatherForecast?.days
    ? weatherForecast.days.slice(0, 7).reduce((acc, d) => acc + d.rainfallMm, 0)
    : 0;
  const extremeDays = weatherForecast?.days?.filter((d) => d.isExtremeRisk) ?? [];

  return (
    <div className="px-4 pt-4 space-y-4">
      <div>
        <h2 className="text-xl font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>{t('farm.title')}</h2>
        <p className="text-sm text-muted-foreground">
          {activeFarm.village ? `${activeFarm.village}, ` : ''}{activeFarm.district} · {formatHectares(activeFarm.areaHectares)}
        </p>
      </div>

      {/* Interactive Leaflet Field Map with Health Zones */}
      <Card className="overflow-hidden border-border/80 shadow-xs">
        <FieldMap
          lat={activeFarm.lat}
          lng={activeFarm.lng}
          farmName={activeFarm.village ? `${activeFarm.village} Field` : 'My Field'}
          crop={formatCropName(activeFarm.crop, locale)}
          fieldBoundary={satellite.fieldBoundary}
          healthZones={satellite.healthZones}
          latestStatus={satellite.latestStatus}
          latestNdvi={satellite.latestNdvi}
          healthyPct={satellite.healthyPct}
          moderatePct={satellite.moderatePct}
          stressedPct={satellite.stressedPct}
        />
      </Card>

      {/* Weather & Growing Conditions — Dynamically consumed from /api/weather */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base flex items-center justify-between">
            <span>{t('weather.title')}</span>
            {weatherForecast && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                isWeatherLive ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-amber-50 text-amber-700 border-amber-300'
              }`}>
                {isWeatherLive ? '🟢 Live Open-Meteo' : 'ℹ️ Demo Data'}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {weatherLoading && !todayWeather ? (
            <div className="animate-pulse space-y-2 py-2">
              <div className="h-6 w-32 bg-muted rounded" />
              <div className="h-4 w-48 bg-muted rounded" />
            </div>
          ) : todayWeather ? (
            <>
              {/* Primary weather stats */}
              <div className="grid grid-cols-3 gap-2 py-1 text-center bg-muted/40 rounded-lg p-2.5">
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase font-medium">{t('weather.temperature')}</p>
                  <p className="text-base font-bold text-foreground mt-0.5">
                    {Math.round(todayWeather.tempMaxC)}°C
                    <span className="text-xs text-muted-foreground font-normal ml-1">/ {Math.round(todayWeather.tempMinC)}°</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{todayWeather.description}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase font-medium">{t('weather.precipitation')}</p>
                  <p className="text-base font-bold text-foreground mt-0.5">
                    {todayWeather.rainfallMm} mm
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{weeklyRainfall.toFixed(1)}mm 7-day</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase font-medium">{t('weather.humidity')}</p>
                  <p className="text-base font-bold text-foreground mt-0.5">
                    {todayWeather.humidityPct}%
                  </p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">Optimal</p>
                </div>
              </div>

              {/* Extreme Weather / Heavy Rain Alert */}
              {extremeDays.length > 0 && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md p-2.5 text-xs text-amber-800">
                  <span className="text-base">⚠️</span>
                  <div>
                    <p className="font-semibold">Heavy Rain Risk Detected</p>
                    <p className="mt-0.5 text-amber-700">
                      {extremeDays[0]!.rainfallMm}mm rain forecast on {formatDate(extremeDays[0]!.date)}. Monitor field drainage and plan harvesting/transport ahead.
                    </p>
                  </div>
                </div>
              )}

              {/* Day-by-day 7-day forecast strip */}
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1.5 uppercase tracking-wide">
                  7-Day Forecast
                </p>
                <div className="grid grid-cols-7 gap-1 overflow-x-auto pb-1 text-center">
                  {weatherForecast?.days?.slice(0, 7).map((d, i) => (
                    <div
                      key={d.date}
                      className={`p-1.5 rounded border text-xs flex flex-col items-center justify-between min-w-[42px] ${
                        i === 0
                          ? 'bg-primary/5 border-primary/30 font-semibold'
                          : d.isExtremeRisk
                          ? 'bg-amber-50/70 border-amber-300'
                          : 'bg-card border-border/60'
                      }`}
                    >
                      <span className="text-[10px] text-muted-foreground">
                        {i === 0 ? 'Today' : formatDayOfWeek(d.date)}
                      </span>
                      <span className="text-base my-0.5">
                        <WeatherIcon code={d.weatherCode} />
                      </span>
                      <span className="text-[11px] font-medium">
                        {Math.round(d.tempMaxC)}°
                      </span>
                      <span className={`text-[10px] ${d.rainfallMm > 10 ? 'font-bold text-blue-600' : 'text-muted-foreground'}`}>
                        {d.rainfallMm > 0 ? `${d.rainfallMm}m` : '0'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-muted-foreground italic">
                Source: {isWeatherLive ? 'Open-Meteo live atmospheric models (Asia/Kolkata)' : 'Demo fallback data — illustrative only'}.
              </p>
            </>
          ) : (
            <div className="text-xs text-muted-foreground italic py-2">
              Weather service currently initializing.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Crop Health */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base flex items-center justify-between">
            <span>{t('farm.cropHealth')}</span>
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                isSatelliteLive ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-amber-50 text-amber-700 border-amber-300'
              }`}>
                {isSatelliteLive ? '🟢 Live Sentinel-2' : 'ℹ️ Demo Satellite Data'}
              </span>
              <span className={`text-sm font-semibold px-2 py-1 rounded-full border ${healthConfig.color}`}>
                {healthConfig.icon} {healthConfig.label}
              </span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* NDVI */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{t('farm.ndvi')}</p>
              <p className="text-2xl font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>
                {formatNDVI(satellite.latestNdvi)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Season Average: <span className="font-semibold text-foreground">{satellite.avgNdvi ? satellite.avgNdvi.toFixed(2) : '0.65'}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{t('farm.trend')}</p>
              <p className={`text-sm font-semibold ${trendCfg.color}`}>
                {trendCfg.icon} {trendCfg.label}
              </p>
            </div>
          </div>

          {/* Health zone bar */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Field Area Distribution</p>
            <HealthBar
              healthy={satellite.healthyPct}
              moderate={satellite.moderatePct}
              stressed={satellite.stressedPct}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{satellite.healthyPct}% healthy</span>
              <span>{satellite.moderatePct}% moderate</span>
              <span>{satellite.stressedPct}% stressed</span>
            </div>
          </div>

          {/* NDVI history bar chart */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">NDVI History (last 8 observations)</p>
            <NDVITrend readings={satellite.readings} />
            <p className="text-xs text-muted-foreground mt-1">
              Last observed: {new Date(satellite.lastObservedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </p>
          </div>

          <p className="text-xs text-muted-foreground italic">
            Source: {isSatelliteLive ? 'Sentinel-2 L2A Multispectral satellite observations (10m)' : 'Demo satellite baseline data — illustrative only'}.
          </p>
        </CardContent>
      </Card>

      {/* Yield Prediction */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base flex items-center justify-between">
            <span>{t('yield.expectedYield')}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
              yieldPrediction.source === 'ml' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-amber-50 text-amber-700 border-amber-300'
            }`}>
              {yieldPrediction.source === 'ml' ? '🟢 Live ML Service' : 'ℹ️ Demo Yield Model'}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold text-primary" style={{ fontFamily: 'Outfit, sans-serif' }}>
                {formatQuintals(yieldPrediction.totalHarvestQ)}
              </p>
              <p className="text-sm text-muted-foreground">
                {yieldPrediction.expectedYieldQPerHa.toFixed(1)} qtl/ha
              </p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>Range (estimated):</p>
              <p className="font-medium text-foreground">
                {yieldPrediction.confidenceLow.toFixed(1)}–{yieldPrediction.confidenceHigh.toFixed(1)} qtl/ha
              </p>
            </div>
          </div>

          {/* Explanation factors */}
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">
              Why this estimate?
            </p>
            <div className="space-y-1.5">
              {yieldPrediction.explanation.map((factor, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-sm">
                    {factor.impactDirection === 'positive' ? '✅' : factor.impactDirection === 'negative' ? '⚠️' : '➖'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{factor.factor}</p>
                    <p className="text-xs text-muted-foreground">{factor.value}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${
                      factor.impactDirection === 'positive' ? 'border-emerald-300 text-emerald-700' :
                      factor.impactDirection === 'negative' ? 'border-red-300 text-red-700' :
                      'border-muted text-muted-foreground'
                    }`}
                  >
                    {factor.impactMagnitude}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground italic">
            Based on historical data, weather conditions, and vegetation health. Not a guarantee.
          </p>
        </CardContent>
      </Card>

      {/* Season info */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Crop</p>
              <p className="font-semibold capitalize">{activeFarm.crop}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Season</p>
              <p className="font-semibold">{activeFarm.season}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sown On</p>
              <p className="font-semibold">{formatDate(activeFarm.sowingDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Nearest APMC Mandi</p>
              <p className="font-semibold">{activeFarm.nearestMandi}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Area</p>
              <p className="font-semibold">{formatHectares(activeFarm.areaHectares)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Soil / Irrigation</p>
              <p className="font-semibold capitalize">{activeFarm.soilType ?? 'Black'} / {activeFarm.irrigationType ?? 'Rainfed'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="h-2" />
    </div>
  );
}
