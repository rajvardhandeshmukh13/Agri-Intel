// lib/decision-engine/profit-calculator.ts
// Calculates estimated gross, transport, and net realization figures.

import type { ProfitSimulatorInput, ProfitSimulatorResult } from '@/lib/types/recommendation';

/**
 * Standard selling cost rate for APMC mandis (commission + weighment + misc).
 * Typically 1–3%. Using 2% as a conservative estimate.
 */
const DEFAULT_SELLING_COST_RATE = 0.02;

export function calculateProfit(input: ProfitSimulatorInput): ProfitSimulatorResult {
  const {
    totalHarvestQ,
    modalPricePerQuintal,
    transportCostPerQuintal,
    sellingCostPct = DEFAULT_SELLING_COST_RATE,
    inputCostTotal,
  } = input;

  const grossRevenue = Math.round(totalHarvestQ * modalPricePerQuintal);
  const transportCost = Math.round(totalHarvestQ * transportCostPerQuintal);
  const sellingCost = Math.round(grossRevenue * sellingCostPct);
  const netRealization = grossRevenue - transportCost - sellingCost;
  const roundedInputCost = Math.round(inputCostTotal);
  const profitAfterInputCost = netRealization - roundedInputCost;
  const perQuintalNet = totalHarvestQ > 0 ? Math.round(netRealization / totalHarvestQ) : 0;

  return {
    grossRevenue,
    transportCost,
    sellingCost,
    netRealization,
    profitAfterInputCost,
    perQuintalNet,
  };
}

/**
 * Estimate transport cost per quintal based on distance.
 * Rough rate: ₹30/quintal per 100km (includes loading/unloading).
 */
export function estimateTransportCostPerQtl(distanceKm: number): number {
  const ratePerQtlPer100km = 30;
  return Math.ceil((distanceKm / 100) * ratePerQtlPer100km);
}
