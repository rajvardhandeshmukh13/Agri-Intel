// app/api/market/route.ts
// Market data API route — serves live Agmarknet prices with deterministic demo fallback.

import { NextRequest, NextResponse } from 'next/server';
import {
  fetchMarketAnalysis,
  fetchNearbyMandiComparison,
  fetchPriceHistory,
} from '@/lib/services/market';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const commodity = searchParams.get('commodity') ?? 'soybean';
    const state = searchParams.get('state') ?? 'Maharashtra';
    const mandi = searchParams.get('mandi') ?? 'Latur';
    const action = searchParams.get('action') ?? 'analysis';
    const rawLat = searchParams.get('lat');
    const rawLng = searchParams.get('lng');
    const rawDays = searchParams.get('days');

    const forceDemo =
      searchParams.get('demo') === 'true' ||
      searchParams.get('mode') === 'demo';

    const farmLat = rawLat !== null && !isNaN(parseFloat(rawLat)) ? parseFloat(rawLat) : 18.2333;
    const farmLng = rawLng !== null && !isNaN(parseFloat(rawLng)) ? parseFloat(rawLng) : 76.7167;
    const days = rawDays !== null && !isNaN(parseInt(rawDays, 10)) ? parseInt(rawDays, 10) : 30;

    if (action === 'comparison') {
      const comparison = await fetchNearbyMandiComparison(commodity, state, farmLat, farmLng, { forceDemo });
      const recordSource = comparison[0]?.latestRecord.source ?? (forceDemo ? 'demo' : 'agmarknet');
      return NextResponse.json({
        data: comparison,
        source: recordSource,
        isDemo: recordSource === 'demo',
      });
    }

    if (action === 'history') {
      const history = await fetchPriceHistory(commodity, mandi, state, days, { forceDemo });
      const recordSource = history[0]?.source ?? (forceDemo ? 'demo' : 'agmarknet');
      return NextResponse.json({
        data: history,
        source: recordSource,
        isDemo: recordSource === 'demo',
      });
    }

    // Default: full analysis (history + trend + comparison)
    const analysis = await fetchMarketAnalysis(commodity, mandi, state, farmLat, farmLng, { forceDemo, days });
    return NextResponse.json({
      data: analysis,
      source: analysis.source,
      isDemo: analysis.source === 'demo',
    });
  } catch (err) {
    console.error('[api/market] Unhandled error, returning safe demo fallback:', err instanceof Error ? err.message : 'Unknown');
    const fallback = await fetchMarketAnalysis('soybean', 'Latur', 'Maharashtra', 18.2333, 76.7167, { forceDemo: true });
    return NextResponse.json({
      data: fallback,
      source: 'demo',
      isDemo: true,
    });
  }
}
