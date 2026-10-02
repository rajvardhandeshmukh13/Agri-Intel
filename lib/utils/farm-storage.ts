// lib/utils/farm-storage.ts
// Helper utilities for managing farm profile persistence in localStorage
// and computing active farm context for decision services.

import farmProfileData from '@/data/demo/farm-profile.json';
import yieldPredictionData from '@/data/demo/yield-prediction.json';
import type { CropName, SoilType, IrrigationType } from '@/lib/types/farm';

export interface StoredFarm {
  id?: string;
  userId?: string;
  name?: string;
  crop?: CropName | string;
  commodity?: string;
  state?: string;
  district?: string;
  village?: string;
  areaHectares?: number | string;
  area?: number | string;
  sowingDate?: string;
  soilType?: SoilType | string;
  irrigationType?: IrrigationType | string;
  lat?: number;
  latitude?: number;
  lng?: number;
  longitude?: number;
  fieldGeoJson?: GeoJSON.Polygon;
  inputCosts?: number | string;
  inputCostPerHa?: number | string;
  inputCostTotal?: number | string;
  languagePreference?: string;
  createdAt?: string;
}

export interface ActiveFarmContext {
  id: string;
  crop: string;
  commodity: string;
  state: string;
  district: string;
  village: string;
  areaHectares: number;
  sowingDate: string;
  season: string;
  soilType?: SoilType;
  irrigationType?: IrrigationType;
  lat: number;
  lng: number;
  nearestMandi: string;
  inputCostPerHa: number;
  inputCostTotal: number;
  expectedYieldQPerHa: number;
  totalHarvestQ: number;
  isCustomFarm: boolean;
  fieldGeoJson?: GeoJSON.Polygon;
}

// District coordinates & nearest APMC mandi in Maharashtra
export const DISTRICT_COORDINATES: Record<string, { lat: number; lng: number; nearestMandi: string }> = {
  Latur: { lat: 18.4088, lng: 76.5604, nearestMandi: 'Latur' },
  Sangli: { lat: 16.8524, lng: 74.5815, nearestMandi: 'Sangli' },
  Nanded: { lat: 19.1383, lng: 77.3210, nearestMandi: 'Nanded' },
  Solapur: { lat: 17.6599, lng: 75.9064, nearestMandi: 'Solapur' },
  Pune: { lat: 18.5204, lng: 73.8567, nearestMandi: 'Pune' },
  Osmanabad: { lat: 18.1860, lng: 76.0419, nearestMandi: 'Latur' },
  Satara: { lat: 17.6805, lng: 74.0183, nearestMandi: 'Pune' },
  Kolhapur: { lat: 16.7050, lng: 74.2433, nearestMandi: 'Sangli' },
  Ahmednagar: { lat: 19.0948, lng: 74.7480, nearestMandi: 'Pune' },
  Nashik: { lat: 19.9975, lng: 73.7898, nearestMandi: 'Pune' },
  Aurangabad: { lat: 19.8762, lng: 75.3433, nearestMandi: 'Nanded' },
  Jalna: { lat: 19.8347, lng: 75.8816, nearestMandi: 'Nanded' },
  Beed: { lat: 18.9891, lng: 75.7601, nearestMandi: 'Latur' },
  Parbhani: { lat: 19.2686, lng: 76.7708, nearestMandi: 'Nanded' },
  Hingoli: { lat: 19.7196, lng: 77.1485, nearestMandi: 'Nanded' },
  Buldhana: { lat: 20.5292, lng: 76.1843, nearestMandi: 'Nanded' },
  Washim: { lat: 20.1095, lng: 77.1350, nearestMandi: 'Nanded' },
  Yavatmal: { lat: 20.3888, lng: 78.1204, nearestMandi: 'Nanded' },
};

// Crop yield baselines (quintals per hectare)
export const CROP_BASELINES: Record<string, number> = {
  soybean: 19.5,
  wheat: 28.0,
  cotton: 12.0,
  onion: 80.0,
  tur: 10.0,
  jowar: 15.0,
  sugarcane: 750.0,
};

// Typical input costs per hectare in INR
export const CROP_INPUT_COSTS: Record<string, number> = {
  soybean: 18000,
  wheat: 16000,
  cotton: 25000,
  onion: 35000,
  tur: 15000,
  jowar: 12000,
  sugarcane: 45000,
};

export const SOIL_FACTORS: Record<string, number> = {
  black: 1.05,
  alluvial: 1.03,
  loamy: 1.02,
  red: 0.98,
  sandy: 0.92,
};

export const IRRIGATION_FACTORS: Record<string, number> = {
  irrigated: 1.15,
  partial: 1.05,
  rainfed: 1.0,
};

import { farmStorage } from '@/lib/services/farm';
export { farmStorage };

/**
 * Safely retrieve the farm profile stored in canonical farm storage (synchronous read for hydration).
 */
export function getStoredFarm(): StoredFarm | null {
  return farmStorage.getStoredFarmSync();
}

/**
 * Save farm profile to canonical farm storage (localStorage + Supabase if configured).
 */
export function saveStoredFarm(farm: StoredFarm): void {
  void farmStorage.saveFarm(farm);
}

/**
 * Reset stored farm profile back to demo state.
 */
export function resetStoredFarm(): void {
  void farmStorage.resetToDemo();
}

/**
 * Get active farm context, resolving either from localStorage or fallback demo profile.
 */
