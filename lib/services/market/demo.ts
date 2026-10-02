// lib/services/market/demo.ts
// Demo market service — returns complete multi-commodity, multi-mandi 30-day historical data.
// Provides realistic APMC market records for all Maharashtra crops and mandis without needing an external dataset download.

import type { IMarketService } from './interface';
import type { MarketRecord, MarketAnalysis, MandiComparison, PriceTrend } from '@/lib/types/market';
import rawMarketData from '@/data/demo/market-history.json';
import { haversineDistanceKm } from './agmarknet';

// Known mandis for demo with coordinates and distances
export const DEMO_MANDIS = [
  { name: 'Latur',   district: 'Latur',   state: 'Maharashtra', lat: 18.4088, lng: 76.5604, distanceKm: 15 },
  { name: 'Sangli',  district: 'Sangli',  state: 'Maharashtra', lat: 16.8524, lng: 74.5815, distanceKm: 210 },
  { name: 'Nanded',  district: 'Nanded',  state: 'Maharashtra', lat: 19.1383, lng: 77.3210, distanceKm: 80 },
  { name: 'Solapur', district: 'Solapur', state: 'Maharashtra', lat: 17.6599, lng: 75.9064, distanceKm: 115 },
  { name: 'Pune',    district: 'Pune',    state: 'Maharashtra', lat: 18.5204, lng: 73.8567, distanceKm: 280 },
  { name: 'Satara',  district: 'Satara',  state: 'Maharashtra', lat: 17.6805, lng: 74.0183, distanceKm: 35 },
];

// Transport cost estimate: ₹30/quintal per 100 km
function estimateTransportCostPerQtl(distanceKm: number): number {
  return Math.round((distanceKm / 100) * 30);
}

function computeTrend(records: MarketRecord[]): PriceTrend {
  if (records.length < 2) {
    return { direction: 'stable', sevenDayChange: 0, thirtyDayChange: 0, momentum: 'weak', seasonalIndex: 1.0 };
  }
  const sorted = [...records].sort((a, b) => a.recordedDate.localeCompare(b.recordedDate));
  const latest = sorted[sorted.length - 1]?.modalPricePerQuintal ?? 0;
  const sevenDaysAgo = sorted[Math.max(0, sorted.length - 8)]?.modalPricePerQuintal ?? latest;
  const thirtyDaysAgo = sorted[0]?.modalPricePerQuintal ?? latest;

  const sevenDayChange = sevenDaysAgo ? ((latest - sevenDaysAgo) / sevenDaysAgo) * 100 : 0;
  const thirtyDayChange = thirtyDaysAgo ? ((latest - thirtyDaysAgo) / thirtyDaysAgo) * 100 : 0;

  const direction = sevenDayChange > 0.8 ? 'rising' : sevenDayChange < -0.8 ? 'falling' : 'stable';
  const momentum = Math.abs(sevenDayChange) > 3.5 ? 'strong' : Math.abs(sevenDayChange) > 1.2 ? 'moderate' : 'weak';

  return {
    direction,
    sevenDayChange: parseFloat(sevenDayChange.toFixed(1)),
    thirtyDayChange: parseFloat(thirtyDayChange.toFixed(1)),
    momentum,
    seasonalIndex: 1.05,
  };
}

const CROP_PRICE_RATIO: Record<string, number> = {
  soybean: 1.0,     // base modal ~4,280
  wheat: 0.60,      // modal ~2,568
  cotton: 1.65,     // modal ~7,062 (Pune ~7,227)
  onion: 0.50,      // modal ~2,140
  tur: 1.75,        // modal ~7,490
  jowar: 0.75,      // modal ~3,210
  sugarcane: 0.08,  // modal ~342
};

/**
 * Builds a complete 30-day daily dataset for every demo mandi.
 * Preserves the exact 10 records for Latur from rawMarketData so that existing tests pass with 100% parity.
 */
