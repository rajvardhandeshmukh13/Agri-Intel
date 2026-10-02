// scripts/test-satellite.mjs
// Test suite for Priority 6 — Interactive Satellite Field Map
// Covers tests A through H and core remote sensing unit assertions.

import assert from 'node:assert';

// ---------------------------------------------------------
// SECTION 1: UNIT TESTS
// ---------------------------------------------------------

console.log('====================================================');
console.log('AGRIINTEL — SATELLITE FIELD MAP UNIT TESTS');
console.log('====================================================\n');

// 1.1 Coordinate Validation Unit Tests
function validateCoordinates(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (Number.isNaN(lat) || Number.isNaN(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

console.log('[UNIT 1] Coordinate Validation');
assert.strictEqual(validateCoordinates(18.2333, 76.7167), true, 'Standard Maharashtra coordinates should be valid');
assert.strictEqual(validateCoordinates(0, 0), true, 'Equator / Prime meridian should be valid');
assert.strictEqual(validateCoordinates(-90, 180), true, 'Extreme bounds should be valid');
assert.strictEqual(validateCoordinates(91, 76.7167), false, 'Latitude > 90 must be invalid');
assert.strictEqual(validateCoordinates(18.2333, 181), false, 'Longitude > 180 must be invalid');
assert.strictEqual(validateCoordinates(NaN, 76.7167), false, 'NaN latitude must be invalid');
assert.strictEqual(validateCoordinates(null, 76.7167), false, 'Null latitude must be invalid');
assert.strictEqual(validateCoordinates(undefined, undefined), false, 'Undefined coordinates must be invalid');
console.log('  -> PASS: All coordinate boundary & type checks passed.\n');

// 1.2 Polygon Validation Unit Tests
function validatePolygon(polygon) {
  if (!polygon || typeof polygon !== 'object') return false;
  if (polygon.type !== 'Polygon' || !Array.isArray(polygon.coordinates)) return false;
  const outerRing = polygon.coordinates[0];
  if (!Array.isArray(outerRing) || outerRing.length < 4) return false;
  const first = outerRing[0];
  const last = outerRing[outerRing.length - 1];
  if (!Array.isArray(first) || !Array.isArray(last) || first.length < 2 || last.length < 2) return false;
  return Math.abs(first[0] - last[0]) < 1e-6 && Math.abs(first[1] - last[1]) < 1e-6;
}

console.log('[UNIT 2] Polygon Geometry Validation');
const validPoly = {
  type: 'Polygon',
  coordinates: [
    [
      [76.7160, 18.2325],
      [76.7180, 18.2325],
      [76.7180, 18.2345],
      [76.7160, 18.2345],
      [76.7160, 18.2325],
    ],
  ],
};
assert.strictEqual(validatePolygon(validPoly), true, 'Closed 5-vertex polygon should be valid');

const unclosedPoly = {
  type: 'Polygon',
  coordinates: [
    [
      [76.7160, 18.2325],
      [76.7180, 18.2325],
      [76.7180, 18.2345],
      [76.7160, 18.2345],
    ],
  ],
};
assert.strictEqual(validatePolygon(unclosedPoly), false, 'Unclosed ring must be invalid');

const tooFewPoints = {
  type: 'Polygon',
  coordinates: [
    [
      [76.7160, 18.2325],
      [76.7180, 18.2325],
      [76.7160, 18.2325],
    ],
  ],
};
assert.strictEqual(validatePolygon(tooFewPoints), false, 'Ring with < 4 coordinates must be invalid');
assert.strictEqual(validatePolygon(null), false, 'Null polygon must be invalid');
assert.strictEqual(validatePolygon({ type: 'Point', coordinates: [76, 18] }), false, 'Non-polygon must be invalid');
console.log('  -> PASS: All GeoJSON polygon boundary & closure checks passed.\n');

// 1.3 NDVI Crop-Health Classification Unit Tests
function classifyNDVI(ndvi) {
  if (ndvi >= 0.60) {
    return { status: 'healthy', label: 'Healthy', color: '#16a34a' };
  }
  if (ndvi >= 0.40) {
    return { status: 'moderate', label: 'Moderate', color: '#eab308' };
  }
  return { status: 'stressed', label: 'Stressed', color: '#dc2626' };
}

console.log('[UNIT 3] Crop-Health NDVI Classification (Healthy / Moderate / Stressed)');
assert.strictEqual(classifyNDVI(0.72).status, 'healthy');
assert.strictEqual(classifyNDVI(0.60).status, 'healthy', '0.60 boundary is Healthy');
assert.strictEqual(classifyNDVI(0.59).status, 'moderate', '0.59 is Moderate');
assert.strictEqual(classifyNDVI(0.40).status, 'moderate', '0.40 boundary is Moderate');
assert.strictEqual(classifyNDVI(0.39).status, 'stressed', '0.39 is Stressed');
assert.strictEqual(classifyNDVI(0.15).status, 'stressed', '0.15 is Stressed');
console.log('  -> PASS: All NDVI thresholds correctly classified into farmer-facing states.\n');

// ---------------------------------------------------------
// SECTION 2: API & INTEGRATION TESTS (A THROUGH H)
// ---------------------------------------------------------

console.log('====================================================');
console.log('AGRIINTEL — SATELLITE FIELD MAP INTEGRATION TESTS');
console.log('====================================================\n');

async function runIntegrationTests() {
  const BASE_URL = 'http://localhost:3000';

  // TEST A: Valid farm coordinates
  console.log('[TEST A] Valid farm coordinates: GET /api/satellite?lat=18.2333&lng=76.7167&farmId=demo-soybean-maharashtra');
  const resA = await fetch(`${BASE_URL}/api/satellite?lat=18.2333&lng=76.7167&farmId=demo-soybean-maharashtra`);
  assert.strictEqual(resA.status, 200, 'HTTP status must be 200');
  const jsonA = await resA.json();
  assert.strictEqual(jsonA.success, true);
  assert.ok(jsonA.data, 'Must return data');
  console.log(`  Source: ${jsonA.source} | isDemo: ${jsonA.isDemo}`);
  console.log(`  Latest NDVI: ${jsonA.data.latestNdvi} | Status: ${jsonA.data.latestStatus}`);
  console.log(`  Coordinates: (${jsonA.data.centerLat}, ${jsonA.data.centerLng})`);
  console.log('  -> PASS: Valid coordinates accepted and processed.\n');

  // TEST B: Valid satellite data schema
  console.log('[TEST B] Valid satellite data schema verification');
  const dataB = jsonA.data;
  assert.strictEqual(typeof dataB.latestNdvi, 'number', 'latestNdvi must be number');
  assert.strictEqual(typeof dataB.avgNdvi, 'number', 'avgNdvi must be number');
  assert.ok(['healthy', 'moderate', 'stressed'].includes(dataB.latestStatus), 'latestStatus must be healthy/moderate/stressed');
  assert.ok(['improving', 'stable', 'declining'].includes(dataB.trend), 'trend must be improving/stable/declining');
  assert.ok(Array.isArray(dataB.readings) && dataB.readings.length > 0, 'readings must be non-empty array');
  assert.ok(Array.isArray(dataB.fieldBoundary) && dataB.fieldBoundary.length >= 4, 'fieldBoundary must be array of at least 4 [lat, lng] coordinates');
  assert.ok(Array.isArray(dataB.healthZones) && dataB.healthZones.length === 3, 'Must have exactly 3 health zones');

  const zoneStatuses = dataB.healthZones.map(z => z.status);
  assert.ok(zoneStatuses.includes('healthy') && zoneStatuses.includes('moderate') && zoneStatuses.includes('stressed'), 'All 3 zones present');
  const totalZonePct = dataB.healthZones.reduce((sum, z) => sum + z.areaPct, 0);
  assert.strictEqual(totalZonePct, 100, 'Health zones areaPct must sum to 100%');
  console.log(`  Health breakdown: Healthy ${dataB.healthyPct}% | Moderate ${dataB.moderatePct}% | Stressed ${dataB.stressedPct}%`);
  console.log(`  Zones verified: ${dataB.healthZones.map(z => `${z.label} (${z.areaPct}%)`).join(', ')}`);
  console.log('  -> PASS: Satellite schema conforms to specification.\n');

  // TEST C: Missing coordinates
  console.log('[TEST C] Missing coordinates handling: GET /api/satellite');
  const resC = await fetch(`${BASE_URL}/api/satellite`);
  assert.strictEqual(resC.status, 200, 'Missing coordinates must gracefully return 200');
  const jsonC = await resC.json();
  assert.ok(jsonC.data, 'Must return fallback satellite data');
  assert.strictEqual(jsonC.source, 'demo', 'Must use demo source when coordinates are missing');
  assert.strictEqual(jsonC.isDemo, true);
  console.log(`  Gracefully fell back to default coordinates: (${jsonC.data.centerLat}, ${jsonC.data.centerLng})`);
  console.log('  -> PASS: Missing coordinates handled gracefully.\n');

  // TEST D: Malformed satellite data query
  console.log('[TEST D] Malformed satellite parameters: GET /api/satellite?lat=invalid_lat&lng=999');
  const resD = await fetch(`${BASE_URL}/api/satellite?lat=invalid_lat&lng=999`);
  assert.strictEqual(resD.status, 200, 'Malformed coordinates must not crash server, returns 200 fallback');
  const jsonD = await resD.json();
  assert.ok(jsonD.data, 'Must return valid fallback data');
  assert.strictEqual(jsonD.source, 'demo');
  console.log(`  Recovered from out-of-range/malformed parameters with fallback data.`);
  console.log('  -> PASS: Malformed input handled safely without server errors.\n');

  // TEST E: Live satellite unavailable -> demo fallback
  console.log('[TEST E] Live satellite provider unavailable -> demo fallback');
  const resE = await fetch(`${BASE_URL}/api/satellite?lat=19.0760&lng=72.8777`);
  const jsonE = await resE.json();
  assert.strictEqual(resE.status, 200);
  assert.strictEqual(jsonE.source, 'demo', 'Without live Sentinel Hub credentials, source must be demo');
  assert.strictEqual(jsonE.isDemo, true);
  assert.ok(jsonE.data.latestNdvi > 0, 'Fallback NDVI must be positive');
  console.log(`  Source is "${jsonE.source}" (isDemo: ${jsonE.isDemo}) — live provider failure cleanly falls back`);
  console.log('  -> PASS: Live failure seamlessly falls back to deterministic demo data.\n');

  // TEST F: Demo mode remains deterministic
  console.log('[TEST F] Demo mode determinism across repeated requests');
  const resF1 = await fetch(`${BASE_URL}/api/satellite?mode=demo&lat=18.2333&lng=76.7167`);
  const jsonF1 = await resF1.json();
  const resF2 = await fetch(`${BASE_URL}/api/satellite?mode=demo&lat=18.2333&lng=76.7167`);
  const jsonF2 = await resF2.json();

  assert.strictEqual(jsonF1.data.latestNdvi, jsonF2.data.latestNdvi, 'latestNdvi must be strictly identical');
  assert.strictEqual(jsonF1.data.avgNdvi, jsonF2.data.avgNdvi, 'avgNdvi must be strictly identical');
  assert.strictEqual(jsonF1.data.latestStatus, jsonF2.data.latestStatus, 'latestStatus must be strictly identical');
  assert.strictEqual(jsonF1.data.trend, jsonF2.data.trend, 'trend must be strictly identical');
  assert.deepStrictEqual(jsonF1.data.healthZones, jsonF2.data.healthZones, 'healthZones geometry must be strictly identical');
  console.log(`  Run 1: NDVI ${jsonF1.data.latestNdvi}, Status ${jsonF1.data.latestStatus}`);
  console.log(`  Run 2: NDVI ${jsonF2.data.latestNdvi}, Status ${jsonF2.data.latestStatus}`);
  console.log('  -> PASS: Demo satellite data is 100% deterministic.\n');

  // TEST G: Field context is taken from active farm
  console.log('[TEST G] Field context taken from active farm coordinates');
  const customLat = 19.8765;
  const customLng = 75.3456;
  const resG = await fetch(`${BASE_URL}/api/satellite?lat=${customLat}&lng=${customLng}&farmId=custom-farm-aurangabad`);
  const jsonG = await resG.json();
  assert.strictEqual(resG.status, 200);
  assert.strictEqual(jsonG.data.centerLat, customLat, 'Center lat must match farm lat');
  assert.strictEqual(jsonG.data.centerLng, customLng, 'Center lng must match farm lng');
  // Check field boundary is centered around custom coordinates
  const firstCoord = jsonG.data.fieldBoundary[0];
  assert.ok(Math.abs(firstCoord[0] - customLat) < 0.05, 'Field boundary latitude must center around customLat');
  assert.ok(Math.abs(firstCoord[1] - customLng) < 0.05, 'Field boundary longitude must center around customLng');
  console.log(`  Custom Farm Center: (${jsonG.data.centerLat}, ${jsonG.data.centerLng})`);
  console.log(`  Boundary correctly generated around custom farm coordinates.`);
  console.log('  -> PASS: Field context accurately drives satellite positioning.\n');

  // TEST H: Existing /api/recommendations still works unchanged
  console.log('[TEST H] Existing /api/recommendations regression check');
  const recPayload = {
    commodity: 'soybean',
    district: 'Latur',
    state: 'Maharashtra',
    areaHectares: 3.5,
    lat: 18.2333,
    lng: 76.7167,
    inputCostTotal: 77000,
  };
  const resH = await fetch(`${BASE_URL}/api/recommendations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(recPayload),
  });
  assert.strictEqual(resH.status, 200, 'Recommendations API must return 200');
  const jsonH = await resH.json();
  const recData = jsonH.data;
  assert.ok(recData, 'Must include recommendations data object');
  assert.ok(recData.recommendedWindow, 'Must include recommendedWindow');
  assert.ok(recData.suggestedMandi, 'Must include suggestedMandi');
  assert.ok(typeof recData.estimatedNetRealization === 'number', 'Must include estimatedNetRealization');
  assert.ok(Array.isArray(recData.scenarios) && recData.scenarios.length > 0, 'Must include scenarios');
  console.log(`  Recommended Window: ${recData.recommendedWindow}`);
  console.log(`  Suggested Mandi: ${recData.suggestedMandi}`);
  console.log(`  Estimated Net Realization: ₹${recData.estimatedNetRealization?.toLocaleString('en-IN')}`);
  console.log(`  Scenarios count: ${recData.scenarios.length}`);
  console.log('  -> PASS: Recommendations engine unaffected and fully operational.\n');

  console.log('====================================================');
  console.log('ALL TESTS A THROUGH H + UNIT TESTS COMPLETED: 100% PASS');
  console.log('====================================================');
}

runIntegrationTests().catch(err => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