export function getActiveFarmContext(): ActiveFarmContext {
  const stored = getStoredFarm();

  if (stored && (stored.crop || stored.district || stored.areaHectares)) {
    const crop = String(stored.crop || stored.commodity || 'soybean').toLowerCase();
    const district = stored.district || 'Latur';
    const state = stored.state || 'Maharashtra';
    const village = stored.village || '';
    const rawArea = stored.areaHectares ?? stored.area ?? 3.5;
    const parsedArea = typeof rawArea === 'number' ? rawArea : parseFloat(String(rawArea));
    const areaHectares = isNaN(parsedArea) || parsedArea <= 0 ? 3.5 : parsedArea;

    const coords = DISTRICT_COORDINATES[district] ?? { lat: 18.2333, lng: 76.7167, nearestMandi: 'Latur' };
    const lat = typeof stored.lat === 'number' ? stored.lat : typeof stored.latitude === 'number' ? stored.latitude : coords.lat;
    const lng = typeof stored.lng === 'number' ? stored.lng : typeof stored.longitude === 'number' ? stored.longitude : coords.lng;

    const soilType = (stored.soilType as SoilType) || 'black';
    const irrigationType = (stored.irrigationType as IrrigationType) || 'rainfed';

    const baseYield = CROP_BASELINES[crop] ?? yieldPredictionData.expectedYieldQPerHa ?? 19.5;
    const soilFactor = SOIL_FACTORS[soilType] ?? 1.0;
    const irrFactor = IRRIGATION_FACTORS[irrigationType] ?? 1.0;
    const expectedYieldQPerHa = Math.round(baseYield * soilFactor * irrFactor * 10) / 10;
    const totalHarvestQ = Math.round(areaHectares * expectedYieldQPerHa * 100) / 100;

    let inputCostPerHa: number;
    if (stored.inputCostPerHa) {
      inputCostPerHa = Number(stored.inputCostPerHa);
    } else if (stored.inputCosts) {
      inputCostPerHa = Number(stored.inputCosts);
    } else {
      inputCostPerHa = CROP_INPUT_COSTS[crop] ?? 18000;
    }
    const inputCostTotal = stored.inputCostTotal
      ? Number(stored.inputCostTotal)
      : Math.round(areaHectares * inputCostPerHa);

    return {
      id: stored.id || 'farm-custom',
      crop,
      commodity: crop,
      state,
      district,
      village,
      areaHectares,
      sowingDate: stored.sowingDate || '2024-06-20',
      season: 'Kharif 2024',
      soilType,
      irrigationType,
      lat,
      lng,
      nearestMandi: coords.nearestMandi,
      inputCostPerHa,
      inputCostTotal,
      expectedYieldQPerHa,
      totalHarvestQ,
      isCustomFarm: true,
      fieldGeoJson: stored.fieldGeoJson ?? (farmProfileData.farm.fieldGeoJson as unknown as GeoJSON.Polygon),
    };
  }

  // Fallback demo profile from JSON
  const demoFarm = farmProfileData.farm;
  const demoSeason = farmProfileData.season;
  const demoYield = yieldPredictionData;

  return {
    id: demoFarm.id,
    crop: demoSeason.crop,
    commodity: demoSeason.crop,
    state: demoFarm.state,
    district: demoFarm.district,
    village: demoFarm.village,
    areaHectares: demoFarm.areaHectares,
    sowingDate: demoSeason.sowingDate,
    season: 'Kharif 2024',
    soilType: demoSeason.soilType as SoilType,
    irrigationType: demoSeason.irrigationType as IrrigationType,
    lat: demoFarm.lat,
    lng: demoFarm.lng,
    nearestMandi: 'Latur',
    inputCostPerHa: demoSeason.inputCostPerHa,
    inputCostTotal: Math.round(demoFarm.areaHectares * demoSeason.inputCostPerHa),
    expectedYieldQPerHa: demoYield.expectedYieldQPerHa,
    totalHarvestQ: demoYield.totalHarvestQ,
    isCustomFarm: false,
    fieldGeoJson: demoFarm.fieldGeoJson as unknown as GeoJSON.Polygon,
  };
}

const CROP_TRANSLATIONS: Record<string, { en: string; mr: string; hi: string }> = {
  soybean: { en: 'Soybean', mr: 'सोयाबीन', hi: 'सोयाबीन' },
  wheat: { en: 'Wheat', mr: 'गहू', hi: 'गेहूं' },
  cotton: { en: 'Cotton', mr: 'कापूस', hi: 'कपास' },
  onion: { en: 'Onion', mr: 'कांदा', hi: 'प्याज' },
  tur: { en: 'Tur', mr: 'तूर', hi: 'अरहर / तूर' },
  jowar: { en: 'Jowar', mr: 'ज्वारी', hi: 'ज्वार' },
  sugarcane: { en: 'Sugarcane', mr: 'ऊस', hi: 'गन्ना' },
};

/**
 * Format crop name for display (e.g. "cotton" -> "कापूस" in Marathi, "कपास" in Hindi, "Cotton" in English)
 */
export function formatCropName(crop: string, locale?: string): string {
  if (!crop) return locale === 'mr' ? 'सोयाबीन' : locale === 'hi' ? 'सोयाबीन' : 'Soybean';
  const key = crop.toLowerCase();
  if (locale && (locale === 'mr' || locale === 'hi')) {
    const entry = CROP_TRANSLATIONS[key];
    if (entry) return entry[locale as 'mr' | 'hi'];
  }
  return crop.charAt(0).toUpperCase() + crop.slice(1);
}
