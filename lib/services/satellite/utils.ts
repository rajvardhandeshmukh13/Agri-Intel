// lib/services/satellite/utils.ts
// Pure utility functions for satellite coordinate validation, GeoJSON conversion,
// NDVI classification, and deterministic field zone generation.

import type { HealthStatus, HealthZone, SatelliteHealth, NDVIReading } from '@/lib/types/satellite';

export const DEFAULT_LATUR_COORDS = { lat: 18.2333, lng: 76.7167 };

/**
 * Validates latitude and longitude, falling back to default Latur coordinates if invalid.
 */
export function validateCoordinates(
  lat: unknown,
  lng: unknown
): { valid: boolean; lat: number; lng: number } {
  const parsedLat = typeof lat === 'number' ? lat : parseFloat(String(lat));
  const parsedLng = typeof lng === 'number' ? lng : parseFloat(String(lng));

  const valid =
    !isNaN(parsedLat) &&
    !isNaN(parsedLng) &&
    parsedLat >= -90 &&
    parsedLat <= 90 &&
    parsedLng >= -180 &&
    parsedLng <= 180;

  if (!valid) {
    return {
      valid: false,
      lat: DEFAULT_LATUR_COORDS.lat,
      lng: DEFAULT_LATUR_COORDS.lng,
    };
  }

  return { valid: true, lat: parsedLat, lng: parsedLng };
}

/**
 * Validates whether an object is a well-formed GeoJSON Polygon with at least 3 coordinates.
 */
export function validatePolygon(polygon: unknown): boolean {
  if (!polygon || typeof polygon !== 'object') return false;
  const poly = polygon as GeoJSON.Polygon;
  if (poly.type !== 'Polygon' || !Array.isArray(poly.coordinates) || poly.coordinates.length === 0) {
    return false;
  }
  const ring = poly.coordinates[0];
  if (!Array.isArray(ring) || ring.length < 3) return false;

  return ring.every(
    (coord) =>
      Array.isArray(coord) &&
      coord.length >= 2 &&
      typeof coord[0] === 'number' &&
      typeof coord[1] === 'number' &&
      !isNaN(coord[0]) &&
      !isNaN(coord[1])
  );
}

/**
 * Classifies an NDVI value into a farmer-friendly health status.
 * Healthy: NDVI >= 0.60
 * Moderate: 0.40 <= NDVI < 0.60
 * Stressed: NDVI < 0.40
 */
export function classifyNDVI(ndvi: number): HealthStatus {
  if (ndvi >= 0.6) return 'healthy';
  if (ndvi >= 0.4) return 'moderate';
  return 'stressed';
}

/**
 * Converts GeoJSON Polygon [lng, lat] coordinates to Leaflet [lat, lng] coordinate pairs.
 */
export function geoJsonToLeafletCoords(geoJson: GeoJSON.Polygon): [number, number][] {
  if (!validatePolygon(geoJson)) return [];
  const ring = geoJson.coordinates[0];
  if (!ring) return [];
  return ring.map(([lng, lat]) => [lat, lng] as [number, number]);
}

/**
 * Generates a realistic deterministic field boundary and segmented health zones
 * around a center coordinate when raw raster imagery is not available.
 *
 * For a ~3.5 to ~4 hectare field (~200m x ~200m):
 * dLat ~ 0.0018 deg, dLng ~ 0.0022 deg.
 *
 * Zones:
 * - Healthy Zone (55% of field area)
 * - Moderate Zone (35% of field area)
 * - Stressed Zone (10% of field area)
 */
export function generateDeterministicHealthZones(
  centerLat: number,
  centerLng: number,
  healthyPct = 55,
  moderatePct = 35,
  stressedPct = 10
): { fieldBoundary: [number, number][]; healthZones: HealthZone[] } {
  const dLat = 0.0018;
  const dLng = 0.0022;

  const minLat = centerLat - dLat / 2;
  const maxLat = centerLat + dLat / 2;
  const minLng = centerLng - dLng / 2;
  const maxLng = centerLng + dLng / 2;

  // Outer boundary (rectangle)
  const fieldBoundary: [number, number][] = [
    [minLat, minLng],
    [minLat, maxLng],
    [maxLat, maxLng],
    [maxLat, minLng],
    [minLat, minLng],
  ];

  // Divide the field into 3 contiguous, realistic zones:
  // 1. Stressed Zone (SW corner, ~10% area)
  const splitLngWest = minLng + dLng * 0.35;
  const splitLatSouth = minLat + dLat * 0.3;

  const stressedZone: HealthZone = {
    status: 'stressed',
    label: `Stressed Zone (${stressedPct}%)`,
    color: '#ef4444',
    areaPct: stressedPct,
    description: 'Low vegetation vigor, inspect soil moisture or localized pests',
    polygon: [
      [minLat, minLng],
      [minLat, splitLngWest],
      [splitLatSouth, splitLngWest],
      [splitLatSouth, minLng],
      [minLat, minLng],
    ],
  };

  // 2. Moderate Zone (Western/Central strip, ~35% area)
  const splitLngMid = minLng + dLng * 0.55;
  const moderateZone: HealthZone = {
    status: 'moderate',
    label: `Moderate Zone (${moderatePct}%)`,
    color: '#f59e0b',
    areaPct: moderatePct,
    description: 'Adequate vegetative growth, moderate canopy cover',
    polygon: [
      [splitLatSouth, minLng],
      [splitLatSouth, splitLngWest],
      [minLat, splitLngWest],
      [minLat, splitLngMid],
      [maxLat, splitLngMid],
      [maxLat, minLng],
      [splitLatSouth, minLng],
    ],
  };

  // 3. Healthy Zone (Eastern section, ~55% area)
  const healthyZone: HealthZone = {
    status: 'healthy',
    label: `Healthy Zone (${healthyPct}%)`,
    color: '#10b981',
    areaPct: healthyPct,
    description: 'Dense, vigorous canopy with strong chlorophyll activity',
    polygon: [
      [minLat, splitLngMid],
      [minLat, maxLng],
      [maxLat, maxLng],
      [maxLat, splitLngMid],
      [minLat, splitLngMid],
    ],
  };

  return {
    fieldBoundary,
    healthZones: [healthyZone, moderateZone, stressedZone],
  };
}

