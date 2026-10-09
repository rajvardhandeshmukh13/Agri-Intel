// lib/types/price-forecast.ts
// Mandi price forecast types (ML quantile forecast with heuristic fallback)

export interface PriceForecastPoint {
  horizonDays: 7 | 14;
  p10: number; // pessimistic modal price INR/qtl
  p50: number; // median expectation
  p90: number; // optimistic
}

export interface PriceDriver {
  factor: string;
  value: string;
  impactDirection: 'positive' | 'negative' | 'neutral';
  impactMagnitude: 'high' | 'medium' | 'low';
}

export interface PriceForecast {
  modelVersion: string;
  currentPrice: number;
  forecasts: PriceForecastPoint[];
  drivers: PriceDriver[];
  source: 'ml' | 'heuristic';
}
