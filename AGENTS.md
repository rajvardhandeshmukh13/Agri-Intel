<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# AgriIntel — Agent Instructions

> **The MVP is already running and verified.** Do not rebuild from scratch.
> Your job is to extend, improve, and integrate the existing system — not replace it.

---

## 1. Project Overview

AgriIntel is a farmer-focused agricultural decision-support platform. It helps farmers make practical decisions by combining:

- Crop and farm profile data
- Real-time or forecast weather conditions
- Satellite-derived crop health (NDVI)
- Yield predictions
- Commodity market prices (mandi data)
- Transport and selling cost estimates
- Sell-timing recommendations with explainable reasoning
- Multilingual AI assistance (Marathi, Hindi, English)

**Primary user:** A smallholder farmer in Maharashtra, India — often on a mobile device.

**Primary goal:** Provide simple, understandable, and actionable information. Do not overwhelm with technical complexity.

---

## 2. Current Baseline — MVP Status

The following features are **verified working** as of the initial build. Do not replace or regress them.

| Screen | Route | Status |
|---|---|---|
| Today Dashboard | `/` | ✅ Working |
| My Farm | `/farm` | ✅ Working |
| Market | `/market` | ✅ Working |
| Sell Decision | `/sell` | ✅ Working |
| Ask AI | `/ask` | ✅ Working |
| Onboarding Wizard | `/onboarding` | ✅ Working |

### Verified feature checklist

**Today screen** — Today's action card · Weather alert · Yield summary · Market price · Crop health · Harvest timeline

**My Farm** — NDVI value · Health status badge · Field area distribution bar · NDVI history bars · Yield prediction · Explanation factors per factor

**Market** — Price hero card · 30-day Recharts line chart · Mandi comparison ranking · Net price per quintal after transport · Transport cost per mandi

**Sell** — Recommended window banner · 3 scenario cards (Sell Now / Wait 7d / Wait 14d) · Net realization breakdown (Gross → Transport → Selling cost → Net → Profit) · "Why this suggestion?" collapsible reasons · Risk/confidence badges · Estimates disclaimer

**Ask AI** — Suggested questions in Marathi, Hindi, English · Demo multilingual responses · Gemini API integration with demo fallback · Web Speech API voice input (where browser supports it) · Voice output via SpeechSynthesis

**Onboarding** — Crop card selection · District dropdown + village input · Farm area + sowing date + irrigation type · Confirmation screen · LocalStorage persistence → dashboard redirect

---

## 3. Repository Structure

