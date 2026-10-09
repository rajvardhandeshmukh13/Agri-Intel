# fetch_historical_data.py
# Builds the historical training dataset from OPEN data sources:
#
#   1. India Data Portal - Area, Production, Yield (APY) dataset
#      25 years of district-level crop yields (open CSV, ODC Attribution license)
#      Source: Directorate of Economics & Statistics, Ministry of Agriculture
#
#   2. Open-Meteo Historical Weather Archive (free, no API key)
#      Daily temperature, precipitation and soil moisture per district/year,
#      aggregated over each crop's growing season into:
#      rainfall_mm, growing degree days (base 10C), mean soil moisture
#
# Note on ADeX / AgriStack: both require onboarding as a registered data
# consumer (AgriStack is consent-driven and federated; ADeX offers a sandbox
# at dataexplorer.ts.adex.org.in). Once you have access, export field-level
# records to data/historical_training.csv in the same column format and
# train_yield.py will use them automatically.
#
# Run with: python fetch_historical_data.py

import time
from pathlib import Path

import numpy as np
import pandas as pd
import requests

APY_CSV_URL = (
    "https://ckandev.indiadataportal.com/dataset/f2bbc28c-6c7c-462b-9064-ea4c4213d466"
    "/resource/f980409d-49a2-42ae-9eb0-182365005c04/download/crop-wise-area-production-yield.csv"
)

OUTPUT_PATH = Path(__file__).parent / "data" / "historical_training.csv"

# Approximate district HQ coordinates (Maharashtra)
DISTRICT_CENTROIDS = {
    "Pune": (18.52, 73.86), "Satara": (17.68, 74.00), "Sangli": (16.85, 74.58),
    "Solapur": (17.66, 75.91), "Kolhapur": (16.69, 74.23), "Ahilyanagar": (19.09, 74.74),
    "Nashik": (20.00, 73.79), "Dhule": (20.90, 74.77), "Jalgaon": (21.01, 75.56),
    "Aurangabad": (19.88, 75.34), "Beed": (18.99, 75.76), "Latur": (18.40, 76.58),
    "Dharashiv": (18.19, 76.04), "Nanded": (19.15, 77.30), "Parbhani": (19.27, 76.77),
    "Hingoli": (19.72, 77.15), "Jalna": (19.84, 75.88), "Amravati": (20.93, 77.75),
    "Akola": (20.71, 77.00), "Buldhana": (20.53, 76.18), "Washim": (20.10, 77.13),
    "Yavatmal": (20.39, 78.12), "Nagpur": (21.15, 79.09), "Wardha": (20.75, 78.60),
}

# Crop -> (sowing month, harvest month) growing window
CROP_SEASONS = {
    "Soybean": (6, 10), "Cotton": (6, 11), "Wheat": (11, 3), "Onion": (11, 3),
    "Arhar/Tur": (6, 2), "Jowar": (6, 10), "Sugarcane": (1, 12), "Maize": (6, 10),
}

SAMPLE_SIZE = 300  # rows to sample; raise for a bigger training set


def fetch_season_weather(lat: float, lon: float, year: int, m1: int, m2: int):
    """Aggregate Open-Meteo archive weather over the crop's growing season."""
    y2 = year + 1 if m2 < m1 else year
    url = (
        f"https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lon}"
        f"&start_date={year}-{m1:02d}-01&end_date={y2}-{m2:02d}-28"
        "&daily=temperature_2m_mean,precipitation_sum,soil_moisture_0_to_7cm_mean"
    )
    daily = requests.get(url, timeout=30).json()["daily"]
    rainfall = float(np.nansum(daily["precipitation_sum"]))
    temps = np.array([t for t in daily["temperature_2m_mean"] if t is not None])
    gdd = float(np.maximum(temps - 10, 0).sum())  # growing degree days, base 10C
    soil = float(np.nanmean([s for s in daily["soil_moisture_0_to_7cm_mean"] if s is not None]))
    return rainfall, gdd, soil


def main() -> None:
    print("Downloading APY dataset (India Data Portal)...")
    apy = pd.read_csv(APY_CSV_URL)

    mh = apy[
        (apy["state_name"] == "Maharashtra")
        & apy["crop_name"].isin(CROP_SEASONS)
        & apy["district_name"].isin(DISTRICT_CENTROIDS)
    ].copy()
    mh["yr"] = mh["year"].str[:4].astype(int)
    mh = mh[(mh["yr"] >= 2000) & (mh["yield"] > 0) & (mh["yield"] < 15)]

    rows = mh.sample(min(SAMPLE_SIZE, len(mh)), random_state=42).reset_index(drop=True)
    print(f"Fetching season weather for {len(rows)} district-year-crop rows...")

    out = []
    for i, r in rows.iterrows():
        m1, m2 = CROP_SEASONS[r["crop_name"]]
        lat, lon = DISTRICT_CENTROIDS[r["district_name"]]
        try:
            rain, gdd, sm = fetch_season_weather(lat, lon, r["yr"], m1, m2)
            out.append({
                "crop": r["crop_name"],
                "district": r["district_name"],
                "year": r["year"],
                "rainfall_mm": round(rain, 1),
                "gdd": round(gdd, 0),
                "soil_moisture": round(sm, 3),
                "yield_qtl_ha": round(r["yield"] * 10, 2),  # tonnes -> quintals
            })
        except Exception as e:
            print(f"skip {r['district_name']} {r['year']}: {e}")
        time.sleep(0.2)
        if i % 25 == 0:
            print(f"  {i}/{len(rows)}")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(out).to_csv(OUTPUT_PATH, index=False)
    print(f"Saved {len(out)} training rows to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
