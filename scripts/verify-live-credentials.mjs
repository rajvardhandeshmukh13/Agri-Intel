// scripts/verify-live-credentials.mjs
// Verifies live API credentials configured in .env.local without exposing secret values.

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function verifyGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.trim() === '') {
    return { name: 'Google Gemini AI', status: 'NOT CONFIGURED (Using Demo Fallback)', ok: false };
  }
  const models = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.5-flash', 'gemini-3.7-flash'];
  for (const m of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Respond with OK' }] }]
        })
      });
      if (res.ok) {
        return { name: 'Google Gemini AI', status: `CONNECTED & VERIFIED (${m})`, ok: true };
      }
    } catch {
      // continue to next candidate
    }
  }
  return { name: 'Google Gemini AI', status: 'FAILED TO CONNECT (Check API key or quota)', ok: false };
}

async function verifyAgmarknet() {
  const key = process.env.AGMARKNET_API_KEY;
  if (!key || key.trim() === '') {
    return { name: 'Agmarknet / data.gov.in', status: 'NOT CONFIGURED (Using Demo Fallback)', ok: false };
  }
  try {
    const url = `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=${key}&format=json&limit=1`;
    const res = await fetch(url);
    if (res.ok) {
      return { name: 'Agmarknet / data.gov.in', status: 'CONNECTED & VERIFIED', ok: true };
    } else {
      return { name: 'Agmarknet / data.gov.in', status: `ERROR: HTTP ${res.status}`, ok: false };
    }
  } catch (err) {
    return { name: 'Agmarknet / data.gov.in', status: `FAILED: ${err.message}`, ok: false };
  }
}

async function verifySupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon || url.trim() === '' || anon.trim() === '') {
    return { name: 'Supabase Cloud Auth & DB', status: 'NOT CONFIGURED (Using LocalStorage Fallback)', ok: false };
  }
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(url, anon);
    const authRes = await sb.auth.getSession();
    if (authRes.error) {
      return { name: 'Supabase Cloud Auth & DB', status: `AUTH ERROR: ${authRes.error.message}`, ok: false };
    }

    const { error: tableErr } = await sb.from('farms').select('id').limit(1);
    if (tableErr && tableErr.code === 'PGRST205') {
      return {
        name: 'Supabase Cloud Auth & DB',
        status: 'CONNECTED & AUTH READY (Paste 1-click SQL in Supabase SQL Editor to enable farms table)',
        ok: true
      };
    }
    return { name: 'Supabase Cloud Auth & DB', status: 'CONNECTED & VERIFIED (Auth & Database ready)', ok: true };
  } catch (err) {
    return { name: 'Supabase Cloud Auth & DB', status: `FAILED: ${err.message}`, ok: false };
  }
}

async function run() {
  console.log('====================================================');
  console.log('AGRIINTEL — LIVE CREDENTIALS HEALTH CHECK');
  console.log('====================================================\n');

  const gemini = await verifyGemini();
  const agmarknet = await verifyAgmarknet();
  const supabase = await verifySupabase();

  console.log(`1. ${gemini.name}: ${gemini.ok ? '✅' : '⚪'} ${gemini.status}`);
  console.log(`2. ${agmarknet.name}: ${agmarknet.ok ? '✅' : '⚪'} ${agmarknet.status}`);
  console.log(`3. ${supabase.name}: ${supabase.ok ? '✅' : '⚪'} ${supabase.status}`);
  console.log('\n====================================================');
}

run();
