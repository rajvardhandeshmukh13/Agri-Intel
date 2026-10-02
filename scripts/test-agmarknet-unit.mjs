// scripts/test-agmarknet-unit.mjs
// Unit tests for formulas, data normalization, and API resilience

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 === lat2 && lon1 === lon2) return 5;
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(5, Math.round(R * c));
}

function estimateTransportCostPerQtl(distanceKm) {
  return Math.max(5, Math.round((distanceKm / 100) * 30));
}

function normalizeRecord(raw, defaultCommodity) {
  const mandiName = (raw.market || raw.mandi || 'Unknown').trim();
  const minP = parseFloat(String(raw.min_price || raw.minPrice || '0')) || 0;
  const maxP = parseFloat(String(raw.max_price || raw.maxPrice || '0')) || 0;
  const modalP = parseFloat(String(raw.modal_price || raw.modalPrice || minP || '0')) || 0;
  const arrivals = raw.arrivals !== undefined ? parseFloat(String(raw.arrivals)) : undefined;

  return {
    commodity: raw.commodity || defaultCommodity,
    mandiName,
    state: raw.state || 'Maharashtra',
    district: raw.district || mandiName,
    recordedDate: raw.arrival_date || raw.arrivalDate || '2026-10-01',
    minPricePerQuintal: minP,
    maxPricePerQuintal: maxP,
    modalPricePerQuintal: modalP,
    arrivalsQuintals: !isNaN(arrivals ?? NaN) ? arrivals : undefined,
    source: 'agmarknet',
  };
}

async function runUnitTests() {
  console.log('=== TEST A: Distance & Transport Calculations ===');
  const d1 = haversineDistanceKm(18.4088, 76.5604, 18.5204, 73.8567);
  console.log('  Latur to Pune distance:', d1, 'km');
  const t1 = estimateTransportCostPerQtl(d1);
  console.log('  Transport cost:', '₹' + t1 + '/qtl');
  if (d1 < 250 || d1 > 320 || t1 < 80 || t1 > 90) throw new Error('Distance/transport math failed');
  console.log('  -> PASS');

  console.log('=== TEST B: Agmarknet Format Normalization ===');
  const rawGovSample = {
    state: 'Maharashtra',
    district: 'Latur',
    market: 'Latur',
    commodity: 'Soyabean',
    arrival_date: '2026-10-01',
    min_price: '4150',
    max_price: '4350',
    modal_price: '4290',
    arrivals: '250',
  };
  const normalized = normalizeRecord(rawGovSample, 'soybean');
  console.log('  Normalized Record:', normalized);
  if (
    normalized.modalPricePerQuintal !== 4290 ||
    normalized.minPricePerQuintal !== 4150 ||
    normalized.maxPricePerQuintal !== 4350 ||
    normalized.arrivalsQuintals !== 250 ||
    normalized.source !== 'agmarknet'
  ) {
    throw new Error('Normalization assertion failed');
  }
  console.log('  -> PASS');

  console.log('=== TEST C: Malformed Data Handling ===');
  const malformedSample = {
    state: null,
    market: '',
    min_price: 'invalid_num',
    modal_price: null,
  };
  const fallbackNormalized = normalizeRecord(malformedSample, 'soybean');
  console.log('  Malformed Fallback:', fallbackNormalized);
  if (fallbackNormalized.modalPricePerQuintal !== 0 || fallbackNormalized.mandiName !== 'Unknown') {
    throw new Error('Malformed handling failed');
  }
  console.log('  -> PASS');

  console.log('\nALL AGMARKNET UNIT TESTS PASSED!');
}

runUnitTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
