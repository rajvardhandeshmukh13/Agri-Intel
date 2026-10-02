// lib/utils/geometry.ts
// Pure mathematical functions for spherical parcel geometry and GeoJSON polygons.
// Contains zero DOM / Leaflet dependencies, ensuring 100% SSR safety.

import { DEFAULT_LATUR_COORDS } from '@/lib/services/satellite/utils';

/**
 * Calculates geodesic area of a polygon defined by [lat, lng] vertices in hectares.
 * Uses spherical projection suitable for farm parcels.
 */
export function calculatePolygonAreaHectares(coords: [number, number][]): number {
  if (!coords || coords.length < 3) return 0;
  const R = 6378137; // WGS84 earth radius in meters
  const rad = Math.PI / 180;
  let area = 0;

  for (let i = 0; i < coords.length; i++) {
    const p1 = coords[i];
    const p2 = coords[(i + 1) % coords.length];
    area += (p2[1] - p1[1]) * rad * (2 + Math.sin(p1[0] * rad) + Math.sin(p2[0] * rad));
  }

  area = Math.abs((area * R * R) / 2);
  const ha = area / 10000;
  return Math.max(0.1, Math.round(ha * 100) / 100);
}

/**
 * Generates a rectangular field polygon (~3.5 ha) centered on lat/lng.
 */
export function generateBoxPolygon(lat: number, lng: number): GeoJSON.Polygon {
  const dLat = 0.0018; // ~200m
  const dLng = 0.0022; // ~200m
  const minLat = lat - dLat / 2;
  const maxLat = lat + dLat / 2;
  const minLng = lng - dLng / 2;
  const maxLng = lng + dLng / 2;

  return {
    type: 'Polygon',
    coordinates: [
      [
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat], // Closed ring
      ],
    ],
  };
}

/**
 * Converts a list of [lat, lng] vertices into a closed GeoJSON Polygon.
 */
export function verticesToGeoJson(vertices: [number, number][]): GeoJSON.Polygon {
  if (vertices.length < 3) {
    return generateBoxPolygon(DEFAULT_LATUR_COORDS.lat, DEFAULT_LATUR_COORDS.lng);
  }

  const coords = vertices.map(([lat, lng]) => [lng, lat]);
  // Ensure closed ring
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coords.push([first[0], first[1]]);
  }

  return {
    type: 'Polygon',
    coordinates: [coords],
  };
}

/**
 * Converts GeoJSON polygon coordinates to Leaflet [lat, lng][]
 */
export function geoJsonToLeaflet(poly: GeoJSON.Polygon): [number, number][] {
  if (!poly?.coordinates?.[0]) return [];
  return poly.coordinates[0].map(([lng, lat]) => [lat, lng]);
}
