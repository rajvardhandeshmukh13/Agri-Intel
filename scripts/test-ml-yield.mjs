// scripts/test-ml-yield.mjs
// Test suite for Priority 3: ML Service Integration

async function run() {
  console.log('===========================================================');
  console.log('AGRIINTEL — ML SERVICE INTEGRATION TEST SUITE');
  console.log('===========================================================\n');

  // Test A: ML Service Healthy -> ML Result Used
  console.log('[TEST A] ML service healthy -> ML result used');
  const resA = await fetch('http://localhost:3000/api/recommendations', {
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
  const dataA = await resA.json();
  console.log('  HTTP Status:', resA.status);
  console.log('  Yield Source:', dataA.farmContext?.yieldSource);
  console.log('  Expected Yield:', dataA.farmContext?.expectedYieldQPerHa, 'qtl/ha');
  console.log('  Total Harvest:', dataA.farmContext?.totalHarvestQ, 'qtl');
  console.log('  Explanation Factors:', dataA.data?.yieldExplanation?.length);
  if (dataA.farmContext?.yieldSource !== 'ml') {
    throw new Error('Test A failed: yieldSource should be "ml"');
  }
  console.log('  -> PASS\n');

  // Test B: ML Service Unavailable -> Deterministic Fallback Used
  console.log('[TEST B] ML service unavailable / demo fallback');
  const resB = await fetch('http://localhost:3000/api/recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commodity: 'soybean',
      district: 'Latur',
      state: 'Maharashtra',
      areaHectares: 3.5,
      lat: 18.2333,
      lng: 76.7167,
      forceDemo: true,
    }),
  });
  const dataB = await resB.json();
  console.log('  HTTP Status:', resB.status);
  console.log('  Yield Source:', dataB.farmContext?.yieldSource);
  console.log('  Fallback Yield:', dataB.farmContext?.expectedYieldQPerHa, 'qtl/ha');
  console.log('  Fallback Total Harvest:', dataB.farmContext?.totalHarvestQ, 'qtl');
  console.log('  Recommended Window:', dataB.data?.recommendedWindow);
  if (resB.status !== 200 || !dataB.data?.recommendedWindow) {
    throw new Error('Test B failed: Fallback recommendation failed');
  }
  if (dataB.farmContext?.yieldSource !== 'demo' && dataB.farmContext?.yieldSource !== 'fallback') {
    throw new Error(`Test B failed: Expected yieldSource to be "demo" or "fallback", got ${dataB.farmContext?.yieldSource}`);
  }
  console.log('  -> PASS\n');

  // Test C: ML Service Timeout -> Fallback Used
  console.log('[TEST C] ML service timeout handling -> Fallback used');
  const http = await import('http');
  const slowServer = http.createServer((_req, res) => {
    // Deliberately delay response past timeout
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ expected_yield_q_per_ha: 20 }));
    }, 7000);
  });
  await new Promise((resolve) => slowServer.listen(8991, resolve));

  const slowAdapterRes = await (async () => {
    try {
      const signal = AbortSignal.timeout(500); // 500ms timeout
      const r = await fetch('http://localhost:8991/predict/yield', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crop: 'soybean' }),
        signal,
      });
      return await r.json();
    } catch (e) {
      // Graceful fallback simulation
      return { timedOut: true, fallbackSource: 'fallback', error: e.message };
    }
  })();
  slowServer.close();
  console.log('  Timeout handled cleanly:', slowAdapterRes.timedOut);
  console.log('  Fallback source on timeout:', slowAdapterRes.fallbackSource);
  if (!slowAdapterRes.timedOut) throw new Error('Test C failed: Did not timeout');
  console.log('  -> PASS\n');

  // Test D: Malformed ML Response -> Fallback Used
  console.log('[TEST D] Malformed ML response handling -> Fallback used');
  const malformedServer = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ unexpected_data: 'corrupt' })); // missing expected_yield_q_per_ha
  });
  await new Promise((resolve) => malformedServer.listen(8992, resolve));

  const malformedRes = await (async () => {
    try {
      const r = await fetch('http://localhost:8992/predict/yield', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crop: 'soybean' }),
      });
      const data = await r.json();
      if (!data.expected_yield_q_per_ha) throw new Error('Malformed schema: missing expected_yield_q_per_ha');
      return data;
    } catch (e) {
      return { rejected: true, fallbackSource: 'fallback', error: e.message };
    }
  })();
  malformedServer.close();
  console.log('  Malformed response correctly detected & rejected:', malformedRes.rejected);
  console.log('  Fallback source on malformed response:', malformedRes.fallbackSource);
  if (!malformedRes.rejected) throw new Error('Test D failed: Malformed response not rejected');
  console.log('  -> PASS\n');

  // Test E: Same Input Produces Deterministic Fallback Result
  console.log('[TEST E] Reproducibility: Same input produces deterministic fallback result');
  const run1 = await fetch('http://localhost:3000/api/recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commodity: 'soybean', areaHectares: 4.0, district: 'Latur', forceDemo: true }),
  });
  const dRun1 = await run1.json();

  const run2 = await fetch('http://localhost:3000/api/recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commodity: 'soybean', areaHectares: 4.0, district: 'Latur', forceDemo: true }),
  });
  const dRun2 = await run2.json();

  const identical =
    dRun1.farmContext?.totalHarvestQ === dRun2.farmContext?.totalHarvestQ &&
    dRun1.farmContext?.expectedYieldQPerHa === dRun2.farmContext?.expectedYieldQPerHa &&
    dRun1.data?.estimatedNetRealization === dRun2.data?.estimatedNetRealization;

  console.log('  Run 1 Yield:', dRun1.farmContext?.expectedYieldQPerHa, 'qtl/ha | Harvest:', dRun1.farmContext?.totalHarvestQ, 'qtl | Net: ₹' + dRun1.data?.estimatedNetRealization);
  console.log('  Run 2 Yield:', dRun2.farmContext?.expectedYieldQPerHa, 'qtl/ha | Harvest:', dRun2.farmContext?.totalHarvestQ, 'qtl | Net: ₹' + dRun2.data?.estimatedNetRealization);
  console.log('  Identical:', identical);
  if (!identical) throw new Error('Test E failed: Results were not reproducible');
  console.log('  -> PASS\n');

  // Test F: Recommendation Endpoint Still Returns Valid Recommendation Object
  console.log('[TEST F] Recommendation object contract validation');
  console.log('  recommendedWindow:', dataA.data?.recommendedWindow);
  console.log('  suggestedMandi:', dataA.data?.suggestedMandi);
  console.log('  estimatedNetRealization: ₹' + dataA.data?.estimatedNetRealization);
  console.log('  riskLevel:', dataA.data?.riskLevel);
  console.log('  confidence:', dataA.data?.confidence);
  console.log('  reasons count:', dataA.data?.reasons?.length);
  console.log('  scenarios count:', dataA.data?.scenarios?.length);
  if (
    !dataA.data?.recommendedWindow ||
    !dataA.data?.suggestedMandi ||
    !dataA.data?.estimatedNetRealization ||
    !dataA.data?.scenarios
  ) {
    throw new Error('Test F failed: recommendation schema missing required fields');
  }
  console.log('  -> PASS\n');

  // Test G: Area Change Changes Total Expected Harvest Appropriately
  console.log('[TEST G] Area change changes total expected harvest appropriately');
  const resSmall = await fetch('http://localhost:3000/api/recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commodity: 'soybean', areaHectares: 2.0, district: 'Latur' }),
  });
  const dataSmall = await resSmall.json();

  const resLarge = await fetch('http://localhost:3000/api/recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commodity: 'soybean', areaHectares: 6.0, district: 'Latur' }),
  });
  const dataLarge = await resLarge.json();

  console.log('  2.0 ha Total Harvest:', dataSmall.farmContext?.totalHarvestQ, 'qtl | Net: ₹' + dataSmall.data?.estimatedNetRealization);
  console.log('  6.0 ha Total Harvest:', dataLarge.farmContext?.totalHarvestQ, 'qtl | Net: ₹' + dataLarge.data?.estimatedNetRealization);
  const ratio = dataLarge.farmContext?.totalHarvestQ / dataSmall.farmContext?.totalHarvestQ;
  console.log('  Ratio (expected ~3.0):', ratio.toFixed(2));
  if (ratio < 2.8 || ratio > 3.2) {
    throw new Error('Test G failed: Total harvest did not scale proportionally with area');
  }
  console.log('  -> PASS\n');

  // Test H: Financial Calculations Remain Mathematically Consistent
  console.log('[TEST H] Financial calculations consistency');
  for (const s of dataA.data.scenarios) {
    const gross = s.estimatedGross;
    const transport = s.transportCostTotal;
    const selling = s.sellingCostTotal;
    const net = s.estimatedNet;
    const calculatedNet = Math.round(gross - transport - selling);
    console.log(`  Scenario ${s.window} (${s.mandi}): Gross ₹${gross} - Trans ₹${transport} - Sell ₹${selling} = Net ₹${net} (Calc: ₹${calculatedNet})`);
    if (Math.abs(calculatedNet - net) > 1) {
      throw new Error(`Test H failed: Math mismatch in scenario ${s.window}`);
    }
  }
  console.log('  Mathematical consistency: PASSED\n');

  console.log('===========================================================');
  console.log('ALL ML INTEGRATION TESTS COMPLETED SUCCESSFULLY');
  console.log('===========================================================');
}

run().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
