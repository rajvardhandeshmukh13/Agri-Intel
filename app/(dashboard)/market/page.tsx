// app/(dashboard)/market/page.tsx
// Screen 3: Market — price history, mandi comparison, transport cost
// Dynamically connected to /api/market with live Agmarknet data & deterministic demo fallback.
// Fully localized across English, Marathi, and Hindi with authentic multi-mandi 30-day time-series.

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

import { formatShortDate, formatPriceChange } from '@/lib/utils/format';
import { getActiveFarmContext, formatCropName } from '@/lib/utils/farm-storage';
import { useTranslation } from '@/lib/i18n/context';
import type { MarketAnalysis } from '@/lib/types/market';

function NetPriceBar({ net, max }: { net: number; max: number }) {
  const pct = max > 0 ? (net / max) * 100 : 50;
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${Math.min(Math.max(pct, 10), 100)}%` }} />
    </div>
  );
}

export default function MarketPage() {
  const { t, locale } = useTranslation();
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [commodityKey, setCommodityKey] = useState('soybean');
  const [mandiLabel, setMandiLabel] = useState('Latur');

  useEffect(() => {
    let isMounted = true;
    async function loadMarketData() {
      try {
        const farm = getActiveFarmContext();
        const commodity = farm.crop || 'soybean';
        const mandi = farm.nearestMandi || 'Latur';
        const lat = farm.lat ?? 18.2333;
        const lng = farm.lng ?? 76.7167;

        if (isMounted) {
          setCommodityKey(commodity);
          setMandiLabel(mandi);
        }

        const res = await fetch(
          `/api/market?commodity=${encodeURIComponent(commodity)}&mandi=${encodeURIComponent(mandi)}&state=Maharashtra&lat=${lat}&lng=${lng}&action=analysis`
        );
        if (!res.ok) throw new Error(`Market fetch failed: ${res.status}`);
        const data = await res.json() as { data: MarketAnalysis };
        if (isMounted && data?.data) {
          setAnalysis(data.data);
        }
      } catch (err) {
        console.warn('[MarketPage] Live fetch failed, using demo fallback:', err);
        try {
          const fallbackRes = await fetch('/api/market?mode=demo&action=analysis');
          const fallbackData = await fallbackRes.json() as { data: MarketAnalysis };
          if (isMounted && fallbackData?.data) {
            setAnalysis(fallbackData.data);
          }
        } catch {
          // Keep null if both fail
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadMarketData();
    return () => {
      isMounted = false;
    };
  }, []);

  const isLive = analysis?.source === 'agmarknet' || analysis?.source === 'live';
  const priceHistory = analysis?.priceHistory ?? [];
  const chartData = [...priceHistory]
    .sort((a, b) => a.recordedDate.localeCompare(b.recordedDate))
    .map((r) => ({
      date: formatShortDate(r.recordedDate),
      price: r.modalPricePerQuintal,
      min: r.minPricePerQuintal,
      max: r.maxPricePerQuintal,
    }));

  const currentPrice = analysis?.currentModalPrice ?? chartData[chartData.length - 1]?.price ?? 4280;
  const prevPrice = chartData[0]?.price ?? currentPrice;
  const priceChange = prevPrice > 0 ? ((currentPrice - prevPrice) / prevPrice) * 100 : 0;
  const nearbyMandis = analysis?.nearbyMandis ?? [];
  const maxNet = nearbyMandis.length > 0
    ? Math.max(...nearbyMandis.map((m) => m.estimatedNetPricePerQuintal))
    : 4300;

  const cropDisplayName = formatCropName(commodityKey, locale);

  const trendDirectionLabel = analysis?.trend
    ? analysis.trend.direction === 'rising'
      ? `↑ ${t('market.rising')}`
      : analysis.trend.direction === 'falling'
      ? `↓ ${t('market.falling')}`
      : `→ ${t('market.stable')}`
    : priceChange > 1
    ? `↑ ${t('market.rising')}`
    : priceChange < -1
    ? `↓ ${t('market.falling')}`
    : `→ ${t('market.stable')}`;

  const momentumLabel = analysis?.trend?.momentum === 'strong'
    ? t('market.momentumStrong')
    : analysis?.trend?.momentum === 'moderate'
    ? t('market.momentumModerate')
    : t('market.momentumWeak');

  return (
    <div className="px-4 pt-4 space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>
            {t('market.title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {cropDisplayName} · {t('market.maharashtraMandis')}
          </p>
        </div>
        {analysis && (
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
            isLive ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-amber-50 text-amber-700 border-amber-300'
          }`}>
            {isLive ? '🟢 Live Agmarknet' : 'ℹ️ Demo Data'}
          </span>
        )}
      </div>

      {/* Current price hero */}
      <Card className="bg-primary text-primary-foreground shadow-sm">
        <CardContent className="pt-4 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80 mb-1">
            {t('market.currentPrice')} · {analysis?.mandi || mandiLabel}
          </p>
          <div className="flex items-end justify-between">
            <p className="text-4xl font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>
              ₹{currentPrice.toLocaleString('en-IN')}
            </p>
            <div className="text-right">
              <p className="text-xs opacity-80">{t('market.perQuintal')}</p>
              <p className={`text-sm font-bold ${priceChange >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {formatPriceChange(priceChange)} (30d)
              </p>
            </div>
          </div>
          <p className="text-xs opacity-80 mt-2">
            {t('market.trendLabel')}: {trendDirectionLabel} · {momentumLabel}
          </p>
        </CardContent>
      </Card>

      {/* Price Chart */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base flex items-center justify-between">
            <span>{t('market.priceHistory')}</span>
            <span className="text-xs text-muted-foreground font-normal">
              {t('market.modalPricePerQtl')}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && chartData.length === 0 ? (
            <div className="h-40 flex items-center justify-center animate-pulse text-xs text-muted-foreground">
              {t('common.loading')}
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                  interval={Math.max(1, Math.floor(chartData.length / 7))}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                  domain={['auto', 'auto']}
                  tickFormatter={(v: number) => `₹${(v / 1000).toFixed(1)}k`}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [
                    `\u20b9${Number(value).toLocaleString('en-IN')}`, t('market.currentPrice'),
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="var(--chart-1)"
                  strokeWidth={2.5}
                  dot={chartData.length < 5}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('common.noData')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Mandi Comparison */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base">{t('market.mandiComparison')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {t('market.rankedByNet')}
          </p>
          {loading && nearbyMandis.length === 0 ? (
            <div className="space-y-2 py-4 animate-pulse">
              <div className="h-16 bg-muted rounded-xl" />
              <div className="h-16 bg-muted rounded-xl" />
              <div className="h-16 bg-muted rounded-xl" />
            </div>
          ) : nearbyMandis.map((item, index) => {
            const isBest = item.priceRank === 1 || index === 0;
            return (
              <div
                key={item.mandi.name}
                className={`p-3 rounded-xl border transition-all ${
                  isBest ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      {isBest && (
                        <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-semibold">
                          {t('market.bestNet')}
                        </span>
                      )}
                      <p className="text-sm font-semibold">{item.mandi.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.mandi.district} · {item.mandi.distanceKm} km
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-foreground">
                      ₹{item.latestRecord.modalPricePerQuintal.toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-muted-foreground">{t('market.perQuintal')}</p>
                  </div>
                </div>
                <NetPriceBar net={item.estimatedNetPricePerQuintal} max={maxNet} />
                <div className="flex justify-between text-xs mt-1.5 text-muted-foreground">
                  <span>{t('market.transportCost')}: ₹{item.estimatedTransportCostPerQuintal}/{t('market.quintals')}</span>
                  <span className="font-semibold text-foreground">
                    {t('sell.netRealization')}: ₹{item.estimatedNetPricePerQuintal.toLocaleString('en-IN')}/{t('market.quintals')}
                  </span>
                </div>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground italic pt-1">
            {t('market.transportRateNote')}
          </p>
        </CardContent>
      </Card>

      <div className="h-2" />
    </div>
  );
}
