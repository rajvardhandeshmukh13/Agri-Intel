// lib/types/decision-engine.ts
// Types for the net-profit decision engine.
// Mandi data comes from Agmarknet (modal prices + arrivals), yield features
// from Sentinel-2 NDVI and Open-Meteo weather via the ml-service.

export interface AgmarknetMandiData {
  mandi_id: string;
  mandi_name: string;
  modal_price_per_qtl: number;
  arrivals_tonnes: number;
  distance_km: number;
  freight_rate_per_km_qtl: number;
  mandi_fee_pct: number;
  handling_cost_per_qtl: number;
}

export interface YieldPredictionFeatures {
  ndvi_mean: number;
  ndvi_peak: number;
  total_rainfall_mm: number;
  growing_degree_days: number;
  soil_moisture: number;
}

export interface ProfitBreakdown {
  mandi_id: string;
  mandi_name: string;
  predicted_yield_qtl: number;
  gross_revenue: number;
  transport_cost: number;
  mandi_fees: number;
  production_cost: number;
  net_profit: number;
  profit_margin_pct: number;
}
