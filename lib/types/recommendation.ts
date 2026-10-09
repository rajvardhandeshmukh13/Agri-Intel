// lib/types/recommendation.ts
// Selling decision engine output types

export type SellWindow = 'now' | '7_days' | '14_days';
export type RiskLevel = 'low' | 'moderate' | 'high';
export type ConfidenceLevel = 'low' | 'moderate' | 'high';

export interface Scenario {
  window: SellWindow;
  label: string; // e.g. "Sell Now", "Wait ~7 Days"
  mandi: string;
  estimatedModalPricePerQuintal: number;
  estimatedGross: number; // INR total
  transportCostTotal: number; // INR
  sellingCostTotal: number; // INR (commission, weighment, etc.)
  farmCostTotal: number; // INR (proportional input cost)
  estimatedNet: number; // INR
  riskLevel: RiskLevel;
  confidence: ConfidenceLevel;
  weatherRisk: RiskLevel;
  priceRiskPct: number; // percentage price could drop
  earliestSellingDate?: string;
  sellingWindowEndDate?: string;
  operationalLeadDays?: number;
}

export interface SellRecommendation {
  farmSeasonId: string;
  generatedAt: string;
  recommendedWindow: SellWindow;
  suggestedMandi: string;
  estimatedNetRealization: number; // INR for recommended window
  riskLevel: RiskLevel;
  confidence: ConfidenceLevel;
  reasons: string[]; // 3–5 human-readable explanation strings
  scenarios: [Scenario, Scenario, Scenario]; // [now, 7d, 14d]
  source: 'decision-engine' | 'demo';
  priceForecastSource?: 'ml' | 'heuristic';
  priceForecastDrivers?: import('./price-forecast').PriceDriver[];
  yieldSource?: 'ml' | 'ml-service' | 'fallback' | 'demo';
  expectedYieldQPerHa?: number;
  totalHarvestQ?: number;
  yieldConfidenceLow?: number;
  yieldConfidenceHigh?: number;
  yieldExplanation?: import('./yield').YieldExplanationFactor[];
  operationalLeadDays?: number;
  recommendedSellingStartDate?: string;
  recommendedSellingEndDate?: string;
}

export interface ProfitSimulatorInput {
  totalHarvestQ: number;
  mandiName: string;
  modalPricePerQuintal: number;
  transportCostPerQuintal: number;
  sellingCostPct: number; // e.g. 0.05 for 5%
  inputCostTotal: number; // INR
}

export interface ProfitSimulatorResult {
  grossRevenue: number;
  transportCost: number;
  sellingCost: number;
  netRealization: number;
  profitAfterInputCost: number;
  perQuintalNet: number;
}
