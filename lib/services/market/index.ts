// lib/services/market/index.ts
// Centralized market data service provider and fallback orchestration.
// Preserves the IMarketService abstraction so providers (Agmarknet, private mandi feeds, eNAM)
// can be configured or swapped without touching UI or decision-engine components.

import { IMarketService } from './interface';
import { AgmarknetMarketService } from './agmarknet';
import { DemoMarketService } from './demo';
import type { MarketRecord, MarketAnalysis, MandiComparison } from '@/lib/types/market';

export * from './interface';
export * from './demo';
export * from './agmarknet';

export const liveMarketService: IMarketService = new AgmarknetMarketService();
export const demoMarketService: IMarketService = new DemoMarketService();

export interface MarketFetchOptions {
  forceDemo?: boolean;
  days?: number;
}

/**
 * Fetch 30-day historical price records for a commodity at a mandi with demo fallback.
 */
export async function fetchPriceHistory(
  commodity: string,
  mandiName: string,
  state = 'Maharashtra',
  days = 30,
  options: MarketFetchOptions = {}
): Promise<MarketRecord[]> {
  if (options.forceDemo) {
    const demo = await demoMarketService.getPriceHistory(commodity, mandiName, state, days);
    return demo.map((r) => ({ ...r, source: 'demo' }));
  }

  try {
    const live = await liveMarketService.getPriceHistory(commodity, mandiName, state, days);
    return live.map((r) => ({ ...r, source: 'agmarknet' }));
  } catch (err) {
    console.warn(
      `[MarketService] Live price history fetch failed for ${commodity} @ ${mandiName}, falling back to demo:`,
      err instanceof Error ? err.message : err
    );
    const demo = await demoMarketService.getPriceHistory(commodity, mandiName, state, days);
    return demo.map((r) => ({ ...r, source: 'demo' }));
  }
}

/**
 * Fetch nearby mandi price comparisons with transport cost calculations and rank.
 */
export async function fetchNearbyMandiComparison(
  commodity: string,
  state = 'Maharashtra',
  farmLat = 18.2333,
  farmLng = 76.7167,
  options: MarketFetchOptions = {}
): Promise<MandiComparison[]> {
  if (options.forceDemo) {
    const demo = await demoMarketService.getNearbyMandiComparison(commodity, state, farmLat, farmLng);
    return demo;
  }

  try {
    const live = await liveMarketService.getNearbyMandiComparison(commodity, state, farmLat, farmLng);
    return live;
  } catch (err) {
    console.warn(
      `[MarketService] Live mandi comparison fetch failed for ${commodity} in ${state}, falling back to demo:`,
      err instanceof Error ? err.message : err
    );
    const demo = await demoMarketService.getNearbyMandiComparison(commodity, state, farmLat, farmLng);
    return demo;
  }
}

/**
 * Fetch comprehensive market analysis (history + trend + mandi comparisons).
 */
export async function fetchMarketAnalysis(
  commodity: string,
  mandiName: string,
  state = 'Maharashtra',
  farmLat = 18.2333,
  farmLng = 76.7167,
  options: MarketFetchOptions = {}
): Promise<MarketAnalysis> {
  if (options.forceDemo) {
    const demo = await demoMarketService.getMarketAnalysis(commodity, mandiName, state, farmLat, farmLng);
    return { ...demo, source: 'demo' };
  }

  try {
    const live = await liveMarketService.getMarketAnalysis(commodity, mandiName, state, farmLat, farmLng);
    return { ...live, source: 'agmarknet' };
  } catch (err) {
    console.warn(
      `[MarketService] Live market analysis failed for ${commodity} @ ${mandiName}, falling back to demo:`,
      err instanceof Error ? err.message : err
    );
    const demo = await demoMarketService.getMarketAnalysis(commodity, mandiName, state, farmLat, farmLng);
    return { ...demo, source: 'demo' };
  }
}
