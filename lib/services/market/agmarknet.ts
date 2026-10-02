// lib/services/market/agmarknet.ts
// Live Agmarknet market provider (data.gov.in agricultural commodity API).
// Docs: https://data.gov.in/resource/variety-wise-daily-market-prices-data

import type { IMarketService } from './interface';
import type { MarketRecord, MarketAnalysis, MandiComparison, PriceTrend, MandiInfo } from '@/lib/types/market';

const BASE_URL = process.env.AGMARKNET_BASE_URL ?? 'https://api.data.gov.in/resource/';
const RESOURCE_ID = process.env.AGMARKNET_RESOURCE_ID ?? '9ef84268-d588-465a-a308-a864a43d0070';
const REQUEST_TIMEOUT_MS = 6000;

// Known mandi geo-locations for distance and transport cost calculation
export const MAHARASHTRA_MANDIS: Record<string, { district: string; lat: number; lng: number }> = {
  Latur: { district: 'Latur', lat: 18.4088, lng: 76.5604 },
  Sangli: { district: 'Sangli', lat: 16.8524, lng: 74.5815 },
  Nanded: { district: 'Nanded', lat: 19.1383, lng: 77.3210 },
  Solapur: { district: 'Solapur', lat: 17.6599, lng: 75.9064 },
  Pune: { district: 'Pune', lat: 18.5204, lng: 73.8567 },
  Nagpur: { district: 'Nagpur', lat: 21.1458, lng: 79.0882 },
  Amravati: { district: 'Amravati', lat: 20.9374, lng: 77.7796 },
  Akola: { district: 'Akola', lat: 20.7002, lng: 77.0082 },
  Nashik: { district: 'Nashik', lat: 19.9975, lng: 73.7898 },
  ChhatrapatiSambhajinagar: { district: 'Chhatrapati Sambhajinagar', lat: 19.8762, lng: 75.3433 },
  Aurangabad: { district: 'Aurangabad', lat: 19.8762, lng: 75.3433 },
  Jalna: { district: 'Jalna', lat: 19.8347, lng: 75.8816 },
  Satara: { district: 'Satara', lat: 17.6805, lng: 73.9937 },
  Karad: { district: 'Satara', lat: 17.2894, lng: 74.1818 },
  Phaltan: { district: 'Satara', lat: 17.9856, lng: 74.4334 },
  Koregaon: { district: 'Satara', lat: 17.6975, lng: 74.1706 },
  Kolhapur: { district: 'Kolhapur', lat: 16.7050, lng: 74.2433 },
  Ahmednagar: { district: 'Ahmednagar', lat: 19.0952, lng: 74.7496 },
  Washim: { district: 'Washim', lat: 20.1098, lng: 77.1332 },
  Yavatmal: { district: 'Yavatmal', lat: 20.3888, lng: 78.1204 },
};

const COMMODITY_MAP: Record<string, string> = {
  soybean: 'Soyabean',
  soyabean: 'Soyabean',
  cotton: 'Cotton',
  wheat: 'Wheat',
  onion: 'Onion',
  tur: 'Arhar (Tur/Red Gram)',
  arhar: 'Arhar (Tur/Red Gram)',
  jowar: 'Jowar(Sorghum)',
  sugarcane: 'Sugarcane',
};

function normalizeCommodity(commodity: string): string {
  const key = (commodity || '').trim().toLowerCase();
  return COMMODITY_MAP[key] ?? commodity;
}

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (lat1 === lat2 && lon1 === lon2) return 5; // local farm/mandi proximity floor
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(5, Math.round(R * c));
}

// Transport cost estimate: ₹30/quintal per 100 km (with ₹5 floor)
export function estimateTransportCostPerQtl(distanceKm: number): number {
  return Math.max(5, Math.round((distanceKm / 100) * 30));
}

function parseAgmarknetDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0]!;
  // Check if DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split('/');
    return `${y}-${m}-${d}`;
  }
  // Check if already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr.split('T')[0]!;
  }
  const parsed = new Date(dateStr);
  return !isNaN(parsed.getTime()) ? parsed.toISOString().split('T')[0]! : new Date().toISOString().split('T')[0]!;
}

