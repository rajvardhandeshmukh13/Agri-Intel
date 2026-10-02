// lib/types/yield.ts
// Yield prediction input/output models

export interface YieldModelInputV1 {
  modelVersion: 'v1';
  crop: string;
  state: string;
  district: string;
  season: string; // 'kharif' | 'rabi'
  sowingDate: string; // ISO date string (YYYY-MM-DD)
  areaHectares: number; // Farm area in hectares (ha)
  latitude?: number; // Farm latitude
  longitude?: number; // Farm longitude
  soilType?: string; // e.g. 'black', 'red', 'alluvial'
  irrigationType?: string; // e.g. 'rainfed', 'irrigated', 'partial'
  // Weather aggregates (last 60 days from sowing / forecast)
  avgTempC: number; // Average temperature in Celsius (°C)
  totalRainfallMm: number; // Cumulative rainfall in millimeters (mm)
  avgHumidityPct: number; // Relative humidity percentage (0-100%)
  rainyDaysCount: number; // Days with significant rainfall
  // Satellite vegetation indicators
  latestNdvi?: number; // Normalized Difference Vegetation Index (-1.0 to 1.0)
  avgNdvi?: number; // Average NDVI across recent observation passes
  // Historical baseline
  historicalAvgYieldQPerHa: number; // Historical baseline yield in quintals per hectare (qtl/ha)
}

export interface YieldExplanationFactor {
  factor: string; // human-readable label
  value: string; // formatted value with explicit unit
  impactDirection: 'positive' | 'negative' | 'neutral';
  impactMagnitude: 'high' | 'medium' | 'low';
}

export interface YieldPrediction {
  farmSeasonId: string;
  predictedAt: string; // ISO timestamp
  modelVersion: string; // e.g. 'v1-rule-based', 'v1-rf', 'v1-deterministic-baseline'
  expectedYieldQPerHa: number; // quintals per hectare (qtl/ha)
  totalHarvestQ: number; // quintals total for farm (qtl)
  confidenceLow: number; // quintals per hectare (qtl/ha)
  confidenceHigh: number; // quintals per hectare (qtl/ha)
  confidenceLevel?: 'low' | 'moderate' | 'high'; // qualitative confidence rating
  explanation: YieldExplanationFactor[];
  inputSnapshot?: YieldModelInputV1;
  source: 'ml' | 'ml-service' | 'fallback' | 'demo';
}
