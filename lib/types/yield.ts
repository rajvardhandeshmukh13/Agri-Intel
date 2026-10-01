// lib/types/yield.ts
// Yield prediction input/output models

export interface YieldModelInputV1 {
  modelVersion: 'v1';
  crop: string;
  state: string;
  district: string;
  season: string; // 'kharif' | 'rabi'
  sowingDate: string; // ISO date
  areaHectares: number;
  soilType?: string;
  irrigationType?: string;
  // Weather aggregates (last 60 days from sowing)
  avgTempC: number;
  totalRainfallMm: number;
  avgHumidityPct: number;
  rainyDaysCount: number;
  // Satellite
  latestNdvi?: number;
  avgNdvi?: number;
  // Historical baseline
  historicalAvgYieldQPerHa: number;
}

export interface YieldExplanationFactor {
  factor: string; // human-readable label
  value: string; // formatted value with unit
  impactDirection: 'positive' | 'negative' | 'neutral';
  impactMagnitude: 'high' | 'medium' | 'low';
}

export interface YieldPrediction {
  farmSeasonId: string;
  predictedAt: string;
  modelVersion: string;
  expectedYieldQPerHa: number; // quintals per hectare
  totalHarvestQ: number; // quintals total for farm
  confidenceLow: number; // quintals per hectare
  confidenceHigh: number;
  explanation: YieldExplanationFactor[];
  inputSnapshot: YieldModelInputV1;
  source: 'ml-service' | 'demo';
}
