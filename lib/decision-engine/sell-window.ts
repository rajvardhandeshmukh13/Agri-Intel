// lib/decision-engine/sell-window.ts
// Core selling decision engine.
// Evaluates sell-now vs wait-7d vs wait-14d scenarios and picks the best.
// All outputs are labeled estimates — not guarantees.

import type { Scenario, SellRecommendation, SellWindow, RiskLevel, ConfidenceLevel } from '@/lib/types/recommendation';
import type { YieldPrediction } from '@/lib/types/yield';
import type { MandiComparison } from '@/lib/types/market';
import type { WeatherForecast } from '@/lib/types/weather';
import { analyzeMarket } from './market-analyzer';
import { calculateProfit, estimateTransportCostPerQtl } from './profit-calculator';
import type { MarketRecord } from '@/lib/types/market';

export interface SellWindowInput {
  farmSeasonId: string;
  yieldPrediction: YieldPrediction;
  marketRecords: MarketRecord[];
  nearbyMandis: MandiComparison[];
  weatherForecast: WeatherForecast;
  inputCostTotal: number; // total farm input cost in INR
  commodity?: string;
}

function assessWeatherRisk(forecast: WeatherForecast, daysAhead: number): RiskLevel {
  const relevantDays = forecast.days.slice(0, daysAhead);
  const extremeCount = relevantDays.filter((d) => d.isExtremeRisk).length;
  const heavyRainCount = relevantDays.filter((d) => d.rainfallMm > 15).length;
  if (extremeCount >= 2 || heavyRainCount >= 3) return 'high';
  if (extremeCount >= 1 || heavyRainCount >= 1) return 'moderate';
  return 'low';
}

function priceRiskFromVolatility(volatilityPct: number, daysAhead: number): number {
  // Wider uncertainty for longer horizons
  const baseRisk = volatilityPct * (daysAhead / 30);
  return parseFloat(Math.min(baseRisk, 25).toFixed(1));
}

function deriveRiskLevel(weatherRisk: RiskLevel, priceRiskPct: number, daysAhead: number): RiskLevel {
  const priceRiskLevel: RiskLevel = priceRiskPct > 12 ? 'high' : priceRiskPct > 6 ? 'moderate' : 'low';
  // Combine: take the higher risk
  const levels: RiskLevel[] = ['low', 'moderate', 'high'];
  const combined = Math.max(levels.indexOf(weatherRisk), levels.indexOf(priceRiskLevel));
  // Add horizon penalty
  const horizon = daysAhead > 7 ? 1 : 0;
  return levels[Math.min(2, combined + horizon)] as RiskLevel;
}

function deriveConfidence(scenario: Omit<Scenario, 'confidence'>): ConfidenceLevel {
  if (scenario.window === 'now') return 'high';
  if (scenario.riskLevel === 'high') return 'low';
  if (scenario.riskLevel === 'moderate') return 'moderate';
  return 'high';
}

function buildReasons(
  bestWindow: SellWindow,
  signals: ReturnType<typeof analyzeMarket>,
  weatherRisk: RiskLevel,
  bestMandi: MandiComparison,
  commodity: string = 'soybean'
): string[] {
  const reasons: string[] = [];
  const cropLabel = commodity.charAt(0).toUpperCase() + commodity.slice(1);

  // Price trend
  if (signals.trend.direction === 'rising' && bestWindow !== 'now') {
    reasons.push(`${cropLabel} prices have risen ${signals.trend.sevenDayChange}% in the past week — momentum is positive`);
  } else if (signals.trend.direction === 'falling') {
    reasons.push(`${cropLabel} prices have softened recently (${signals.trend.sevenDayChange}%) — selling sooner reduces downside risk`);
  } else {
    reasons.push(`${cropLabel} price trend is relatively stable — moderate opportunity to wait`);
  }

  // Arrivals
  if (signals.arrivalsTrend === 'increasing') {
    reasons.push(`Arrivals at mandis are rising — larger supply may soften prices over the next 2 weeks`);
  } else if (signals.arrivalsTrend === 'decreasing') {
    reasons.push(`Market arrivals are low — lower supply may support or strengthen prices`);
  } else {
    reasons.push(`Mandi arrivals are stable — no immediate supply-side pressure`);
  }

  // Weather
  if (weatherRisk === 'high') {
    reasons.push(`Heavy rain forecast in the next 5 days — delays in harvesting or transport are possible`);
  } else if (weatherRisk === 'moderate') {
    reasons.push(`Some rain expected this week — plan transport timing accordingly`);
  } else {
    reasons.push(`Weather outlook is favorable for the next 7 days — good transport window`);
  }

  // Mandi
  reasons.push(
    `${bestMandi.mandi.name} offers the best estimated net price after transport — ₹${bestMandi.estimatedNetPricePerQuintal.toLocaleString('en-IN')}/qtl`
  );

  // Strategy explanation
  if (bestWindow === '7_days') {
    reasons.push(`Waiting ~7 days projects higher net returns after accounting for transport and holding risk`);
  } else if (bestWindow === '14_days') {
    reasons.push(`A 14-day hold indicates maximum upside potential if weather and market trends remain stable`);
  } else {
    reasons.push(`Selling now locks in current favorable mandi rates and avoids holding risk`);
  }

  return reasons.slice(0, 5);
}

