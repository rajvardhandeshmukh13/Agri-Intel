// app/api/recommendations/route.ts
// Selling recommendation API route — runs the actual selling decision engine
// using farm-specific profile and context.

import { NextRequest, NextResponse } from 'next/server';
import { computeSellRecommendation } from '@/lib/decision-engine/sell-window';
import { fetchPriceHistory, fetchNearbyMandiComparison } from '@/lib/services/market';
import { fetchWeatherForecast } from '@/lib/services/weather';
import { predictYieldWithFallback } from '@/lib/services/yield';
import { predictPriceWithFallback } from '@/lib/services/price-forecast';
import satelliteData from '@/data/demo/satellite-health.json';

import {
  DISTRICT_COORDINATES,
  CROP_BASELINES,
  CROP_INPUT_COSTS,
  SOIL_FACTORS,
  IRRIGATION_FACTORS,
} from '@/lib/utils/farm-storage';
import demoRec from '@/data/demo/recommendation.json';
import demoYield from '@/data/demo/yield-prediction.json';
import type { YieldPrediction, YieldModelInputV1 } from '@/lib/types/yield';
import type { SoilType, IrrigationType } from '@/lib/types/farm';

export interface RecommendationRequestBody {
  farmSeasonId?: string;
  crop?: string;
  commodity?: string;
  area?: number | string;
  areaHectares?: number | string;
  sowingDate?: string;
  lat?: number | string;
  latitude?: number | string;
  lng?: number | string;
  longitude?: number | string;
  district?: string;
  village?: string;
  state?: string;
  mandi?: string;
  inputCosts?: number | string;
  inputCostPerHa?: number | string;
  inputCostTotal?: number | string;
  soilType?: SoilType | string;
  irrigationType?: IrrigationType | string;
  totalHarvestQ?: number | string;
  expectedYieldQPerHa?: number | string;
  forceDemo?: boolean;
  demo?: boolean;
}

function resolveFarmContext(body: RecommendationRequestBody) {
  const commodity = String(body.commodity || body.crop || 'soybean').toLowerCase();
  const farmSeasonId = body.farmSeasonId || `season-${commodity}-kharif-2024`;
  const district = body.district || 'Latur';
  const state = body.state || 'Maharashtra';

  // Resolve coordinates
  const coords = DISTRICT_COORDINATES[district] ?? { lat: 18.2333, lng: 76.7167, nearestMandi: 'Latur' };
  const rawLat = body.lat ?? body.latitude;
  const rawLng = body.lng ?? body.longitude;
  const lat = rawLat !== undefined && !isNaN(Number(rawLat)) ? Number(rawLat) : coords.lat;
  const lng = rawLng !== undefined && !isNaN(Number(rawLng)) ? Number(rawLng) : coords.lng;

  // Resolve mandi
  const mandi = body.mandi || coords.nearestMandi || 'Latur';

  // Resolve farm area
  const rawArea = body.areaHectares ?? body.area;
  const parsedArea = rawArea !== undefined ? parseFloat(String(rawArea)) : 3.5;
  const validArea = isNaN(parsedArea) || parsedArea <= 0 ? 3.5 : parsedArea;

  // Calculate yield
  const baseYield = CROP_BASELINES[commodity] ?? demoYield.expectedYieldQPerHa ?? 19.5;
  const soilFactor = body.soilType ? (SOIL_FACTORS[body.soilType] ?? 1.0) : 1.0;
  const irrFactor = body.irrigationType ? (IRRIGATION_FACTORS[body.irrigationType] ?? 1.0) : 1.0;
  const expectedYieldQPerHa = Math.round(baseYield * soilFactor * irrFactor * 10) / 10;

  // Total harvest
  const rawHarvest = body.totalHarvestQ;
  const totalHarvestQ = rawHarvest !== undefined && !isNaN(Number(rawHarvest))
    ? Number(rawHarvest)
    : Math.round(validArea * expectedYieldQPerHa * 100) / 100;

  // Input costs
  let inputCostTotal: number;
  if (body.inputCostTotal !== undefined && !isNaN(Number(body.inputCostTotal))) {
    inputCostTotal = Number(body.inputCostTotal);
  } else if (body.inputCostPerHa !== undefined && !isNaN(Number(body.inputCostPerHa))) {
    inputCostTotal = Math.round(validArea * Number(body.inputCostPerHa));
  } else if (body.inputCosts !== undefined && !isNaN(Number(body.inputCosts))) {
    inputCostTotal = Math.round(validArea * Number(body.inputCosts));
  } else {
    const defaultCostPerHa = CROP_INPUT_COSTS[commodity] ?? 18000;
    inputCostTotal = Math.round(validArea * defaultCostPerHa);
  }

  return {
    commodity,
    farmSeasonId,
    district,
    state,
    mandi,
    lat,
    lng,
    validArea,
    expectedYieldQPerHa,
    totalHarvestQ,
    inputCostTotal,
    sowingDate: body.sowingDate || '2024-06-20',
  };
}