```
agriintel/                          ← Next.js 16 app root
├── app/
│   ├── (dashboard)/                ← Route group: dashboard shell + 5 screens
│   │   ├── layout.tsx              ← Demo banner · header · bottom tab nav
│   │   ├── page.tsx                ← Today screen (/)
│   │   ├── farm/page.tsx           ← My Farm screen (/farm)
│   │   ├── market/page.tsx         ← Market screen (/market) — 'use client'
│   │   ├── sell/page.tsx           ← Sell screen (/sell) — 'use client'
│   │   └── ask/page.tsx            ← Ask AI screen (/ask) — 'use client'
│   ├── api/
│   │   ├── ai/route.ts             ← POST /api/ai — Gemini + demo fallback
│   │   ├── market/route.ts         ← GET /api/market — price history + comparison
│   │   ├── weather/route.ts        ← GET /api/weather — forecast + summary
│   │   └── recommendations/        ← POST /api/recommendations — decision engine
│   ├── onboarding/page.tsx         ← 4-step onboarding wizard (standalone layout)
│   ├── globals.css                 ← AgriIntel brand theme (green/amber oklch tokens)
│   └── layout.tsx                  ← Root layout (metadata · fonts · viewport)
│
├── lib/
│   ├── decision-engine/
│   │   ├── market-analyzer.ts      ← Price trend · price projection · volatility
│   │   ├── profit-calculator.ts    ← Gross → transport → selling cost → net
│   │   └── sell-window.ts          ← Core: evaluates 3 windows, picks best
│   ├── services/
│   │   ├── weather/
│   │   │   ├── interface.ts        ← IWeatherService
│   │   │   ├── demo.ts             ← DemoWeatherService (reads demo JSON)
│   │   │   └── open-meteo.ts       ← OpenMeteoWeatherService (live)
│   │   ├── market/
│   │   │   ├── interface.ts        ← IMarketService
│   │   │   ├── demo.ts             ← DemoMarketService (reads demo JSON)
│   │   │   ├── agmarknet.ts        ← AgmarknetMarketService (live data.gov.in)
│   │   │   └── index.ts            ← Fallback orchestrator & exports
│   │   ├── yield/
│   │   │   ├── interface.ts        ← IYieldService
│   │   │   ├── ml-service.ts       ← MLServiceAdapter (FastAPI sidecar client)
│   │   │   ├── fallback.ts         ← DeterministicYieldService (heuristic baseline)
│   │   │   └── index.ts            ← predictYieldWithFallback orchestrator
│   │   └── satellite/
│   │       ├── interface.ts        ← ISatelliteService
│   │       └── demo.ts             ← DemoSatelliteService (reads demo JSON)
│   ├── types/
│   │   ├── farm.ts                 ← FarmProfile · FarmSeason · FarmContext · OnboardingInput
│   │   ├── market.ts               ← MarketRecord · MarketAnalysis · MandiComparison · PriceTrend
│   │   ├── recommendation.ts       ← Scenario · SellRecommendation · ProfitSimulatorInput/Result
│   │   ├── satellite.ts            ← SatelliteHealth · NDVIReading · HealthStatus
│   │   ├── weather.ts              ← WeatherForecast · DailyForecast · WeatherSummary
│   │   └── yield.ts                ← YieldPrediction · YieldModelInputV1 · YieldExplanationFactor
│   └── utils/
│       ├── cn.ts                   ← Tailwind class merging utility
│       ├── demo-mode.ts            ← isDemoMode · withDemoFallback · getDemoBannerText
│       └── format.ts               ← formatINR · formatINR · formatDate · formatNDVI · etc.
│
├── data/demo/                      ← Deterministic demo JSON (do NOT delete)
│   ├── farm-profile.json           ← Patil Farm, Ausa, Latur, Soybean Kharif 2024
│   ├── market-history.json         ← 30 days of mandi price records (5 mandis)
│   ├── recommendation.json         ← Pre-computed sell recommendation
│   ├── satellite-health.json       ← NDVI readings + health distribution
│   ├── weather-forecast.json       ← 14-day daily forecast
│   └── yield-prediction.json       ← Yield estimate + explanation factors
│
├── locales/                        ← next-intl translation files
│   ├── en/common.json
│   ├── mr/common.json              ← Marathi
│   └── hi/common.json              ← Hindi
│
├── ml-service/                     ← FastAPI Python sidecar (optional)
│   ├── main.py                     ← FastAPI app + /health + /predict/yield
│   ├── models/yield_model.py       ← Rule-based yield prediction (sklearn-optional)
│   ├── schemas/yield_input.py      ← Pydantic YieldInputV1 + YieldPredictionOutput
│   └── requirements.txt
│
├── components/                     ← shadcn/ui components (auto-generated)
├── .env.example                    ← Full environment variable reference (safe to commit)
├── .env.local                      ← Active secrets — NEVER commit
├── next.config.ts
├── tsconfig.json                   ← strict: true
└── package.json
```

---

## 4. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router, Turbopack) | 16.3.8 |
| Language | TypeScript (strict mode) | ^5 |
| UI | React | 19.2.8 |
| Styling | Tailwind CSS v4 | ^4 |
| Components | shadcn/ui | ^4.21.1 |
| Charts | Recharts | ^3.10.1 |
| Maps | Leaflet + react-leaflet | installed, not yet rendered live |
| Forms | react-hook-form + zod | installed |
| i18n | next-intl | ^4 |
| AI | @google/generative-ai (Gemini) | ^0.24.1 |
| ML sidecar | FastAPI + uvicorn (Python) | see requirements.txt |
| Demo data | Local JSON (deterministic) | — |

---

## 5. Environment Variables

Copy `.env.example` to `.env.local` and fill as needed.

