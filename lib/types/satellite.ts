// lib/types/satellite.ts
// Satellite and crop health data models

export type HealthStatus = 'healthy' | 'moderate' | 'stressed';

export interface NDVIReading {
  farmId: string;
  observedAt: string; // ISO datetime
  ndvi: number; // -1.0 to 1.0 (healthy crops typically 0.4–0.9)
  healthStatus: HealthStatus;
  cloudCoverPct: number;
  imageUrl?: string;
  source: 'sentinel-hub' | 'nasa-earthdata' | 'demo';
}

export interface SatelliteHealth {
  farmId: string;
  latestNdvi: number;
  latestStatus: HealthStatus;
  trend: 'improving' | 'stable' | 'declining';
  readings: NDVIReading[]; // last 8 readings (bi-weekly ~16 weeks)
  healthyPct: number; // percentage of field area that is healthy
  moderatePct: number;
  stressedPct: number;
  lastObservedAt: string;
  source: 'sentinel-hub' | 'nasa-earthdata' | 'demo';
}

export interface HealthZone {
  status: HealthStatus;
  polygon: [number, number][]; // [lat, lng] pairs
}
