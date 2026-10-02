// lib/services/market/interface.ts
// Provider-agnostic market/mandi data service interface.

import type { MarketRecord, MarketAnalysis, MandiComparison } from '@/lib/types/market';

export interface IMarketService {
  /**
   * Get recent price records for a commodity at a specific mandi.
   * @param commodity - e.g. 'soybean'
   * @param mandiName - e.g. 'Latur'
   * @param state - e.g. 'Maharashtra'
   * @param days - number of past days of data to fetch (default 30)
   */
  getPriceHistory(
    commodity: string,
    mandiName: string,
    state: string,
    days?: number
  ): Promise<MarketRecord[]>;

  /**
   * Get the latest record for a commodity at a mandi.
   */
  getLatestPrice(commodity: string, mandiName: string, state: string): Promise<MarketRecord | null>;

  /**
   * Get records for all tracked mandis for a commodity/state.
   * Used for mandi comparison.
   */
  getAllMandiPrices(commodity: string, state: string): Promise<MarketRecord[]>;

  /**
   * Full market analysis: history + trend + mandi comparison.
   */
  getMarketAnalysis(
    commodity: string,
    mandiName: string,
    state: string,
    farmLat: number,
    farmLng: number
  ): Promise<MarketAnalysis>;

  /**
   * Get sorted mandi comparison with transport cost estimates.
   */
  getNearbyMandiComparison(
    commodity: string,
    state: string,
    farmLat: number,
    farmLng: number
  ): Promise<MandiComparison[]>;
}