function buildFullMarketHistory(): MarketRecord[] {
  const records: MarketRecord[] = [];

  const basePrices: Record<string, number> = {
    Pune: 4380,
    Sangli: 4340,
    Latur: 4280,
    Solapur: 4260,
    Nanded: 4220,
    Satara: 4300,
  };

  const mandis = [
    { name: 'Latur', district: 'Latur', state: 'Maharashtra', arrivalsBase: 3000 },
    { name: 'Sangli', district: 'Sangli', state: 'Maharashtra', arrivalsBase: 4800 },
    { name: 'Nanded', district: 'Nanded', state: 'Maharashtra', arrivalsBase: 2600 },
    { name: 'Solapur', district: 'Solapur', state: 'Maharashtra', arrivalsBase: 3400 },
    { name: 'Pune', district: 'Pune', state: 'Maharashtra', arrivalsBase: 6000 },
    { name: 'Satara', district: 'Satara', state: 'Maharashtra', arrivalsBase: 2200 },
  ];

  const anchorDate = new Date('2024-10-01T00:00:00Z');

  for (const m of mandis) {
    const baseModal = basePrices[m.name] ?? 4280;

    const laturRaw = (rawMarketData as MarketRecord[]).filter(
      (r) => r.mandiName.toLowerCase() === 'latur' && r.commodity.toLowerCase() === 'soybean'
    );

    for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
      const d = new Date(anchorDate);
      d.setUTCDate(d.getUTCDate() - dayOffset);
      const dateStr = d.toISOString().split('T')[0];

      if (m.name === 'Latur') {
        const found = laturRaw.find((r) => r.recordedDate === dateStr);
        if (found) {
          records.push(found);
          continue;
        }
      }

      // Smooth realistic market trend leading into day 0
      const progress = (29 - dayOffset) / 29;
      const cyclic = Math.sin(dayOffset * 0.45) * 0.015;
      const trendMultiplier = 0.94 + 0.06 * progress + cyclic;
      const modal = dayOffset === 0 ? baseModal : Math.round(baseModal * trendMultiplier);
      const min = Math.round(modal * 0.965);
      const max = Math.round(modal * 1.045);
      const arrivals = Math.round(m.arrivalsBase * (0.8 + 0.35 * Math.sin(dayOffset * 0.5) + 0.2 * progress));

      records.push({
        id: `demo-market-${m.name.toLowerCase()}-${dateStr}`,
        commodity: 'soybean',
        mandiName: m.name,
        state: m.state,
        district: m.district,
        recordedDate: dateStr,
        minPricePerQuintal: min,
        maxPricePerQuintal: max,
        modalPricePerQuintal: modal,
        arrivalsQuintals: arrivals,
        source: 'demo',
      });
    }
  }

  return records;
}

export class DemoMarketService implements IMarketService {
  private allRecords: MarketRecord[] = buildFullMarketHistory();

  private getRecords(commodity: string): MarketRecord[] {
    const comm = (commodity || 'soybean').toLowerCase();
    const existing = this.allRecords.filter((r) => r.commodity.toLowerCase() === comm);
    if (existing.length > 0) return existing;

    const ratio = CROP_PRICE_RATIO[comm] ?? 1.0;
    return this.allRecords.map((r) => ({
      ...r,
      id: `${r.id}-${comm}`,
      commodity: comm,
      minPricePerQuintal: Math.round(r.minPricePerQuintal * ratio),
      maxPricePerQuintal: Math.round(r.maxPricePerQuintal * ratio),
      modalPricePerQuintal: Math.round(r.modalPricePerQuintal * ratio),
    }));
  }

