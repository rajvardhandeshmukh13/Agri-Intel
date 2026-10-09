// lib/services/price-forecast/index.ts
// Price forecast via the FastAPI ML sidecar (POST /predict/price), with automatic
// fallback to the original trend-extrapolation heuristic so the decision engine
// never breaks when the ML service is down, untrained, or in demo mode.

import type { MarketRecord } from '@/lib/types/market';
import type { PriceForecast, PriceForecastPoint, PriceDriver } from '@/lib/types/price-forecast';
import { analyzeMarket } from '@/lib/decision-engine/market-analyzer';

const DEFAULT_ML_SERVICE_URL = 'http://localhost:8000';
const REQUEST_TIMEOUT_MS = 4000;
const MAX_RECORDS = 40;

interface RawForecast {
  horizon_days: number;
  p10: number;
  p50: number;
  p90: number;
}
interface RawDriver {
  factor: string;
  value: string;
  impact_direction?: string;
  impact_magnitude?: string;
}
interface RawPriceOutput {
  model_version?: string;
  current_price?: number;
  forecasts?: RawForecast[];
  drivers?: RawDriver[];
}

function baseUrl(): string {
  return (process.env.ML_SERVICE_URL ?? DEFAULT_ML_SERVICE_URL).replace(/\/+$/, '');
}

async function predictViaML(commodity: string, records: MarketRecord[]): Promise<PriceForecast> {
  const recent = [...records]
    .sort((a, b) => a.recordedDate.localeCompare(b.recordedDate))
    .slice(-MAX_RECORDS);

  if (recent.length < 3) throw new Error('Not enough price history for ML forecast');

  const signal = typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined;
  const res = await fetch(`${baseUrl()}/predict/price`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      crop: commodity.toLowerCase(),
      records: recent.map((r) => ({
        date: r.recordedDate,
        modal_price: r.modalPricePerQuintal,
        arrivals: r.arrivalsQuintals ?? null,
      })),
    }),
    signal,
  });
  if (!res.ok) throw new Error(`ML price service responded with HTTP ${res.status}`);

  const data = (await res.json()) as RawPriceOutput;
  const forecasts: PriceForecastPoint[] = [];
  for (const f of data.forecasts ?? []) {
    if ((f.horizon_days === 7 || f.horizon_days === 14) && [f.p10, f.p50, f.p90].every((n) => Number.isFinite(n) && n > 0)) {
      forecasts.push({ horizonDays: f.horizon_days, p10: f.p10, p50: f.p50, p90: f.p90 });
    }
  }
  if (!forecasts.some((f) => f.horizonDays === 7) || !forecasts.some((f) => f.horizonDays === 14)) {
    throw new Error('Malformed ML price response: missing 7d/14d forecast');
  }

  const drivers: PriceDriver[] = (data.drivers ?? []).map((d) => ({
    factor: d.factor,
    value: d.value,
    impactDirection: (['positive', 'negative', 'neutral'].includes(d.impact_direction ?? '') ? d.impact_direction : 'neutral') as PriceDriver['impactDirection'],
    impactMagnitude: (['high', 'medium', 'low'].includes(d.impact_magnitude ?? '') ? d.impact_magnitude : 'medium') as PriceDriver['impactMagnitude'],
  }));

  return {
    modelVersion: data.model_version ?? 'price-v1',
    currentPrice: data.current_price ?? recent[recent.length - 1]!.modalPricePerQuintal,
    forecasts,
    drivers,
    source: 'ml',
  };
}

/** Original heuristic (damped trend extrapolation + volatility band) in forecast shape. */
export function heuristicPriceForecast(records: MarketRecord[]): PriceForecast {
  const signals = analyzeMarket(records);
  const band = (p: number, days: number) => {
    const spread = Math.min((signals.volatilityPct * (days / 30)) / 100, 0.25);
    return { p10: Math.round(p * (1 - spread)), p90: Math.round(p * (1 + spread)) };
  };
  const mk = (days: 7 | 14, p50: number): PriceForecastPoint => ({ horizonDays: days, p50, ...band(p50, days) });
  return {
    modelVersion: 'heuristic-v1',
    currentPrice: signals.currentModalPrice,
    forecasts: [mk(7, signals.projectedPrice7d), mk(14, signals.projectedPrice14d)],
    drivers: [],
    source: 'heuristic',
  };
}

export async function predictPriceWithFallback(
  commodity: string,
  records: MarketRecord[],
  options: { forceDemo?: boolean } = {}
): Promise<PriceForecast> {
  if (options.forceDemo) return heuristicPriceForecast(records);
  try {
    return await predictViaML(commodity, records);
  } catch (err) {
    console.warn(
      `[PriceForecast] ML unavailable for "${commodity}", using heuristic:`,
      err instanceof Error ? err.message : err
    );
    return heuristicPriceForecast(records);
  }
}
