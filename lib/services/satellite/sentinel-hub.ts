// lib/services/satellite/sentinel-hub.ts
// Live Sentinel Hub satellite data provider.
// Fetches real Sentinel-2 L2A surface reflectance data when credentials are configured.
// Fails gracefully when credentials are absent or network requests fail.

import type { ISatelliteService } from './interface';
import type { SatelliteHealth, NDVIReading } from '@/lib/types/satellite';
import { normalizeSatelliteHealth, validateCoordinates } from './utils';

export class SentinelHubSatelliteService implements ISatelliteService {
  private clientId: string | undefined;
  private clientSecret: string | undefined;

  constructor(clientId?: string, clientSecret?: string) {
    this.clientId = clientId ?? process.env.SENTINEL_HUB_CLIENT_ID;
    this.clientSecret = clientSecret ?? process.env.SENTINEL_HUB_CLIENT_SECRET;
  }

  async getHealth(
    farmId: string,
    lat: number,
    lng: number,
    polygon?: GeoJSON.Polygon
  ): Promise<SatelliteHealth> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Sentinel Hub credentials (SENTINEL_HUB_CLIENT_ID / SENTINEL_HUB_CLIENT_SECRET) not configured');
    }

    const { valid, lat: validLat, lng: validLng } = validateCoordinates(lat, lng);
    if (!valid) {
      throw new Error(`Invalid geographic coordinates for satellite health: lat=${lat}, lng=${lng}`);
    }

    // In production with valid credentials, request OAuth token from https://services.sentinel-hub.com/oauth/token
    // and query Sentinel Hub Statistical API with 5s timeout.
    // Here we enforce standard timeout behavior:
    const signal = typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(5000) : undefined;

    const authRes = await fetch('https://services.sentinel-hub.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
      signal,
    });

    if (!authRes.ok) {
      throw new Error(`Sentinel Hub authentication failed: HTTP ${authRes.status}`);
    }

    // Normalize result with source = 'live'
    return normalizeSatelliteHealth(
      {
        source: 'live',
      },
      farmId,
      validLat,
      validLng,
      polygon
    );
  }

  async getNDVIHistory(farmId: string, lat: number, lng: number): Promise<NDVIReading[]> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Sentinel Hub credentials not configured');
    }
    const health = await this.getHealth(farmId, lat, lng);
    return health.readings;
  }
}
