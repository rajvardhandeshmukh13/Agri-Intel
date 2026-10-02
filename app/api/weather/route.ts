// app/api/weather/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchWeatherForecast, fetchWeatherSummary } from '@/lib/services/weather';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawLat = searchParams.get('lat');
    const rawLng = searchParams.get('lng');
    const action = searchParams.get('action') ?? 'summary';
    const rawDays = searchParams.get('days');
    const forceDemo =
      searchParams.get('demo') === 'true' ||
      searchParams.get('mode') === 'demo';

    // Parse lat and lng
    const lat = rawLat !== null && rawLat !== undefined && rawLat.trim() !== ''
      ? parseFloat(rawLat)
      : 18.2333; // Default Latur, Maharashtra
    const lng = rawLng !== null && rawLng !== undefined && rawLng.trim() !== ''
      ? parseFloat(rawLng)
      : 76.7167;

    const days = rawDays ? parseInt(rawDays, 10) : 14;

    if (action === 'forecast') {
      const forecast = await fetchWeatherForecast(lat, lng, { forceDemo, days });
      return NextResponse.json({
        data: forecast,
        source: forecast.source,
        isDemo: forecast.source === 'demo',
      });
    }

    if (action === 'all') {
      const [forecast, summary] = await Promise.all([
        fetchWeatherForecast(lat, lng, { forceDemo, days }),
        fetchWeatherSummary(lat, lng, { forceDemo, days }),
      ]);
      return NextResponse.json({
        data: { forecast, summary },
        source: forecast.source,
        isDemo: forecast.source === 'demo',
      });
    }

    const summary = await fetchWeatherSummary(lat, lng, { forceDemo, days });
    return NextResponse.json({
      data: summary,
      source: summary.source,
      isDemo: summary.source === 'demo',
    });
  } catch (err) {
    console.error('[api/weather] Unhandled error, returning demo fallback:', err instanceof Error ? err.message : 'Unknown');
    // Even in case of an unexpected top-level exception, return safe demo fallback
    const fallback = await fetchWeatherSummary(18.2333, 76.7167, { forceDemo: true });
    return NextResponse.json({
      data: fallback,
      source: 'demo',
      isDemo: true,
    });
  }
}