export function computeSellRecommendation(input: SellWindowInput): SellRecommendation {
  const {
    farmSeasonId,
    yieldPrediction,
    marketRecords,
    nearbyMandis,
    weatherForecast,
    inputCostTotal,
    commodity = 'soybean',
  } = input;

  const signals = analyzeMarket(marketRecords);
  const bestMandi = nearbyMandis[0] ?? {
    mandi: { name: 'Latur', district: 'Latur', state: 'Maharashtra', lat: 18.4088, lng: 76.5604, distanceKm: 15 },
    latestRecord: marketRecords[0] ?? {
      id: 'fallback-record',
      commodity,
      mandiName: 'Latur',
      state: 'Maharashtra',
      district: 'Latur',
      recordedDate: '2024-10-01',
      minPricePerQuintal: 4150,
      maxPricePerQuintal: 4420,
      modalPricePerQuintal: 4280,
      source: 'demo' as const,
    },
    estimatedTransportCostPerQuintal: 5,
    estimatedNetPricePerQuintal: 4275,
    priceRank: 1,
  };
  const totalHarvestQ = yieldPrediction.totalHarvestQ;
  const transportCostPerQtl = estimateTransportCostPerQtl(bestMandi.mandi.distanceKm);

  const weatherRiskNow = assessWeatherRisk(weatherForecast, 3);
  const weatherRisk7d = assessWeatherRisk(weatherForecast, 7);
  const weatherRisk14d = assessWeatherRisk(weatherForecast, 14);

  function buildScenario(window: SellWindow, daysAhead: number, weatherRisk: RiskLevel): Scenario {
    const baseModalPrice =
      bestMandi.latestRecord?.modalPricePerQuintal || signals.currentModalPrice || 4280;
    const weeklyRate = (signals.trend.sevenDayChange || 3.0) / 100;
    const projected7d = Math.round(baseModalPrice * (1 + weeklyRate * 0.5));
    const projected14d = Math.round(baseModalPrice * Math.pow(1 + weeklyRate * 0.5, 2));

    const priceMap = {
      now: baseModalPrice,
      '7_days': projected7d,
      '14_days': projected14d,
    };
    const labelMap = { now: 'Sell Now', '7_days': 'Wait ~7 Days', '14_days': 'Wait ~14 Days' };
    const estimatedPrice = priceMap[window];
    const profit = calculateProfit({
      totalHarvestQ,
      mandiName: bestMandi.mandi.name,
      modalPricePerQuintal: estimatedPrice,
      transportCostPerQuintal: transportCostPerQtl,
      sellingCostPct: 0.02,
      inputCostTotal,
    });
    const priceRiskPct = priceRiskFromVolatility(signals.volatilityPct, daysAhead);
    const riskLevel = deriveRiskLevel(weatherRisk, priceRiskPct, daysAhead);

    const partialScenario: Omit<Scenario, 'confidence'> = {
      window,
      label: labelMap[window],
      mandi: bestMandi.mandi.name,
      estimatedModalPricePerQuintal: estimatedPrice,
      estimatedGross: profit.grossRevenue,
      transportCostTotal: profit.transportCost,
      sellingCostTotal: profit.sellingCost,
      farmCostTotal: Math.round(inputCostTotal),
      estimatedNet: profit.netRealization,
      riskLevel,
      weatherRisk,
      priceRiskPct,
    };

    return { ...partialScenario, confidence: deriveConfidence(partialScenario) };
  }

  const scenarioNow = buildScenario('now', 0, weatherRiskNow);
  const scenario7d = buildScenario('7_days', 7, weatherRisk7d);
  const scenario14d = buildScenario('14_days', 14, weatherRisk14d);

  // Pick recommended window: highest net unless risk is too high
  let bestScenario = scenarioNow;
  if (scenario7d.estimatedNet > scenarioNow.estimatedNet * 1.03 && scenario7d.riskLevel !== 'high') {
    bestScenario = scenario7d;
  }
  if (scenario14d.estimatedNet > scenario7d.estimatedNet * 1.03 && scenario14d.riskLevel === 'low') {
    bestScenario = scenario14d;
  }

  const reasons = buildReasons(bestScenario.window, signals, bestScenario.weatherRisk, bestMandi, commodity);

  return {
    farmSeasonId,
    generatedAt: new Date().toISOString(),
    recommendedWindow: bestScenario.window,
    suggestedMandi: bestMandi.mandi.name,
    estimatedNetRealization: bestScenario.estimatedNet,
    riskLevel: bestScenario.riskLevel,
    confidence: bestScenario.confidence,
    reasons,
    scenarios: [scenarioNow, scenario7d, scenario14d],
    source: 'decision-engine',
  };
}
