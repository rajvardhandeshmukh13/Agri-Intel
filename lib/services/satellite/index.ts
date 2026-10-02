// lib/services/satellite/index.ts
// Centralized satellite service provider and fallback orchestration.
// Preserves the ISatelliteService abstraction so underlying providers
// (Sentinel Hub, NASA Earthdata, Planet) can be swapped without changing callers.

import { ISatelliteService } from './interface';
import { DemoSatelliteService } from './demo';
import { SentinelHubSatelliteService } from './sentinel-hub';
import { isServerDemoMode } from '@/lib/utils/demo-mode';
import type { SatelliteHealth, NDVIReading } from '@/lib/types/satellite';

export * from './interface';
export * from './demo';
export * from './sentinel-hub';
export * from './utils';

export const liveSatelliteService: ISatelliteService = new SentinelHubSatelliteService();
export const demoSatelliteService: ISatelliteService = new DemoSatelliteService();

export interface SatelliteServiceOptions {
  forceDemo?: boolean;
  polygon?: GeoJSON.Polygon;
  satelliteService?: ISatelliteService;
}

/**
 * Fetch crop health intelligence with automatic graceful fallback.
 * Uses live satellite provider if credentials and network are healthy,
 * falling back to deterministic demo data on timeout, error, or explicit demo mode.
 */
export async function fetchSatelliteHealth(
  farmId = 'demo-soybean-maharashtra',
  lat = 18.2333,
  lng = 76.7167,
  options: SatelliteServiceOptions = {}
): Promise<SatelliteHealth> {
  const isDemo = options.forceDemo || isServerDemoMode();

  if (isDemo) {
    return demoSatelliteService.getHealth(farmId, lat, lng, options.polygon);
  }

  const provider = options.satelliteService ?? liveSatelliteService;
  try {
    const liveHealth = await provider.getHealth(farmId, lat, lng, options.polygon);
    return liveHealth;
  } catch (err) {
    console.warn(
      `[SatelliteService] Live satellite provider unavailable for farm "${farmId}" (${lat}, ${lng}), using deterministic demo fallback:`,
      err instanceof Error ? err.message : err
    );
    return demoSatelliteService.getHealth(farmId, lat, lng, options.polygon);
  }
}

/**
 * Fetch historical NDVI observation readings with automatic demo fallback.
 */
export async function fetchNDVIHistory(
  farmId = 'demo-soybean-maharashtra',
  lat = 18.2333,
  lng = 76.7167,
  options: SatelliteServiceOptions = {}
): Promise<NDVIReading[]> {
  const health = await fetchSatelliteHealth(farmId, lat, lng, options);
  return health.readings;
}
