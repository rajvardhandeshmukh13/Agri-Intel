# ml-service/train_price.py
"""
Train the mandi price forecaster (7d / 14d quantile models).

DATA
  * Default: synthetic daily price series per crop (seasonal level + mean
    reversion + momentum + arrivals pressure). This exists so the pipeline
    works end-to-end today. It is NOT real market history.
  * Real data: put an AGMARKNET export at ml-service/data/price_history.csv with
    columns: crop,mandi,date,modal_price,arrivals   (arrivals optional)
    and run `python train_price.py` again. The CSV is used automatically.

Usage:  python train_price.py
"""

import os
from datetime import date, timedelta

import numpy as np
import pandas as pd
import pickle
from sklearn.ensemble import GradientBoostingRegressor

from models.price_model import (
    CROPS, HORIZONS, QUANTILES, FEATURE_NAMES, MODEL_VERSION, PRICE_MODEL_PATH,
    extract_features,
)

WINDOW = 30
CSV_PATH = os.path.join(os.path.dirname(__file__), "data", "price_history.csv")

# base price (INR/qtl), lean-season peak month, seasonal amplitude, daily vol
CROP_PRICE = {
    "soybean":   (4300, 6, 0.08, 0.008),
    "cotton":    (7000, 7, 0.06, 0.007),
    "wheat":     (2400, 8, 0.05, 0.005),
    "onion":     (1800, 9, 0.30, 0.025),
    "tur":       (7000, 7, 0.07, 0.007),
    "jowar":     (3200, 7, 0.07, 0.007),
    "sugarcane": (340,  7, 0.03, 0.003),
}
# months in which arrivals spike (harvest)
HARVEST_MONTHS = {
    "soybean": (10, 11), "cotton": (11, 12), "wheat": (3, 4), "onion": (3, 4),
    "tur": (12, 1), "jowar": (10, 11), "sugarcane": (1, 2),
}


def synth_series(crop: str, rng: np.random.Generator, days: int = 420):
    base, peak_m, amp, vol = CROP_PRICE[crop]
    start = date(2022, 1, 1) + timedelta(days=int(rng.integers(0, 365)))
    level0 = base * rng.uniform(0.85, 1.15)
    u, drift = 0.0, 0.0
    dates, prices, arrivals = [], [], []
    arr_base = rng.uniform(1500, 6000)
    prev_arr_z = 0.0
    for i in range(days):
        d = start + timedelta(days=i)
        doy = d.timetuple().tm_yday
        peak_doy = (peak_m - 1) * 30.4 + 15
        seasonal = amp * np.cos(2 * np.pi * (doy - peak_doy) / 365.0)

        harvest = d.month in HARVEST_MONTHS[crop]
        arr = arr_base * (1.7 if harvest else 1.0) * np.exp(rng.normal(0, 0.25))
        arr_z = np.log(arr / arr_base)

        # momentum drifts; heavy arrivals push later drift down
        drift = 0.85 * drift + rng.normal(0, vol * 0.35) - 0.004 * prev_arr_z
        u = u + drift - 0.03 * u + rng.normal(0, vol)
        prev_arr_z = arr_z

        dates.append(d)
        prices.append(level0 * np.exp(seasonal + u))
        arrivals.append(arr)
    return dates, np.array(prices), arrivals


def build_samples(series_list):
    X, Y = {h: [] for h in HORIZONS}, None
    Xs = []
    for crop, dates, prices, arrivals in series_list:
        n = len(prices)
        for t in range(WINDOW, n - max(HORIZONS), 3):
            w = slice(t - WINDOW, t + 1)
            Xs.append(extract_features(crop, dates[w], list(prices[w]), arrivals[w]))
            for h in HORIZONS:
                X[h].append(np.log(prices[t + h] / prices[t]))
    return np.array(Xs), {h: np.array(v) for h, v in X.items()}


