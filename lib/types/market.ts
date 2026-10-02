// lib/types/market.ts
// Normalized market/mandi data models — provider-agnostic

export interface MarketRecord {
  id?: string;
  commodity: string;
  mandiName: string;
  state: string;
  district: string;
  recordedDate: string; // ISO date
  minPricePerQuintal: number;
  maxPricePerQuintal: number;
  modalPricePerQuintal: number;
  arrivalsQuintals?: number;
  source: 'agmarknet' | 'live' | 'demo';
}

export interface MandiInfo {
  name: string;
  district: string;
  state: string;
  lat: number;
  lng: number;
  distanceKm: number;
}

export interface MandiComparison {
  mandi: MandiInfo;
  latestRecord: MarketRecord;
  estimatedTransportCostPerQuintal: number;
  estimatedNetPricePerQuintal: number;
  priceRank: number; // 1 = best net price
}

export interface PriceTrend {
  direction: 'rising' | 'falling' | 'stable';
  sevenDayChange: number; // percentage
  thirtyDayChange: number;
  momentum: 'strong' | 'moderate' | 'weak';
  seasonalIndex: number; // 1.0 = average, >1 = above seasonal average
}

export interface MarketAnalysis {
  commodity: string;
  mandi: string;
  currentModalPrice: number;
  trend: PriceTrend;
  priceHistory: MarketRecord[]; // last 30 days
  nearbyMandis: MandiComparison[];
  source?: 'agmarknet' | 'live' | 'demo';
}