| Variable | Side | Required | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_DEMO_MODE` | Client + Server | **Yes** | `true` = use demo JSON; `false` = try live APIs |
| `NEXT_PUBLIC_APP_URL` | Client | No | Base URL of the app |
| `GEMINI_API_KEY` | **Server only** | No | AI assistant — demo fallback used if absent |
| `AGMARKNET_API_KEY` | **Server only** | No | Live mandi prices — demo used if absent |
| `AGMARKNET_BASE_URL` | Server | No | `https://api.data.gov.in/resource/` |
| `OPEN_METEO_BASE_URL` | Server | No | `https://api.open-meteo.com/v1/` — free, no key needed |
| `SENTINEL_HUB_CLIENT_ID` | **Server only** | No | Satellite NDVI — demo used if absent |
| `SENTINEL_HUB_CLIENT_SECRET` | **Server only** | No | — |
| `NEXT_PUBLIC_SUPABASE_URL` | Client | No | Farm profile persistence |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | No | — |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | No | Admin Supabase operations |
| `ML_SERVICE_URL` | Server | No | `http://localhost:8000` — FastAPI yield model |
| `DEMO_FARM_ID` | Server | No | `demo-soybean-maharashtra` |
| `GOOGLE_CLOUD_STT_KEY` | **Server only** | No | Enhanced voice input (Web Speech API used as free fallback) |

> **Security rule:** All keys marked "Server only" must **never** appear in client-side code or `NEXT_PUBLIC_` variables.

---

## 6. Demo Mode Architecture

Demo mode is the safety net that keeps every screen working without any external API.

### How it works

```typescript
// lib/utils/demo-mode.ts
withDemoFallback(liveFn, demoFn, label)
```

- If `NEXT_PUBLIC_DEMO_MODE=true` → always calls `demoFn()`
- If the live call throws → automatically falls back to `demoFn()` and logs a warning
- Label is logged for observability

### Service pattern

Every service domain follows this pattern:

```
lib/services/<domain>/
  interface.ts    ← IXxxService (TypeScript interface)
  demo.ts         ← DemoXxxService implements IXxxService (reads data/demo/*.json)
  live.ts         ← LiveXxxService implements IXxxService (calls real API)
```

API routes instantiate both and pass them to `withDemoFallback`.

### Invariant

> The application must display something useful on every screen even when all external APIs are unavailable. Demo mode must never be removed.

---

## 7. Decision Engine

The decision engine lives entirely in `lib/decision-engine/`. UI components must not contain business logic.

### Flow

```
MarketRecord[] + YieldPrediction + WeatherForecast + MandiComparison[]
        ↓
  market-analyzer.ts      → trend direction, 7d/14d projected prices, volatility, arrivals trend
        ↓
  sell-window.ts           → builds 3 Scenario objects (now / 7d / 14d)
        ↓
  profit-calculator.ts     → gross → transport → selling cost → net → profit for each scenario
        ↓
  SellRecommendation       → picks best window, assembles 3–5 human-readable reasons
```

### Rules

- **Every recommendation must be explainable.** The `reasons` array (3–5 items) is mandatory in `SellRecommendation`.
- Use `'estimated'`, `'suggested'`, `'potentially'` — never `'guaranteed'`, `'will definitely'`.
- Risk levels: `'low' | 'moderate' | 'high'`
- Confidence levels: `'low' | 'moderate' | 'high'`
- The UI **must** show the disclaimer: *"These are estimates, not guarantees."*

### Key types

```typescript
// lib/types/recommendation.ts
SellWindow       = 'now' | '7_days' | '14_days'
RiskLevel        = 'low' | 'moderate' | 'high'
ConfidenceLevel  = 'low' | 'moderate' | 'high'
Scenario         → estimatedNet, riskLevel, confidence, weatherRisk, priceRiskPct
SellRecommendation → recommendedWindow, reasons[], scenarios[3], source
```

---

## 8. Key Coding Rules

### TypeScript

- `strict: true` in `tsconfig.json` — never disable it
- Avoid `any`. Use `unknown` and narrow with guards
- All service calls must have typed return values
- Use types from `lib/types/` — do not define domain types inline in components

### Component rules

- Business logic → `lib/decision-engine/` or `lib/services/`
- UI-only logic (toggle state, selected tab) → component local state
- Shared pure formatting → `lib/utils/format.ts`
- Shared class merging → `lib/utils/cn.ts` (wraps `clsx` + `tailwind-merge`)
- Do not duplicate formatting logic across screens

### Styling

- Use Tailwind utility classes
- AgriIntel brand tokens are CSS custom properties in `app/globals.css`:
  - `--primary` = deep forest green
  - `--accent` = warm harvest amber
  - `--health-healthy`, `--health-moderate`, `--health-stressed`