function computeTrend(records: MarketRecord[]): PriceTrend {
  if (records.length < 2) {
    return { direction: 'stable', sevenDayChange: 0, thirtyDayChange: 0, momentum: 'weak', seasonalIndex: 1.0 };
  }
  const sorted = [...records].sort((a, b) => a.recordedDate.localeCompare(b.recordedDate));
  const latest = sorted[sorted.length - 1]?.modalPricePerQuintal ?? 0;
  const sevenDaysAgo = sorted[Math.max(0, sorted.length - 4)]?.modalPricePerQuintal ?? latest;
  const thirtyDaysAgo = sorted[0]?.modalPricePerQuintal ?? latest;

  const sevenDayChange = sevenDaysAgo ? ((latest - sevenDaysAgo) / sevenDaysAgo) * 100 : 0;
  const thirtyDayChange = thirtyDaysAgo ? ((latest - thirtyDaysAgo) / thirtyDaysAgo) * 100 : 0;

  const direction = sevenDayChange > 1 ? 'rising' : sevenDayChange < -1 ? 'falling' : 'stable';
  const momentum = Math.abs(sevenDayChange) > 4 ? 'strong' : Math.abs(sevenDayChange) > 1.5 ? 'moderate' : 'weak';

  return {
    direction,
    sevenDayChange: parseFloat(sevenDayChange.toFixed(1)),
    thirtyDayChange: parseFloat(thirtyDayChange.toFixed(1)),
    momentum,
    seasonalIndex: 1.05,
  };
}

async function fetchWithTimeout(url: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const signal = typeof AbortSignal?.timeout === 'function'
    ? AbortSignal.timeout(timeoutMs)
    : undefined;
  return fetch(url, { signal });
}

interface RawAgmarknetRecord {
  state?: string;
  district?: string;
  market?: string;
  mandi?: string;
  commodity?: string;
  variety?: string;
  arrival_date?: string;
  arrivalDate?: string;
  min_price?: string | number;
  minPrice?: string | number;
  max_price?: string | number;
  maxPrice?: string | number;
  modal_price?: string | number;
  modalPrice?: string | number;
  arrivals?: string | number;
}