/**
 * Normalizes satellite health data ensuring fallback defaults and calculations.
 */
export function normalizeSatelliteHealth(
  data: Partial<SatelliteHealth>,
  farmId: string,
  lat: number,
  lng: number,
  polygon?: GeoJSON.Polygon
): SatelliteHealth {
  const validCoords = validateCoordinates(lat, lng);
  const readings: NDVIReading[] = (data.readings || []).map((r) => ({
    farmId: r.farmId || farmId,
    observedAt: r.observedAt || new Date().toISOString(),
    ndvi: typeof r.ndvi === 'number' ? r.ndvi : 0.62,
    healthStatus: r.healthStatus || classifyNDVI(r.ndvi),
    cloudCoverPct: typeof r.cloudCoverPct === 'number' ? r.cloudCoverPct : 10,
    imageUrl: r.imageUrl,
    source: r.source || 'demo',
  }));

  const latestReading = readings[0];
  const latestNdvi = typeof data.latestNdvi === 'number' ? data.latestNdvi : latestReading?.ndvi ?? 0.62;
  const latestStatus = data.latestStatus || classifyNDVI(latestNdvi);

  const avgNdvi =
    typeof data.avgNdvi === 'number'
      ? data.avgNdvi
      : readings.length > 0
      ? Number((readings.reduce((sum, r) => sum + r.ndvi, 0) / readings.length).toFixed(2))
      : 0.65;

  let fieldBoundary = data.fieldBoundary;
  let healthZones = data.healthZones;

  if (polygon && validatePolygon(polygon)) {
    fieldBoundary = geoJsonToLeafletCoords(polygon);
    const ring = polygon.coordinates[0];
    const lats = ring.map((c) => c[1]);
    const lngs = ring.map((c) => c[0]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const dLat = maxLat - minLat;
    const dLng = maxLng - minLng;

    // Generate fitted zones inside polygon's bounding box
    const splitLngWest = minLng + dLng * 0.35;
    const splitLatSouth = minLat + dLat * 0.3;
    const splitLngMid = minLng + dLng * 0.55;

    const stressedPct = data.stressedPct ?? 10;
    const moderatePct = data.moderatePct ?? 35;
    const healthyPct = data.healthyPct ?? 55;

    healthZones = [
      {
        status: 'stressed',
        label: `Stressed Zone (${stressedPct}%)`,
        color: '#ef4444',
        areaPct: stressedPct,
        description: 'Low vegetation vigor, inspect soil moisture or localized pests',
        polygon: [
          [minLat, minLng],
          [minLat, splitLngWest],
          [splitLatSouth, splitLngWest],
          [splitLatSouth, minLng],
          [minLat, minLng],
        ],
      },
      {
        status: 'moderate',
        label: `Moderate Zone (${moderatePct}%)`,
        color: '#f59e0b',
        areaPct: moderatePct,
        description: 'Adequate vegetative growth, moderate canopy cover',
        polygon: [
          [splitLatSouth, minLng],
          [splitLatSouth, splitLngWest],
          [minLat, splitLngWest],
          [minLat, splitLngMid],
          [maxLat, splitLngMid],
          [maxLat, minLng],
          [splitLatSouth, minLng],
        ],
      },
      {
        status: 'healthy',
        label: `Healthy Zone (${healthyPct}%)`,
        color: '#10b981',
        areaPct: healthyPct,
        description: 'Dense, vigorous canopy with strong chlorophyll activity',
        polygon: [
          [minLat, splitLngMid],
          [minLat, maxLng],
          [maxLat, maxLng],
          [maxLat, splitLngMid],
          [minLat, splitLngMid],
        ],
      },
    ];
  }

  if (!fieldBoundary || !healthZones || healthZones.length === 0) {
    const generated = generateDeterministicHealthZones(
      validCoords.lat,
      validCoords.lng,
      data.healthyPct ?? 55,
      data.moderatePct ?? 35,
      data.stressedPct ?? 10
    );
    fieldBoundary = fieldBoundary ?? generated.fieldBoundary;
    healthZones = healthZones ?? generated.healthZones;
  }

  return {
    farmId: data.farmId || farmId,
    latestNdvi,
    avgNdvi,
    latestStatus,
    trend: data.trend || 'stable',
    readings,
    healthyPct: data.healthyPct ?? 55,
    moderatePct: data.moderatePct ?? 35,
    stressedPct: data.stressedPct ?? 10,
    lastObservedAt: data.lastObservedAt || new Date().toISOString(),
    fieldBoundary,
    healthZones,
    source: data.source || 'demo',
  };
}
