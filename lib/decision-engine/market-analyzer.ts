// lib/decision-engine/market-analyzer.ts
// Analyzes market data to produce trend signals used by the sell-window engine.

import type { MarketRecord, PriceTrend } from '@/lib/types/market';

export interface MarketSignals {
  trend: PriceTrend;
  currentModalPrice: number;
  projectedPrice7d: number;
  projectedPrice14d: number;
  arrivalsTrend: 'increasing' | 'stable' | 'decreasing';
  volatilityPct: number;
}

/**
 * Compute price trend from a sorted array of market records.
 * Records must be sorted oldest-first.
 */
export function computePriceTrend(records: MarketRecord[]): PriceTrend {
  if (records.length < 2) {
    return {
      direction: 'stable',
      sevenDayChange: 0,
      thirtyDayChange: 0,
      momentum: 'weak',
      seasonalIndex: 1.0,
    };
  }

  const sorted = [...records].sort((a, b) => a.recordedDate.localeCompare(b.recordedDate));
  const latest = sorted[sorted.length - 1]!.modalPricePerQuintal;
  // ~4 trading days back for 7-day window
  const sevenDayIndex = Math.max(0, sorted.length - 4);
  const sevenDayPrice = sorted[sevenDayIndex]!.modalPricePerQuintal;
  const thirtyDayPrice = sorted[0]!.modalPricePerQuintal;

  const sevenDayChange = ((latest - sevenDayPrice) / sevenDayPrice) * 100;
  const thirtyDayChange = ((latest - thirtyDayPrice) / thirtyDayPrice) * 100;

  const direction: PriceTrend['direction'] =
    sevenDayChange > 1.5 ? 'rising' : sevenDayChange < -1.5 ? 'falling' : 'stable';

  const momentum: PriceTrend['momentum'] =
    Math.abs(sevenDayChange) > 4 ? 'strong' : Math.abs(sevenDayChange) > 1.5 ? 'moderate' : 'weak';

  return {
    direction,
    sevenDayChange: parseFloat(sevenDayChange.toFixed(1)),
    thirtyDayChange: parseFloat(thirtyDayChange.toFixed(1)),
    momentum,
    seasonalIndex: 1.05,
  };
}

/**
 * Project future price based on trend momentum.
 * Simple linear extrapolation with dampening — not a financial forecast.
 * Returns are labeled "estimated" in the UI.
 */
export function projectFuturePrice(currentPrice: number, trend: PriceTrend, daysAhead: number): number {
  // Dampen the weekly rate for forward projection
  const weeklyRate = trend.sevenDayChange / 100;
  // Apply 50% dampening for uncertainty at longer horizons
  const dampened = weeklyRate * 0.5;
  const weeks = daysAhead / 7;
  const projected = currentPrice * Math.pow(1 + dampened, weeks);
  return Math.round(projected);
}

/**
 * Compute standard deviation of modal prices as a volatility proxy.
 */
function computeVolatility(records: MarketRecord[]): number {
  if (records.length < 2) return 0;
  const prices = records.map((r) => r.modalPricePerQuintal);
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
  return parseFloat(((Math.sqrt(variance) / mean) * 100).toFixed(1)); // as percentage
}

/**
 * Compute arrival trend from records.
 */
function computeArrivalsTrend(records: MarketRecord[]): 'increasing' | 'stable' | 'decreasing' {
  const withArrivals = records.filter((r) => r.arrivalsQuintals !== undefined);
  if (withArrivals.length < 2) return 'stable';
  const sorted = [...withArrivals].sort((a, b) => a.recordedDate.localeCompare(b.recordedDate));
  const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
  const secondHalf = sorted.slice(Math.floor(sorted.length / 2));
  const avgFirst = firstHalf.reduce((s, r) => s + (r.arrivalsQuintals ?? 0), 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((s, r) => s + (r.arrivalsQuintals ?? 0), 0) / secondHalf.length;
  if (avgSecond > avgFirst * 1.1) return 'increasing';
  if (avgSecond < avgFirst * 0.9) return 'decreasing';
  return 'stable';
}

/**
 * Produce all market signals needed by the sell-window engine.
 */
export function analyzeMarket(records: MarketRecord[]): MarketSignals {
  const sorted = [...records].sort((a, b) => a.recordedDate.localeCompare(b.recordedDate));
  const currentRecord = sorted[sorted.length - 1];
  const currentModalPrice = currentRecord?.modalPricePerQuintal ?? 0;
  const trend = computePriceTrend(sorted);

  return {
    trend,
    currentModalPrice,
    projectedPrice7d: projectFuturePrice(currentModalPrice, trend, 7),
    projectedPrice14d: projectFuturePrice(currentModalPrice, trend, 14),
    arrivalsTrend: computeArrivalsTrend(sorted),
    volatilityPct: computeVolatility(sorted),
  };
}
