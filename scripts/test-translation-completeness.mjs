// scripts/test-translation-completeness.mjs
// Automated verification for complete translation coverage across English, Marathi, and Hindi.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const locales = ['en', 'mr', 'hi'];
const catalogs = {};

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function assert(condition, message) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✅ ${message}`);
  } else {
    failedChecks++;
    console.error(`  ❌ ${message}`);
  }
}

console.log('🌐 AgriIntel — Multilingual Translation Completeness Test');
console.log('=========================================================\n');

// 1. Load catalogs
console.log('1. Loading Locale Catalogs:');
for (const loc of locales) {
  const filePath = path.join(rootDir, 'locales', loc, 'common.json');
  assert(fs.existsSync(filePath), `Catalog file exists: locales/${loc}/common.json`);
  const raw = fs.readFileSync(filePath, 'utf-8');
  try {
    catalogs[loc] = JSON.parse(raw);
    assert(typeof catalogs[loc] === 'object', `Valid JSON parsed for locale "${loc}"`);
  } catch (err) {
    assert(false, `Failed to parse JSON for locale "${loc}": ${err.message}`);
  }
}

// Helper to extract flat dotted keys
function getFlatKeys(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      keys.push(...getFlatKeys(v, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const enKeys = getFlatKeys(catalogs.en).sort();
const mrKeys = getFlatKeys(catalogs.mr).sort();
const hiKeys = getFlatKeys(catalogs.hi).sort();

console.log(`\nKey counts: EN (${enKeys.length}), MR (${mrKeys.length}), HI (${hiKeys.length})`);

// 2. Parity check: EN vs MR
console.log('\n2. Checking 1:1 Parity between English and Marathi:');
const missingInMr = enKeys.filter((k) => !mrKeys.includes(k));
const extraInMr = mrKeys.filter((k) => !enKeys.includes(k));

assert(missingInMr.length === 0, `All ${enKeys.length} English keys exist in Marathi (missing: ${missingInMr.join(', ') || 'none'})`);
assert(extraInMr.length === 0, `No extraneous keys in Marathi (extra: ${extraInMr.join(', ') || 'none'})`);

// 3. Parity check: EN vs HI
console.log('\n3. Checking 1:1 Parity between English and Hindi:');
const missingInHi = enKeys.filter((k) => !hiKeys.includes(k));
const extraInHi = hiKeys.filter((k) => !enKeys.includes(k));

assert(missingInHi.length === 0, `All ${enKeys.length} English keys exist in Hindi (missing: ${missingInHi.join(', ') || 'none'})`);
assert(extraInHi.length === 0, `No extraneous keys in Hindi (extra: ${extraInHi.join(', ') || 'none'})`);

// 4. Verify Essential Namespaces are present
console.log('\n4. Verifying Essential Product Namespaces:');
const requiredNamespaces = ['common', 'nav', 'landing', 'auth', 'home', 'farm', 'weather', 'market', 'sell', 'ask', 'onboarding', 'yield'];
for (const ns of requiredNamespaces) {
  assert(Boolean(catalogs.en[ns]), `Namespace "${ns}" present in English`);
  assert(Boolean(catalogs.mr[ns]), `Namespace "${ns}" present in Marathi`);
  assert(Boolean(catalogs.hi[ns]), `Namespace "${ns}" present in Hindi`);
}

// 5. Template variables check (e.g. {name})
console.log('\n5. Template Interpolation Variables Parity:');
for (const key of enKeys) {
  const parts = key.split('.');
  const enVal = catalogs.en[parts[0]]?.[parts[1]];
  const mrVal = catalogs.mr[parts[0]]?.[parts[1]];
  const hiVal = catalogs.hi[parts[0]]?.[parts[1]];

  if (typeof enVal === 'string' && enVal.includes('{')) {
    const matches = enVal.match(/\{[a-zA-Z0-9_]+\}/g) || [];
    for (const placeholder of matches) {
      assert(mrVal && mrVal.includes(placeholder), `Marathi "${key}" preserves interpolation placeholder ${placeholder}`);
      assert(hiVal && hiVal.includes(placeholder), `Hindi "${key}" preserves interpolation placeholder ${placeholder}`);
    }
  }
}

// 6. Non-empty string check
console.log('\n6. Checking for Empty or Corrupt Translations:');
let emptyCount = 0;
for (const loc of locales) {
  const keys = getFlatKeys(catalogs[loc]);
  for (const k of keys) {
    const parts = k.split('.');
    const val = catalogs[loc][parts[0]]?.[parts[1]];
    if (!val || typeof val !== 'string' || val.trim().length === 0) {
      emptyCount++;
      console.error(`  Empty string at ${loc}.${k}`);
    }
  }
}
assert(emptyCount === 0, `All string values across EN, MR, HI are non-empty and well-formed (empty: ${emptyCount})`);

console.log('\n=========================================================');
console.log(`Results: ${passedChecks}/${totalChecks} passed (${failedChecks} failed)`);
if (failedChecks > 0) {
  process.exit(1);
} else {
  console.log('✅ 100% Translation Completeness Verified!\n');
}
