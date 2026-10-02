// scripts/test-market.mjs
// Test suite for Market Data Integration (Priority 4)

async function run() {
  console.log('====================================================');
  console.log('AGRIINTEL — MARKET DATA INTEGRATION TEST SUITE');
  console.log('====================================================\n');

  // Test 1: Market Analysis API Route
  console.log('[TEST 1] GET /api/market?action=analysis&commodity=soybean&mandi=Latur');
  const r1 = await fetch('http://localhost:3000/api/market?action=analysis&commodity=soybean&mandi=Latur');
  const d1 = await r1.json();
  console.log('  Status:', r1.status);
  console.log('  Source:', d1.source, '| isDemo:', d1.isDemo);
  console.log('  Current Modal Price:', d1.data?.currentModalPrice);
  console.log('  Trend:', d1.data?.trend?.direction, 'momentum:', d1.data?.trend?.momentum);
  console.log('  Price History Points:', d1.data?.priceHistory?.length);
  console.log('  Nearby Mandis Compared:', d1.data?.nearbyMandis?.length);
  if (r1.status !== 200 || !d1.data?.currentModalPrice) {
    throw new Error('Test 1 failed');
  }
  console.log('  -> PASS\n');

  // Test 2: Mandi Comparison & Net Realization Math
  console.log('[TEST 2] GET /api/market?action=comparison&commodity=soybean&lat=18.2333&lng=76.7167');
  const r2 = await fetch('http://localhost:3000/api/market?action=comparison&commodity=soybean&lat=18.2333&lng=76.7167');
  const d2 = await r2.json();
  console.log('  Status:', r2.status);
  let mathConsistent = true;
  for (const m of d2.data) {
    const net = m.latestRecord.modalPricePerQuintal - m.estimatedTransportCostPerQuintal;
    if (net !== m.estimatedNetPricePerQuintal) mathConsistent = false;
    console.log(`  Rank #${m.priceRank} ${m.mandi.name}: Modal ₹${m.latestRecord.modalPricePerQuintal} - Transport ₹${m.estimatedTransportCostPerQuintal} = Net ₹${m.estimatedNetPricePerQuintal}`);
  }
  console.log('  Mathematical consistency (Modal - Transport = Net):', mathConsistent ? 'PASS' : 'FAIL');
  if (!mathConsistent) throw new Error('Test 2 math failed');
  console.log('  -> PASS\n');

  // Test 3: Forced Demo Fallback
  console.log('[TEST 3] GET /api/market?mode=demo&commodity=soybean');
  const r3 = await fetch('http://localhost:3000/api/market?mode=demo&commodity=soybean');
  const d3 = await r3.json();
  console.log('  Status:', r3.status);
  console.log('  Source:', d3.source, '| isDemo:', d3.isDemo);
  if (d3.source !== 'demo' || !d3.isDemo) throw new Error('Test 3 demo mode failed');
  console.log('  -> PASS\n');

  // Test 4: Invalid/Empty Commodity Handling
  console.log('[TEST 4] GET /api/market?commodity=unknown_crop_999');
  const r4 = await fetch('http://localhost:3000/api/market?commodity=unknown_crop_999');
  const d4 = await r4.json();
  console.log('  Status:', r4.status);
  console.log('  Source:', d4.source, '| isDemo:', d4.isDemo);
  console.log('  Handled safely without 500 error:', r4.status === 200 && !!d4.data);
  if (r4.status !== 200) throw new Error('Test 4 fallback failed');
  console.log('  -> PASS\n');

  // Test 5: Selling Decision Engine Integration
  console.log('[TEST 5] POST /api/recommendations (Selling Decision Engine with integrated market data)');
  const r5 = await fetch('http://localhost:3000/api/recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commodity: 'soybean',
      district: 'Latur',
      state: 'Maharashtra',
      areaHectares: 3.5,
      lat: 18.2333,
      lng: 76.7167,
    }),
  });
  const d5 = await r5.json();
  console.log('  Status:', r5.status);
  console.log('  Recommended Window:', d5.data?.recommendedWindow);
  console.log('  Suggested Mandi:', d5.data?.suggestedMandi);
  console.log('  Estimated Net Realization: ₹' + d5.data?.estimatedNetRealization?.toLocaleString('en-IN'));
  console.log('  Scenarios Count:', d5.data?.scenarios?.length);
  if (r5.status !== 200 || !d5.data?.recommendedWindow) throw new Error('Test 5 engine failed');
  console.log('  -> PASS\n');

  // Test 6: Verify Market Page HTTP Status
  console.log('[TEST 6] GET /market page render');
  const r6 = await fetch('http://localhost:3000/market');
  console.log('  Status:', r6.status);
  if (r6.status !== 200) throw new Error('Test 6 /market page failed');
  console.log('  -> PASS\n');

  console.log('====================================================');
  console.log('ALL API & INTEGRATION TESTS PASSED SUCCESSFULLY');
  console.log('====================================================');
}

run().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