- Do not introduce new color values without adding a token
- Do not use inline styles for colors — use Tailwind classes or CSS variables

### Units and locale

- Currency: always `₹` (Indian Rupees) via `formatINR()` in `lib/utils/format.ts`
- Yield: `qtl` (quintal), `qtl/ha`
- Area: `hectares` or `ha`
- Dates: `formatDate()` → `"15 Oct 2024"`, `formatShortDate()` → `"15 Oct"`
- Use `en-IN` locale for `Intl.NumberFormat` and `toLocaleDateString`

### Do not add libraries unless

- The task cannot reasonably be done with existing dependencies
- The new library adds no meaningful bundle size risk
- You have confirmed it is not already installed in `package.json`

---

## 9. API Route Conventions

All routes live in `app/api/`.

```typescript
// Pattern for every API route
import { NextRequest, NextResponse } from 'next/server';
import { withDemoFallback } from '@/lib/utils/demo-mode';

export async function GET(request: NextRequest) {
  try {
    const data = await withDemoFallback(liveCall, demoCall, 'label');
    return NextResponse.json({ data });
  } catch (err) {
    console.error('[api/xyz]', err);
    return NextResponse.json({ error: 'Friendly message' }, { status: 500 });
  }
}
```

- Use `no-store` cache headers on all API routes (already set in `next.config.ts`)
- Never return raw API errors to the client — log server-side, return a friendly message
- Always return 200 from AI endpoint even on error (so the UI does not crash)

---

## 10. ML Service (FastAPI Python Sidecar)

Located in `ml-service/`. Optional — the Next.js app falls back to demo yield data if unavailable.

```
ml-service/
  main.py                  ← FastAPI app
  models/yield_model.py    ← Rule-based prediction (NDVI + rainfall + soil + irrigation)
  schemas/yield_input.py   ← Pydantic YieldInputV1 + YieldPredictionOutput
  requirements.txt
```

**To start the ML service:**
```bash
cd ml-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Health check:** `GET http://localhost:8000/health`
**Prediction:** `POST http://localhost:8000/predict/yield` with `YieldInputV1` body

The model is currently rule-based and sklearn-optional. It degrades gracefully without sklearn installed.

---

## 11. Multilingual Support

Supported languages: `en` (English), `mr` (Marathi), `hi` (Hindi)

- Translation files: `locales/<lang>/common.json`
- Language detection in Ask AI: simple Devanagari Unicode range heuristic in `app/(dashboard)/ask/page.tsx`
- Voice input: `SpeechRecognition` with `lang='mr-IN'` as default
- Voice output: `SpeechSynthesisUtterance` with matching `lang` attribute
- All farmer-facing text should be clear, short, and jargon-free

---

## 12. Development Priorities (Ordered)

Complete and verify one stage before moving to the next. Do not implement all at once.

**Priority 1 — Open-Meteo weather integration [COMPLETED - Phase 3A]**
- `lib/services/weather/open-meteo.ts` connected to `/api/weather` and recommendations route
- `lib/services/weather/index.ts` provides provider-agnostic fallback orchestration
- Returns live Open-Meteo data when coordinates are valid, with deterministic demo fallback on timeout, error, missing/invalid coordinates, or explicit demo mode (`?mode=demo` / `?demo=true`)
- Tagged with explicit source metadata (`live` vs `demo`), never claiming demo data is live
- Home (`/`) and Farm (`/farm`) updated to consume weather dynamically via `/api/weather` without importing demo weather JSON directly

**Priority 1B — Market Data Integration [COMPLETED - Agmarknet + Fallback]**
- `lib/services/market/agmarknet.ts` connects live Agmarknet/data.gov.in API with timeout (6s) and normalization
- `lib/services/market/index.ts` provides provider-agnostic fallback orchestration
- Returns live Agmarknet prices when API key and records exist; falls back deterministically to demo data on missing key, timeout, error, or explicit demo mode (`?mode=demo`)
- Calculates Haversine distances to mandis, transport costs (₹30/qtl per 100km), net realization, and ranks mandis
- Market page (`/market`) and Selling Decision Engine (`/api/recommendations`) consume the same market service abstraction without importing demo JSON directly

