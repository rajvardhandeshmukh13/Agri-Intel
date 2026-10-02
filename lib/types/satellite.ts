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
  source: 'sentinel-hub' | 'nasa-earthdata' | 'live' | 'demo';
}

export interface HealthZone {
  status: HealthStatus;
  label?: string;
  polygon: [number, number][]; // [lat, lng] pairs for Leaflet
  areaPct?: number; // percentage of total field area
  color?: string; // hex color for visualization
  description?: string;
}

export interface SatelliteHealth {
  farmId: string;
  latestNdvi: number;
  avgNdvi?: number;
  latestStatus: HealthStatus;
  trend: 'improving' | 'stable' | 'declining';
  readings: NDVIReading[]; // last 8 readings (bi-weekly ~16 weeks)
  healthyPct: number; // percentage of field area that is healthy
  moderatePct: number;
  stressedPct: number;
  lastObservedAt: string;
  fieldBoundary?: [number, number][]; // outer field boundary [lat, lng] pairs
  healthZones?: HealthZone[]; // segmented health zones within the field
  source: 'sentinel-hub' | 'nasa-earthdata' | 'live' | 'demo';
}
