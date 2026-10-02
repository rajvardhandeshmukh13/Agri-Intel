// lib/services/satellite/interface.ts
// Provider-agnostic satellite/crop-health service interface.

import type { SatelliteHealth, NDVIReading } from '@/lib/types/satellite';

export interface ISatelliteService {
  /**
   * Get full satellite health summary for a farm.
   */
  getHealth(farmId: string, lat: number, lng: number, polygon?: GeoJSON.Polygon): Promise<SatelliteHealth>;

  /**
   * Get NDVI reading history for a farm.
   */
  getNDVIHistory(farmId: string, lat: number, lng: number): Promise<NDVIReading[]>;
}