**Priority 2 — Farm profile persistence**
- Currently: `localStorage` in `app/onboarding/page.tsx`
- Target: Supabase (credentials in `.env.local`)
- Add `lib/services/farm/` with `interface.ts` + `local.ts` + `supabase.ts`
- Do not break the localStorage path — it is the demo fallback

**Priority 3 — FastAPI ML service integration [COMPLETED]**
- Created `lib/services/yield/` with `IYieldService` interface, `MLServiceAdapter`, `DeterministicYieldService` baseline, and `predictYieldWithFallback` orchestrator
- Server-side adapter maps camelCase to snake_case (`YieldInputV1`) and calls `POST /predict/yield` on `ML_SERVICE_URL` with 5s timeout
- Next.js `/api/recommendations` combines farm context + live weather + satellite NDVI + historical baselines into `YieldModelInputV1` and feeds the predicted harvest into the Selling Decision Engine
- Graceful degradation: uses ML prediction (`source: 'ml'`) when FastAPI is healthy, falls back to deterministic heuristic (`source: 'fallback'`) on timeout, error, or offline demo mode without crashing
- Re-tested with full automated test suite (`scripts/test-ml-yield.mjs` and `ml-service/test_api.py`) covering tests A–H

**Priority 4 — Vercel deployment**
- Add `vercel.json` if needed
- Ensure `NEXT_PUBLIC_DEMO_MODE=true` in Vercel env for demo deploy
- All server-only keys go into Vercel env (not exposed to client)

**Priority 5 — PWA / offline**
- Add `next-pwa` or equivalent only if explicitly requested
- Service worker must not interfere with API routes

**Priority 6 — Leaflet field map [COMPLETED]**
- Replaced placeholder visualization in `app/(dashboard)/farm/page.tsx` with dynamic client-side `FieldMap` (`components/farm/FieldMap.tsx` with dynamic import and SSR disabled).
- Uses `react-leaflet` with OpenStreetMap CartoDB Positron / OSM tiles, self-contained custom HTML `divIcon` farmer location marker (eliminates 404 image asset issues), automatic boundary fitting (`fitBounds`), and layer switching (Health Zones vs Outer Perimeter).
- Added provider-agnostic satellite service layer in `lib/services/satellite/` (`ISatelliteService`, `SentinelHubSatelliteService`, `DemoSatelliteService`, `normalizeSatelliteHealth`, `generateDeterministicHealthZones`).
- Added internal API endpoint `/api/satellite` supporting coordinates validation, farm context, live provider querying, and deterministic demo fallback with explicit source metadata (`live` vs `demo`).
- Map visualizes segmented crop-health zones (Healthy: 55%, Moderate: 35%, Stressed: 10%) with farmer-friendly colors, badges, and tooltip descriptions.
- Verified with comprehensive test suite (`scripts/test-satellite.mjs`) covering tests A through H and core remote-sensing unit tests; passed `npx tsc --noEmit`, `npm run lint` (0 errors), and `npm run build`.

**Priority 7 — Multilingual Voice + AI Assistant [COMPLETED]**
- Created `lib/i18n/context.tsx` with `LanguageProvider`, `useTranslation` hook, `AppLocale` type, and `LANGUAGES` config. Loads existing `locales/{en,mr,hi}/common.json` files. Persists selection in `localStorage` key `agriintel_lang`.
- Created `components/ui/LanguageSwitcher.tsx` — compact EN / मराठी / हिन्दी pill selector in the dashboard header.
- Created `components/providers/ClientProviders.tsx` wrapper for client-side providers in the Server Component root layout.
- Updated `app/layout.tsx` to wrap children with `ClientProviders` → `LanguageProvider`.
- Updated `app/(dashboard)/layout.tsx` to render translated nav labels via `t('nav.home')` etc., added language switcher to header, and removed hardcoded Soybean crop badge.
- Rewrote `app/(dashboard)/ask/page.tsx` with: farm-context enrichment from `/api/satellite`, `/api/recommendations`, `/api/weather`; translated suggested questions; Web Speech API voice input with language-specific recognition codes (`mr-IN`, `hi-IN`, `en-IN`); SpeechSynthesis TTS play/stop per message; source transparency badges (Demo/AI/Offline); graceful fallback for missing voice/TTS support.
- Rewrote `app/api/ai/route.ts` to accept dynamic `farmContext` object, build rich system prompt with farm data + source transparency + language instruction, and provide contextual deterministic demo fallback when Gemini API key is absent.
- Verified with `scripts/test-ai-multilingual.mjs` covering tests A–L: English/Marathi/Hindi questions with farm context, missing provider → demo fallback, voice unsupported → text fallback, missing farm context, language persistence, translation fallback, demo data transparency, recommendation regression, empty message validation, farm context enrichment.
- All regression suites passed: `test-satellite.mjs` (100%), `test-market.mjs` (100%), `test-ml-yield.mjs` (100%).
- `npx tsc --noEmit` (0 errors), `npm run lint` (0 errors, 5 pre-existing warnings), `npm run build` (success).

