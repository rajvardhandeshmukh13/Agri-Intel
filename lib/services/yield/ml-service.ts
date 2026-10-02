// lib/services/yield/ml-service.ts
// Server-side adapter for the FastAPI ML sidecar.
// Calls ML_SERVICE_URL with 5-second timeout and schema mapping.

import type { IYieldService } from './interface';
import type { YieldModelInputV1, YieldPrediction, YieldExplanationFactor } from '@/lib/types/yield';

const DEFAULT_ML_SERVICE_URL = 'http://localhost:8000';
const REQUEST_TIMEOUT_MS = 5000;

interface RawExplanationFactor {
  factor: string;
  value: string;
  impact_direction?: string;
  impactDirection?: string;
  impact_magnitude?: string;
  impactMagnitude?: string;
}

interface RawYieldOutput {
  farm_season_id?: string;
  farmSeasonId?: string;
  model_version?: string;
  modelVersion?: string;
  expected_yield_q_per_ha?: number;
  expectedYieldQPerHa?: number;
  total_harvest_q?: number;
  totalHarvestQ?: number;
  confidence_low?: number;
  confidenceLow?: number;
  confidence_high?: number;
  confidenceHigh?: number;
  confidence_level?: string;
  confidenceLevel?: string;
  explanation?: RawExplanationFactor[];
  source?: string;
}

export class MLServiceAdapter implements IYieldService {
  private explicitBaseUrl?: string;

  constructor(baseUrl?: string) {
    this.explicitBaseUrl = baseUrl;
  }

  private getBaseUrl(): string {
    return (this.explicitBaseUrl ?? process.env.ML_SERVICE_URL ?? DEFAULT_ML_SERVICE_URL).replace(/\/+$/, '');
  }

  async checkHealth(): Promise<boolean> {
    try {
      const baseUrl = this.getBaseUrl();
      if (!baseUrl) return false;
      const signal = typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(2000) : undefined;
      const res = await fetch(`${baseUrl}/health`, { signal });
      if (!res.ok) return false;
      const data = await res.json() as { status?: string };
      return data.status === 'ok';
    } catch {
      return false;
    }
  }

  async predictYield(input: YieldModelInputV1): Promise<YieldPrediction> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      throw new Error('ML_SERVICE_URL is not configured');
    }

    const payload = {
      model_version: 'v1',
      crop: input.crop,
      state: input.state,
      district: input.district,
      season: input.season || 'kharif',
      sowing_date: input.sowingDate || new Date().toISOString().split('T')[0]!,
      area_hectares: input.areaHectares,
      soil_type: input.soilType ?? null,
      irrigation_type: input.irrigationType ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      avg_temp_c: input.avgTempC,
      total_rainfall_mm: input.totalRainfallMm,
      avg_humidity_pct: input.avgHumidityPct,
      rainy_days_count: input.rainyDaysCount,
      latest_ndvi: input.latestNdvi ?? null,
      avg_ndvi: input.avgNdvi ?? null,
      historical_avg_yield_q_per_ha: input.historicalAvgYieldQPerHa,
    };

    const signal = typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined;

    const res = await fetch(`${baseUrl}/predict/yield`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!res.ok) {
      throw new Error(`ML service responded with HTTP ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as RawYieldOutput;

    const expectedYield = data.expected_yield_q_per_ha ?? data.expectedYieldQPerHa;
    if (expectedYield === undefined || expectedYield === null || isNaN(expectedYield) || expectedYield <= 0) {
      throw new Error('Malformed ML service response: expected_yield_q_per_ha is missing or invalid');
    }

    const totalHarvest =
      data.total_harvest_q ??
      data.totalHarvestQ ??
      Math.round(expectedYield * input.areaHectares * 100) / 100;

    const explanation: YieldExplanationFactor[] = (data.explanation || []).map((f) => {
      const dir = (f.impact_direction || f.impactDirection || 'neutral') as 'positive' | 'negative' | 'neutral';
      const mag = (f.impact_magnitude || f.impactMagnitude || 'medium') as 'high' | 'medium' | 'low';
      return {
        factor: f.factor || 'Factor',
        value: f.value || '',
        impactDirection: dir,
        impactMagnitude: mag,
      };
    });

    const rawConfidence = data.confidence_level ?? data.confidenceLevel ?? 'moderate';
    const confidenceLevel: 'low' | 'moderate' | 'high' =
      rawConfidence === 'low' || rawConfidence === 'high' ? rawConfidence : 'moderate';

    return {
      farmSeasonId: data.farm_season_id || data.farmSeasonId || `season-${input.crop}-${input.season}-2024`,
      predictedAt: new Date().toISOString(),
      modelVersion: data.model_version || data.modelVersion || 'v1-rf',
      expectedYieldQPerHa: expectedYield,
      totalHarvestQ: totalHarvest,
      confidenceLow: data.confidence_low ?? data.confidenceLow ?? Math.round(expectedYield * 0.85 * 10) / 10,
      confidenceHigh: data.confidence_high ?? data.confidenceHigh ?? Math.round(expectedYield * 1.15 * 10) / 10,
      confidenceLevel,
      explanation,
      inputSnapshot: input,
      source: 'ml',
    };
  }
}
