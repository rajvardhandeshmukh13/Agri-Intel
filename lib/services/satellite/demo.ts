// lib/services/satellite/demo.ts
// Deterministic demo satellite service — returns reproducible satellite health,
// NDVI history, field boundaries, and segmented health zones.

import type { ISatelliteService } from './interface';
import type { SatelliteHealth, NDVIReading } from '@/lib/types/satellite';
import satelliteData from '@/data/demo/satellite-health.json';
import { normalizeSatelliteHealth } from './utils';

export class DemoSatelliteService implements ISatelliteService {
  async getHealth(farmId = 'demo-soybean-maharashtra', lat = 18.2333, lng = 76.7167, polygon?: GeoJSON.Polygon): Promise<SatelliteHealth> {
    const raw: Partial<SatelliteHealth> = {
      farmId: farmId || satelliteData.farmId,
      latestNdvi: satelliteData.latestNdvi,
      latestStatus: satelliteData.latestStatus as SatelliteHealth['latestStatus'],
      trend: satelliteData.trend as SatelliteHealth['trend'],
      readings: satelliteData.readings.map((r) => ({
        ...r,
        farmId: farmId || r.farmId,
        healthStatus: r.healthStatus as NDVIReading['healthStatus'],
        source: 'demo' as const,
      })),
      healthyPct: satelliteData.healthyPct,
      moderatePct: satelliteData.moderatePct,
      stressedPct: satelliteData.stressedPct,
      lastObservedAt: satelliteData.lastObservedAt,
      source: 'demo' as const,
    };

    return normalizeSatelliteHealth(raw, farmId, lat, lng, polygon);
  }

  async getNDVIHistory(farmId = 'demo-soybean-maharashtra', _lat = 18.2333, _lng = 76.7167): Promise<NDVIReading[]> {
    void _lat;
    void _lng;
    return satelliteData.readings.map((r) => ({
      farmId: farmId || r.farmId,
      observedAt: r.observedAt,
      ndvi: r.ndvi,
      healthStatus: r.healthStatus as NDVIReading['healthStatus'],
      cloudCoverPct: r.cloudCoverPct,
      source: 'demo' as const,
    }));
  }
}