  async getPriceHistory(commodity: string, mandiName: string, state: string, days = 30): Promise<MarketRecord[]> {
    const records = this.getRecords(commodity)
      .filter(
        (r) =>
          r.commodity.toLowerCase() === commodity.toLowerCase() &&
          r.mandiName.toLowerCase() === mandiName.toLowerCase() &&
          r.state.toLowerCase() === state.toLowerCase()
      )
      .sort((a, b) => a.recordedDate.localeCompare(b.recordedDate));

    if (records.length === 0) return [];

    // Filter relative to the latest available record date so historical demo sets work regardless of year
    const latestDate = new Date(records[records.length - 1].recordedDate);
    const cutoff = new Date(latestDate);
    cutoff.setDate(cutoff.getDate() - days);

    return records.filter((r) => new Date(r.recordedDate) >= cutoff);
  }

  async getLatestPrice(commodity: string, mandiName: string, state: string): Promise<MarketRecord | null> {
    const records = this.getRecords(commodity)
      .filter(
        (r) =>
          r.commodity.toLowerCase() === commodity.toLowerCase() &&
          r.mandiName.toLowerCase() === mandiName.toLowerCase() &&
          r.state.toLowerCase() === state.toLowerCase()
      )
      .sort((a, b) => b.recordedDate.localeCompare(a.recordedDate));
    return records[0] ?? null;
  }

  async getAllMandiPrices(commodity: string, state: string): Promise<MarketRecord[]> {
    const records = this.getRecords(commodity);
    const latest = new Map<string, MarketRecord>();
    for (const r of records) {
      if (
        r.commodity.toLowerCase() === commodity.toLowerCase() &&
        r.state.toLowerCase() === state.toLowerCase()
      ) {
        const existing = latest.get(r.mandiName);
        if (!existing || r.recordedDate > existing.recordedDate) {
          latest.set(r.mandiName, r);
        }
      }
    }
    return Array.from(latest.values());
  }

  async getNearbyMandiComparison(
    commodity: string,
    state: string,
    farmLat: number,
    farmLng: number
  ): Promise<MandiComparison[]> {
    const latestPrices = await this.getAllMandiPrices(commodity, state);
    const comparisons: MandiComparison[] = [];

    for (const mandiInfo of DEMO_MANDIS) {
      const record = latestPrices.find((r) => r.mandiName === mandiInfo.name);
      if (!record) continue;

      const distanceKm = (typeof farmLat === 'number' && typeof farmLng === 'number' && !isNaN(farmLat) && !isNaN(farmLng))
        ? haversineDistanceKm(farmLat, farmLng, mandiInfo.lat, mandiInfo.lng)
        : mandiInfo.distanceKm;

      const transportCostPerQtl = estimateTransportCostPerQtl(distanceKm);
      const netPricePerQtl = record.modalPricePerQuintal - transportCostPerQtl;
      comparisons.push({
        mandi: {
          name: mandiInfo.name,
          district: mandiInfo.district,
          state: mandiInfo.state,
          lat: mandiInfo.lat,
          lng: mandiInfo.lng,
          distanceKm,
        },
        latestRecord: record,
        estimatedTransportCostPerQuintal: transportCostPerQtl,
        estimatedNetPricePerQuintal: netPricePerQtl,
        priceRank: 0,
      });
    }

    // Rank by estimated net price (highest = rank 1)
    comparisons.sort((a, b) => b.estimatedNetPricePerQuintal - a.estimatedNetPricePerQuintal);
    comparisons.forEach((c, i) => { c.priceRank = i + 1; });
    return comparisons;
  }

  async getMarketAnalysis(
    commodity: string,
    mandiName: string,
    state: string,
    farmLat: number,
    farmLng: number
  ): Promise<MarketAnalysis> {
    const history = await this.getPriceHistory(commodity, mandiName, state, 30);
    const latest = await this.getLatestPrice(commodity, mandiName, state);
    const nearbyMandis = await this.getNearbyMandiComparison(commodity, state, farmLat, farmLng);
    const trend = computeTrend(history);

    return {
      commodity,
      mandi: mandiName,
      currentModalPrice: latest?.modalPricePerQuintal ?? 0,
      trend,
      priceHistory: history,
      nearbyMandis,
      source: 'demo' as const,
    };
  }
}
