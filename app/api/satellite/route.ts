// app/api/satellite/route.ts
// Satellite & crop-health API route — serves satellite NDVI, field boundaries,
// and segmented health zones with deterministic demo fallback.
// Supports custom farm polygons via GET or POST.

import { NextRequest, NextResponse } from 'next/server';
import { fetchSatelliteHealth, validateCoordinates, validatePolygon } from '@/lib/services/satellite';

function parsePolygon(raw: unknown): GeoJSON.Polygon | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'object' && validatePolygon(raw)) {
    return raw as GeoJSON.Polygon;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (validatePolygon(parsed)) {
        return parsed as GeoJSON.Polygon;
      }
    } catch {
      // not valid json string
    }
  }
  return undefined;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawLat = searchParams.get('lat');
    const rawLng = searchParams.get('lng');
    const farmId = searchParams.get('farmId') || 'demo-soybean-maharashtra';
    const forceDemo =
      searchParams.get('demo') === 'true' ||
      searchParams.get('mode') === 'demo';
    const polygon = parsePolygon(searchParams.get('polygon'));

    const { lat, lng } = validateCoordinates(rawLat, rawLng);

    const data = await fetchSatelliteHealth(farmId, lat, lng, { forceDemo, polygon });

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        centerLat: lat,
        centerLng: lng,
      },
      source: data.source,
      isDemo: data.source === 'demo',
    });
  } catch (err) {
    console.error('[api/satellite] Unhandled error, returning safe demo fallback:', err instanceof Error ? err.message : 'Unknown');
    const fallback = await fetchSatelliteHealth('demo-soybean-maharashtra', 18.2333, 76.7167, { forceDemo: true });
    return NextResponse.json({
      success: true,
      data: {
        ...fallback,
        centerLat: 18.2333,
        centerLng: 76.7167,
      },
      source: 'demo',
      isDemo: true,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawLat = body.lat;
    const rawLng = body.lng;
    const farmId = body.farmId || 'demo-soybean-maharashtra';
    const forceDemo = body.demo === true || body.mode === 'demo';
    const polygon = parsePolygon(body.polygon || body.fieldGeoJson);

    const { lat, lng } = validateCoordinates(rawLat, rawLng);

    const data = await fetchSatelliteHealth(farmId, lat, lng, { forceDemo, polygon });

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        centerLat: lat,
        centerLng: lng,
      },
      source: data.source,
      isDemo: data.source === 'demo',
    });
  } catch (err) {
    console.error('[api/satellite POST] Error, returning fallback:', err instanceof Error ? err.message : 'Unknown');
    const fallback = await fetchSatelliteHealth('demo-soybean-maharashtra', 18.2333, 76.7167, { forceDemo: true });
    return NextResponse.json({
      success: true,
      data: {
        ...fallback,
        centerLat: 18.2333,
        centerLng: 76.7167,
      },
      source: 'demo',
      isDemo: true,
    });
  }
}