export async function POST(request: NextRequest) {
  try {
    let body: RecommendationRequestBody = {};
    try {
      body = (await request.json()) as RecommendationRequestBody;
    } catch {
      // Empty or invalid JSON body — use default context
      body = {};
    }

    const { searchParams } = new URL(request.url);
    const forceDemo =
      body.forceDemo === true ||
      body.demo === true ||
      searchParams.get('mode') === 'demo' ||
      searchParams.get('demo') === 'true';

    const ctx = resolveFarmContext(body);

    let recommendation: ReturnType<typeof computeSellRecommendation>;
    let actualYieldPrediction: YieldPrediction | null = null;
    try {
      // Run the actual selling decision engine with current farm context
      const [marketRecords, nearbyMandis, forecast] = await Promise.all([
        fetchPriceHistory(ctx.commodity, ctx.mandi, ctx.state, 30, { forceDemo }),
        fetchNearbyMandiComparison(ctx.commodity, ctx.state, ctx.lat, ctx.lng, { forceDemo }),
        fetchWeatherForecast(ctx.lat, ctx.lng, { days: 14, forceDemo }),
      ]);

      // Weather aggregates from forecast for ML yield input
      const forecastDays = forecast?.days || [];
      const avgTempC = forecastDays.length > 0
        ? Math.round((forecastDays.reduce((sum, d) => sum + d.tempMaxC, 0) / forecastDays.length) * 10) / 10
        : 28.5;
      const totalRainfallMm = forecastDays.length > 0
        ? Math.round(forecastDays.reduce((sum, d) => sum + d.rainfallMm, 0) * 4 * 10) / 10
        : 580;
      const avgHumidityPct = forecastDays.length > 0
        ? Math.round(forecastDays.reduce((sum, d) => sum + d.humidityPct, 0) / forecastDays.length)
        : 75;
      const rainyDaysCount = forecastDays.length > 0
        ? forecastDays.filter((d) => d.rainfallMm > 2).length * 4
        : 20;

      // Build ML Yield Input with all supported features and coordinates
      const yieldInput: YieldModelInputV1 = {
        modelVersion: 'v1',
        crop: ctx.commodity,
        state: ctx.state,
        district: ctx.district,
        season: 'kharif',
        sowingDate: ctx.sowingDate,
        areaHectares: ctx.validArea,
        latitude: ctx.lat,
        longitude: ctx.lng,
        soilType: (body.soilType as string) || 'black',
        irrigationType: (body.irrigationType as string) || 'rainfed',
        avgTempC,
        totalRainfallMm,
        avgHumidityPct,
        rainyDaysCount,
        latestNdvi: satelliteData.latestNdvi ?? 0.68,
        avgNdvi: satelliteData.readings && satelliteData.readings.length > 0
          ? Math.round((satelliteData.readings.reduce((sum, r) => sum + r.ndvi, 0) / satelliteData.readings.length) * 100) / 100
          : 0.62,
        historicalAvgYieldQPerHa: CROP_BASELINES[ctx.commodity] ?? 19.5,
      };

      // Predict yield via FastAPI ML service with automatic deterministic fallback
      const yieldPrediction = await predictYieldWithFallback(yieldInput, { forceDemo });

      // Allow manual client override if specified, otherwise use predicted values
      if (body.totalHarvestQ !== undefined && !isNaN(Number(body.totalHarvestQ))) {
        yieldPrediction.totalHarvestQ = Number(body.totalHarvestQ);
      }
      if (body.expectedYieldQPerHa !== undefined && !isNaN(Number(body.expectedYieldQPerHa))) {
        yieldPrediction.expectedYieldQPerHa = Number(body.expectedYieldQPerHa);
      }

      actualYieldPrediction = yieldPrediction;

      // ML price forecast (7d / 14d bands) with heuristic fallback
      const priceForecast = await predictPriceWithFallback(ctx.commodity, marketRecords, { forceDemo });

      recommendation = computeSellRecommendation({
        farmSeasonId: ctx.farmSeasonId,
        yieldPrediction,
        marketRecords,
        nearbyMandis,
        weatherForecast: forecast,
        inputCostTotal: ctx.inputCostTotal,
        commodity: ctx.commodity,
        priceForecast,
      });

      // Attach yield source and explanation factors to recommendation
      recommendation.yieldSource = yieldPrediction.source;
      recommendation.yieldExplanation = yieldPrediction.explanation;
      recommendation.expectedYieldQPerHa = yieldPrediction.expectedYieldQPerHa;
      recommendation.totalHarvestQ = yieldPrediction.totalHarvestQ;
      recommendation.yieldConfidenceLow = yieldPrediction.confidenceLow;
      recommendation.yieldConfidenceHigh = yieldPrediction.confidenceHigh;
    } catch (engineErr) {
      console.warn('[api/recommendations] Engine computation failed, using fallback:', engineErr);
      recommendation = {
        ...demoRec,
        source: 'demo' as const,
      } as ReturnType<typeof computeSellRecommendation>;
    }

    return NextResponse.json({
      data: recommendation,
      farmContext: {
        crop: ctx.commodity,
        areaHectares: ctx.validArea,
        totalHarvestQ: actualYieldPrediction?.totalHarvestQ ?? ctx.totalHarvestQ,
        expectedYieldQPerHa: actualYieldPrediction?.expectedYieldQPerHa ?? ctx.expectedYieldQPerHa,
        yieldSource: actualYieldPrediction?.source ?? 'fallback',
        confidenceLow: actualYieldPrediction?.confidenceLow,
        confidenceHigh: actualYieldPrediction?.confidenceHigh,
        district: ctx.district,
        state: ctx.state,
        mandi: ctx.mandi,
        inputCostTotal: ctx.inputCostTotal,
        sowingDate: ctx.sowingDate,
      },
    });
  } catch (err) {
    console.error('[api/recommendations] Error:', err instanceof Error ? err.message : 'Unknown');
    return NextResponse.json({ error: 'Failed to compute recommendation' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const body: RecommendationRequestBody = {
    crop: searchParams.get('crop') ?? undefined,
    commodity: searchParams.get('commodity') ?? undefined,
    area: searchParams.get('area') ?? undefined,
    areaHectares: searchParams.get('areaHectares') ?? undefined,
    district: searchParams.get('district') ?? undefined,
    state: searchParams.get('state') ?? undefined,
    mandi: searchParams.get('mandi') ?? undefined,
    sowingDate: searchParams.get('sowingDate') ?? undefined,
    soilType: searchParams.get('soilType') ?? undefined,
    irrigationType: searchParams.get('irrigationType') ?? undefined,
    lat: searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : undefined,
    lng: searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : undefined,
    forceDemo: searchParams.get('demo') === 'true' || searchParams.get('mode') === 'demo',
  };

  const req = new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

  return POST(req);
}