export class AgmarknetMarketService implements IMarketService {
  private apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.AGMARKNET_API_KEY;
  }

  private normalizeRecord(raw: RawAgmarknetRecord, defaultCommodity: string): MarketRecord {
    const mandiName = (raw.market || raw.mandi || 'Unknown').trim();
    const minP = parseFloat(String(raw.min_price || raw.minPrice || '0')) || 0;
    const maxP = parseFloat(String(raw.max_price || raw.maxPrice || '0')) || 0;
    const modalP = parseFloat(String(raw.modal_price || raw.modalPrice || minP || '0')) || 0;
    const arrivals = raw.arrivals !== undefined ? parseFloat(String(raw.arrivals)) : undefined;

    return {
      commodity: raw.commodity || defaultCommodity,
      mandiName,
      state: raw.state || 'Maharashtra',
      district: raw.district || mandiName,
      recordedDate: parseAgmarknetDate(raw.arrival_date || raw.arrivalDate || ''),
      minPricePerQuintal: minP,
      maxPricePerQuintal: maxP,
      modalPricePerQuintal: modalP,
      arrivalsQuintals: !isNaN(arrivals ?? NaN) ? arrivals : undefined,
      source: 'agmarknet',
    };
  }

  async getPriceHistory(
    commodity: string,
    mandiName: string,
    state = 'Maharashtra',
    days = 30
  ): Promise<MarketRecord[]> {
    if (!this.apiKey) {
      throw new Error('AGMARKNET_API_KEY is not configured in environment');
    }

    const comm = normalizeCommodity(commodity);
    const url = new URL(`${BASE_URL.replace(/\/+$/, '')}/${RESOURCE_ID}`);
    url.searchParams.set('api-key', this.apiKey);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', Math.min(Math.max(days, 1), 100).toString());
    url.searchParams.set('filters[state]', state);
    url.searchParams.set('filters[commodity]', comm);
    if (mandiName) {
      url.searchParams.set('filters[market]', mandiName);
    }

    const res = await fetchWithTimeout(url.toString());
    if (!res.ok) {
      throw new Error(`Agmarknet API request failed with HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json() as { records?: RawAgmarknetRecord[]; status?: string };
    if (!data?.records || !Array.isArray(data.records) || data.records.length === 0) {
      throw new Error(`No Agmarknet records returned for commodity "${commodity}" at mandi "${mandiName}"`);
    }

    return data.records.map((r) => this.normalizeRecord(r, commodity));
  }

  async getLatestPrice(commodity: string, mandiName: string, state = 'Maharashtra'): Promise<MarketRecord | null> {
    const history = await this.getPriceHistory(commodity, mandiName, state, 5);
    if (history.length === 0) return null;
    const sorted = [...history].sort((a, b) => b.recordedDate.localeCompare(a.recordedDate));
    return sorted[0] ?? null;
  }

  async getAllMandiPrices(commodity: string, state = 'Maharashtra'): Promise<MarketRecord[]> {
    if (!this.apiKey) {
      throw new Error('AGMARKNET_API_KEY is not configured in environment');
    }

    const comm = normalizeCommodity(commodity);
    const url = new URL(`${BASE_URL.replace(/\/+$/, '')}/${RESOURCE_ID}`);
    url.searchParams.set('api-key', this.apiKey);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '100');
    url.searchParams.set('filters[state]', state);
    url.searchParams.set('filters[commodity]', comm);

    const res = await fetchWithTimeout(url.toString());
    if (!res.ok) {
      throw new Error(`Agmarknet API request failed with HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json() as { records?: RawAgmarknetRecord[] };
    if (!data?.records || !Array.isArray(data.records) || data.records.length === 0) {
      throw new Error(`No Agmarknet records returned for commodity "${commodity}" across ${state}`);
    }

    return data.records.map((r) => this.normalizeRecord(r, commodity));
  }

  async getNearbyMandiComparison(
    commodity: string,
    state = 'Maharashtra',
    farmLat = 18.2333,
    farmLng = 76.7167
  ): Promise<MandiComparison[]> {
    const allRecords = await this.getAllMandiPrices(commodity, state);
    if (allRecords.length === 0) {
      throw new Error(`No mandi prices available to compare for "${commodity}"`);
    }

    // Group by mandi name and select the latest record for each mandi
    const byMandi = new Map<string, MarketRecord>();
    for (const record of allRecords) {
      const existing = byMandi.get(record.mandiName);
      if (!existing || record.recordedDate > existing.recordedDate) {
        byMandi.set(record.mandiName, record);
      }
    }

    const comparisons: MandiComparison[] = [];
    for (const [mandiName, record] of byMandi.entries()) {
      const geo = MAHARASHTRA_MANDIS[mandiName] ?? {
        district: record.district,
        lat: farmLat + 0.5,
        lng: farmLng + 0.5,
      };

      const distanceKm = haversineDistanceKm(farmLat, farmLng, geo.lat, geo.lng);
      const transport = estimateTransportCostPerQtl(distanceKm);
      const net = record.modalPricePerQuintal - transport;

      const mandiInfo: MandiInfo = {
        name: mandiName,
        district: geo.district,
        state: record.state,
        lat: geo.lat,
        lng: geo.lng,
        distanceKm,
      };

      comparisons.push({
        mandi: mandiInfo,
        latestRecord: record,
        estimatedTransportCostPerQuintal: transport,
        estimatedNetPricePerQuintal: net,
        priceRank: 0,
      });
    }

    // Sort by estimated net price descending and assign rank
    comparisons.sort((a, b) => b.estimatedNetPricePerQuintal - a.estimatedNetPricePerQuintal);
    comparisons.forEach((item, index) => {
      item.priceRank = index + 1;
    });

    return comparisons;
  }

  async getMarketAnalysis(
    commodity: string,
    mandiName: string,
    state = 'Maharashtra',
    farmLat = 18.2333,
    farmLng = 76.7167
  ): Promise<MarketAnalysis> {
    const [priceHistory, nearbyMandis] = await Promise.all([
      this.getPriceHistory(commodity, mandiName, state, 30),
      this.getNearbyMandiComparison(commodity, state, farmLat, farmLng),
    ]);

    const latest = priceHistory[priceHistory.length - 1];
    const currentModalPrice = latest?.modalPricePerQuintal ?? 0;
    const trend = computeTrend(priceHistory);

    return {
      commodity,
      mandi: mandiName,
      currentModalPrice,
      trend,
      priceHistory,
      nearbyMandis,
      source: 'agmarknet',
    };
  }
}
