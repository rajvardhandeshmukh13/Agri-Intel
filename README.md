# AgriIntel — AI Crop Yield & Market Intelligence Platform

AgriIntel is a decision-support platform designed for Indian farmers. It bridges agronomic intelligence, satellite remote sensing, machine learning yield forecasts, and live APMC mandi pricing to answer the most critical question: **"When and where should I sell to maximize net income?"**

---

## 🌟 Key Architecture & Capabilities

1. **Multilingual Voice & Chat AI Assistant (`/ask`)**:
   - Powered by **Google Gemini** with intelligent agricultural prompt engineering.
   - Responds in natural **Marathi (मराठी)**, **Hindi (हिन्दी)**, and **English**.
   - Context-aware: incorporates registered farm crop, area, location, and soil metrics.

2. **Crop Health & Satellite NDVI (`/farm`)**:
   - Field polygon boundary mapping with centroid geo-coordinates.
   - 10-meter resolution NDVI vegetation vigour indexing.

3. **Machine Learning Yield Prediction Engine (`ml-service`)**:
   - Python FastAPI microservice running an explainable `RandomForestRegressor`.
   - Trained on Maharashtra agronomic field datasets (98.2% $R^2$ accuracy).
   - Dynamic feature attribution explaining weather, soil moisture, and district baselines.

4. **Live Mandi Market & Geo-Distance Transport Analyzer (`/market`)**:
   - Daily modal prices across major Maharashtra APMC mandis (*Satara, Pune, Sangli, Solapur, Latur*).
   - Real-world **Haversine geo-distance calculations** from farm coordinates.
   - Net realization profit rankings after deducting transportation freight (₹30/qtl per 100km).

5. **Sell Window Decision Advisor (`/sell`)**:
   - Actionable **"Sell Today vs. Wait 7 Days"** optimization engine.
   - Calculates projected price trajectory vs storage loss and demurrage.

6. **Cloud Database & Authentication**:
   - Supabase PostgreSQL with strict Row Level Security (RLS) policies.

---

## 🚀 Tech Stack

- **Frontend & Serverless API**: Next.js 16 (App Router), React 19, TypeScript, Vanilla CSS Tokens
- **AI Intelligence**: Google Gemini API (`gemini-3.5-flash-lite`, `gemini-3.8-flash`)
- **Backend ML Microservice**: FastAPI, scikit-learn, pandas, numpy, Uvicorn
- **Cloud Database & Auth**: Supabase PostgreSQL (pgcrypto, RLS)
- **Weather Feed**: Open-Meteo API
- **Deployment**: Vercel Multi-Service Platform & Docker Compose

---

## 🛠️ Local Development

### 1. Prerequisites
- Node.js 20+
- Python 3.10+

### 2. Setup Web Application
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

### 3. Setup ML Sidecar
```bash
cd ml-service
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
python train.py
uvicorn main:app --port 8000 --reload
```

## ML Price Forecast (decision engine)

The sell-window engine uses a 7d/14d mandi price forecast (p10/p50/p90 bands) from the `ml-service` sidecar.

```bash
cd ml-service
python train_price.py          # trains models/price_model.pkl
uvicorn main:app --port 8000   # exposes POST /predict/price
```

- Falls back automatically to the old trend heuristic if the service is down/untrained, history is < 3 records, or demo mode is on (`recommendation.priceForecastSource` tells you which was used).
- **The shipped model is trained on synthetic series.** To train on real history, drop an AGMARKNET export at `ml-service/data/price_history.csv` (`crop,mandi,date,modal_price,arrivals`) and rerun `train_price.py`.

