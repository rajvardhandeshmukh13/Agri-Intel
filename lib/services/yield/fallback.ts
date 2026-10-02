// lib/services/yield/fallback.ts
// Deterministic rule-based yield baseline service.
// Used when the FastAPI ML service is unreachable, times out, or when running in offline/demo mode.

import type { IYieldService } from './interface';
import type { YieldModelInputV1, YieldPrediction, YieldExplanationFactor } from '@/lib/types/yield';

const CROP_BASELINES: Record<string, number> = {
  soybean: 19.5,
  wheat: 28.0,
  cotton: 14.5,
  onion: 95.0,
  tur: 11.0,
  jowar: 16.0,
  sugarcane: 850.0,
};

const SOIL_FACTORS: Record<string, number> = {
  black: 1.05,
  alluvial: 1.03,
  loamy: 1.02,
  red: 0.98,
  sandy: 0.92,
};

const IRRIGATION_FACTORS: Record<string, number> = {
  irrigated: 1.15,
  partial: 1.05,
  rainfed: 1.0,
};

const OPTIMAL_RAINFALL: Record<string, number> = {
  soybean: 600,
  wheat: 400,
  cotton: 550,
  onion: 500,
  tur: 650,
  jowar: 450,
  sugarcane: 1500,
};

export class DeterministicYieldService implements IYieldService {
  async predictYield(input: YieldModelInputV1): Promise<YieldPrediction> {
    const cropKey = (input.crop || 'soybean').toLowerCase();
    const base = CROP_BASELINES[cropKey] ?? input.historicalAvgYieldQPerHa ?? 19.5;

    let yieldQPerHa = input.historicalAvgYieldQPerHa > 0 ? input.historicalAvgYieldQPerHa : base;
    const explanation: YieldExplanationFactor[] = [];

    // 1. Historical baseline
    explanation.push({
      factor: 'Historical yield data',
      value: `Avg ${yieldQPerHa.toFixed(1)} qtl/ha in ${input.district} (last 5 years)`,
      impactDirection: 'positive',
      impactMagnitude: 'high',
    });

    // 2. Weather & rainfall impact
    const optimalRain = OPTIMAL_RAINFALL[cropKey] ?? 550;
    const rain = input.totalRainfallMm > 0 ? input.totalRainfallMm : optimalRain;
    const rainRatio = rain / optimalRain;
    const rainMultiplier = Math.max(0.75, Math.min(1.15, rainRatio));
    const rainDiff = Math.abs(rain - optimalRain) / optimalRain;
    yieldQPerHa *= rainMultiplier;

    explanation.push({
      factor: 'Weather conditions',
      value: `${Math.round(rain)} mm rainfall — ${rainDiff < 0.2 ? 'near optimal' : 'variable precipitation'}`,
      impactDirection: rainDiff < 0.15 ? 'positive' : rainDiff < 0.3 ? 'neutral' : 'negative',
      impactMagnitude: 'medium',
    });

    // 3. Satellite NDVI health impact
    if (input.latestNdvi !== undefined && input.latestNdvi !== null) {
      const ndvi = input.latestNdvi;
      const ndviMultiplier = 0.8 + ndvi * 0.4; // 0.8 to 1.2
      yieldQPerHa *= ndviMultiplier;

      explanation.push({
        factor: 'Crop health (NDVI)',
        value: `Peak NDVI ${ndvi.toFixed(2)} — ${ndvi > 0.6 ? 'good' : ndvi > 0.4 ? 'moderate' : 'low'} vegetation`,
        impactDirection: ndvi > 0.6 ? 'positive' : ndvi > 0.4 ? 'neutral' : 'negative',
        impactMagnitude: 'medium',
      });
    }

    // 4. Soil factor
    const soilKey = (input.soilType || 'black').toLowerCase();
    const soilFactor = SOIL_FACTORS[soilKey] ?? 1.0;
    yieldQPerHa *= soilFactor;

    explanation.push({
      factor: 'Soil type',
      value: `${input.soilType || 'Standard'} soil — ${soilFactor >= 1.0 ? 'suitable' : 'moderate'} for ${input.crop}`,
      impactDirection: soilFactor >= 1.0 ? 'positive' : 'neutral',
      impactMagnitude: 'low',
    });

    // 5. Irrigation factor
    const irrKey = (input.irrigationType || 'rainfed').toLowerCase();
    const irrFactor = IRRIGATION_FACTORS[irrKey] ?? 1.0;
    yieldQPerHa *= irrFactor;

    if (input.irrigationType && input.irrigationType !== 'rainfed') {
      explanation.push({
        factor: 'Irrigation',
        value: `${input.irrigationType} — beneficial for yield stability`,
        impactDirection: 'positive',
        impactMagnitude: 'low',
      });
    }

    const finalYieldQPerHa = Math.round(yieldQPerHa * 10) / 10;
    const totalHarvestQ = Math.round(finalYieldQPerHa * input.areaHectares * 100) / 100;

    // Confidence interval: ±15%
    const confidenceLow = Math.round(finalYieldQPerHa * 0.85 * 10) / 10;
    const confidenceHigh = Math.round(finalYieldQPerHa * 1.15 * 10) / 10;

    return {
      farmSeasonId: `season-${cropKey}-${input.season || 'kharif'}-2024`,
      predictedAt: new Date().toISOString(),
      modelVersion: 'v1-deterministic-baseline',
      expectedYieldQPerHa: finalYieldQPerHa,
      totalHarvestQ,
      confidenceLow,
      confidenceHigh,
      confidenceLevel: 'moderate',
      explanation,
      inputSnapshot: input,
      source: 'fallback',
    };
  }

  async checkHealth(): Promise<boolean> {
    return true; // Deterministic fallback is always available
  }
}