def load_series():
    if os.path.exists(CSV_PATH):
        print(f"Using real price history: {CSV_PATH}")
        df = pd.read_csv(CSV_PATH, parse_dates=["date"])
        out = []
        for (crop, _mandi), g in df.groupby(["crop", "mandi"]):
            crop = str(crop).lower()
            if crop not in CROPS:
                continue
            g = g.sort_values("date").drop_duplicates("date")
            # resample to daily so window logic matches training assumptions
            g = g.set_index("date").asfreq("D")
            g["modal_price"] = g["modal_price"].interpolate(limit=5)
            if "arrivals" not in g:
                g["arrivals"] = np.nan
            g = g.dropna(subset=["modal_price"])
            if len(g) < WINDOW + max(HORIZONS) + 10:
                continue
            out.append((crop, [d.date() for d in g.index], g["modal_price"].values,
                        [None if pd.isna(x) else float(x) for x in g["arrivals"]]))
        if not out:
            raise SystemExit("CSV found but no usable series (need >=55 days per crop/mandi).")
        return out, "real"
    print("No price_history.csv found -> using SYNTHETIC series (pipeline demo only).")
    rng = np.random.default_rng(42)
    out = []
    for crop in CROPS:
        for _ in range(30):
            d, p, a = synth_series(crop, rng)
            out.append((crop, d, p, a))
    return out, "synthetic"


def heuristic_return(x: np.ndarray, h: int) -> float:
    """The old engine rule: half the last weekly change, compounded."""
    ch7 = x[FEATURE_NAMES.index("ch7")]
    return float(np.log((1 + ch7 * 0.5) ** (h / 7.0)))


def train_and_save():
    series, data_kind = load_series()
    # split by series (not by row) to avoid leakage between overlapping windows
    idx = np.random.default_rng(1).permutation(len(series))
    cut = int(len(series) * 0.8)
    train_s = [series[i] for i in idx[:cut]]
    test_s = [series[i] for i in idx[cut:]]

    Xtr, Ytr = build_samples(train_s)
    Xte, Yte = build_samples(test_s)
    print(f"Train rows: {len(Xtr)}  Test rows: {len(Xte)}  ({data_kind} data)")

    models, metrics = {}, {"data": data_kind, "train_rows": int(len(Xtr)), "test_rows": int(len(Xte))}
    for h in HORIZONS:
        preds = {}
        for q in QUANTILES:
            m = GradientBoostingRegressor(
                loss="quantile", alpha=q, n_estimators=140, max_depth=3,
                learning_rate=0.07, subsample=0.8, min_samples_leaf=20, random_state=42,
            )
            m.fit(Xtr, Ytr[h])
            models[(h, q)] = m
            preds[q] = m.predict(Xte)

        y = Yte[h]
        base = np.array([heuristic_return(x, h) for x in Xte])
        mae_ml = float(np.mean(np.abs(preds[0.5] - y)))
        mae_heur = float(np.mean(np.abs(base - y)))
        mae_zero = float(np.mean(np.abs(y)))
        lo, hi = np.minimum(preds[0.1], preds[0.9]), np.maximum(preds[0.1], preds[0.9])
        coverage = float(np.mean((y >= lo) & (y <= hi)))
        metrics[f"h{h}"] = {
            "mae_ml_pct": round(mae_ml * 100, 3),
            "mae_old_heuristic_pct": round(mae_heur * 100, 3),
            "mae_no_change_pct": round(mae_zero * 100, 3),
            "p10_p90_coverage": round(coverage, 3),
        }
        print(f"\nHorizon {h}d  (error = abs return error, in % points)")
        print(f"  ML p50 MAE        : {mae_ml*100:.3f}")
        print(f"  Old heuristic MAE : {mae_heur*100:.3f}")
        print(f"  'No change' MAE   : {mae_zero*100:.3f}")
        print(f"  p10-p90 coverage  : {coverage*100:.1f}%  (target ~80%)")

    bundle = {
        "models": models,
        "feature_medians": np.median(Xtr, axis=0),
        "feature_names": FEATURE_NAMES,
        "version": MODEL_VERSION,
        "metrics": metrics,
    }
    with open(PRICE_MODEL_PATH, "wb") as f:
        pickle.dump(bundle, f)
    print(f"\nSaved -> {PRICE_MODEL_PATH}")


if __name__ == "__main__":
    train_and_save()
