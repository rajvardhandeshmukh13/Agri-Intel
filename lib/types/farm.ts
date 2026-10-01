// lib/types/farm.ts
// Core farm and crop data models

export type Language = 'en' | 'mr' | 'hi';

export type CropName = 'soybean' | 'wheat' | 'cotton' | 'onion' | 'sugarcane' | 'jowar' | 'tur';

export type IrrigationType = 'rainfed' | 'irrigated' | 'partial';

export type SoilType = 'black' | 'red' | 'alluvial' | 'sandy' | 'loamy';

export interface FarmProfile {
  id: string;
  userId: string;
  name: string;
  state: string;
  district: string;
  village: string;
  lat: number;
  lng: number;
  areaHectares: number;
  fieldGeoJson?: GeoJSON.Polygon;
  createdAt: string;
}

export interface FarmSeason {
  id: string;
  farmId: string;
  crop: CropName;
  season: string; // e.g. 'kharif_2024'
  sowingDate: string; // ISO date string
  expectedHarvestDate: string;
  areaHectares: number;
  soilType?: SoilType;
  irrigationType?: IrrigationType;
  inputCostPerHa?: number; // INR
}

export interface FarmContext {
  farm: FarmProfile;
  season: FarmSeason;
}

export interface OnboardingInput {
  crop: CropName;
  state: string;
  district: string;
  village: string;
  lat?: number;
  lng?: number;
  areaHectares: number;
  sowingDate: string;
  soilType?: SoilType;
  irrigationType?: IrrigationType;
  inputCostPerHa?: number;
}