**Final Integration & Demo Hardening [COMPLETED]**
- **Exact Integer Financial Math**: Modified `lib/decision-engine/profit-calculator.ts` so `grossRevenue`, `transportCost`, and `sellingCost` are rounded first, guaranteeing `netRealization = gross - transport - selling` and `profit = net - inputCost` to the exact single rupee across all three scenarios (0 off-by-one errors).
- **Gemini Timeout Safeguard**: Added `AbortSignal.timeout(6000)` to `app/api/ai/route.ts` so external Gemini AI calls never hang or block the demo for more than 6 seconds.
- **Dynamic Header Context**: Updated `app/(dashboard)/layout.tsx` to read `getActiveFarmContext()` and dynamically render `{farmName} · {district}, MH` instead of hardcoded `Patil Farm · Latur, MH`.
- **Dynamic Synchronized Home Screen**: Updated `app/(dashboard)/page.tsx` to read `getActiveFarmContext()`, query `/api/recommendations`, and dynamically display the same selling recommendation, harvest, and mandi as the Sell page, with multilingual translation support.
- **Dynamic Synchronized Farm Screen**: Updated `app/(dashboard)/farm/page.tsx` to query `/api/recommendations` and render dynamic yield predictions (ML or area-scaled rule baseline) with explanation factors and source badges instead of hardcoded demo JSON.
- **Universal i18n Integration**: Integrated `useTranslation()` into `page.tsx` (Home), `farm/page.tsx` (Farm), `market/page.tsx` (Market), and `sell/page.tsx` (Sell) for seamless English / मराठी / हिन्दी switching.
- **Audited Security & Providers**: Confirmed 0 secrets or API keys exposed on client. Verified timeouts on Open-Meteo (6s), Agmarknet (6s), Sentinel Hub (5s), FastAPI ML (5s), Gemini (6s).
- **Comprehensive Verification**: Created `scripts/test-final-integration.mjs` (8/8 tests passing, 100%). All 6 test suites passed: final integration (100%), satellite (100%), market (100%), agmarknet (100%), ML yield (100%), multilingual AI (100%).
- `npx tsc --noEmit` (0 errors), `npm run lint` (0 errors, 5 pre-existing warnings), `npm run build` (success).

**Final Product Experience Milestone [COMPLETED]**
- **Public Landing Page**: Created mobile-first, trustworthy landing page (`components/landing/LandingPage.tsx`) at `/` answering: What is AgriIntel? Who is it for? What does it do? How does it work (6 steps)? Feature cards (6 core modules), How to use guide, and realistic disclaimers without exaggerated profit claims.
- **Authentication & Route Modes**: Built unified Supabase Auth + Demo Mode architecture (`lib/auth/supabase.ts`, `lib/auth/context.tsx`). Implemented `/login` and `/signup` routes with one-click Demo access fallback. Protected dashboard routes while dynamically rendering Landing layout when unauthenticated at `/`.
- **Canonical FarmStorage Abstraction**: Created `lib/services/farm/` with `IFarmStorage` interface, `LocalFarmStorage`, `SupabaseFarmStorage`, and unified `farmStorage` singleton. Components do not depend on localStorage/Supabase implementation details. `getActiveFarmContext()` remains canonical context.
- **Precise Farm Location & Field Polygon**: Built Leaflet `FieldLocationPicker` (`components/farm/FieldLocationPicker.tsx`) with GPS geolocation, click marker placement, interactive boundary drawing (vertex points & closed polyline), auto-shape ~3.5 ha box fallback, and spherical geodesic hectare calculation (`lib/utils/geometry.ts`).
- **5-Step Onboarding Wizard**: Updated `app/onboarding/page.tsx` with Step 1 (Crop), Step 2 (District), Step 3 (Precise Map Location & Polygon), Step 4 (Farm Details), Step 5 (Confirmation summary).
- **Satellite Geometry Flow**: Stored GeoJSON polygon passed to `/api/satellite` via GET/POST. `normalizeSatelliteHealth` fits health zones to polygon bounding box and uses polygon as outer boundary.
- **100% Multilingual Parity**: Updated `locales/en/common.json`, `locales/mr/common.json`, and `locales/hi/common.json` with exact 203-key parity across English, Marathi, and Hindi. Verified with `scripts/test-translation-completeness.mjs` (49/49 checks passed).
- **Security Audit**: Audited environment variables and server/client boundaries. 0 secret keys exposed on client.
- **Comprehensive Verification**: Created `scripts/test-product-experience.mjs` (55/55 tests passing, 100%). `npx tsc --noEmit` (0 errors), `npm run lint` (0 errors), `npm run build` (16/16 routes compiled and static prerendered successfully).

**Priority 8 — Dark mode (Optional)**
- Dark CSS tokens already exist in `app/globals.css` (`.dark` class)
- Deferred to protect current hackathon presentation stability

---

## 13. Before Making Any Change

1. **Read the relevant existing file first.** Understand the current implementation.
2. **Check if the feature already exists** — it may already be partially built.
3. **Reuse existing types from `lib/types/`** — do not redefine domain models.
4. **Reuse existing services** — do not duplicate `DemoMarketService`, `DemoWeatherService`, etc.
5. **Preserve all working screens** — a change to `lib/` must not break any `app/` route.
6. **Test after every change** — run `npm run dev` and open the affected route(s) in a browser.

---

## 14. Testing Protocol

After any code change:

1. Run `npm run dev` (already running on port 3000 during active dev)
2. Open the affected route in a browser
3. Verify the screen loads without error overlay or blank page
4. Verify existing functionality on neighbouring screens still works
5. Check browser console for TypeScript or runtime errors
6. Check the dev server terminal for compilation errors or warnings
7. For UI changes: verify on desktop (≥1024px), tablet (768px), and mobile (375px)

**Do not report a change as complete without performing these steps.**

---

## 15. Demo Data Reference

All demo data is deterministic and based on a fictional farmer: **Patil Farm, Ausa village, Latur district, Maharashtra** growing **Soybean, Kharif 2024**.

| File | Contents |
|---|---|
| `farm-profile.json` | 3.5 ha, Black soil, Rainfed, lat/lng for Ausa |
| `market-history.json` | 30 days × 5 mandis (Latur, Sangli, Nanded, Solapur, Pune) |
| `recommendation.json` | Wait 7 days → Sangli, ₹2,21,120 net, Moderate risk |
| `satellite-health.json` | NDVI 0.62, Moderate status, 65% healthy / 25% moderate / 10% stressed |
| `weather-forecast.json` | 14 days, heavy rain Oct 5–6 alert |
| `yield-prediction.json` | 68.25 qtl total, 19.5 qtl/ha, 4 explanation factors |

> Demo data labels are shown to users via the amber banner in the dashboard layout. Do not remove this banner while `NEXT_PUBLIC_DEMO_MODE=true`.

---

## 16. Security Checklist

- [ ] No API keys in `NEXT_PUBLIC_` prefixed variables
- [ ] No secrets in `app/` client components
- [ ] All private keys read only in `app/api/` route handlers (server-side)
- [ ] `.env.local` is in `.gitignore` and never committed
- [ ] `.env.example` contains only empty values — safe to commit
- [ ] No hardcoded credentials in source files

---

## 17. Core Principles

> These are not guidelines — they are invariants of this project.

1. **Demo mode is permanent.** Every live API must have a working demo fallback. Never remove it.
2. **Recommendations are estimates.** Every sell/yield/price output must be labelled as estimated.
3. **Explainability is mandatory.** Every recommendation must include human-readable reasons.
4. **Simplicity first.** The farmer should understand the screen. Avoid technical jargon.
5. **Multilingual by default.** Every farmer-facing string should work in Marathi, Hindi, and English.
6. **No silent regressions.** If a change could break a working screen, test it first.
7. **Fail gracefully.** A single API failure must never blank the entire dashboard.
8. **Modular services.** UI must not be tightly coupled to external APIs — always use the service layer.
