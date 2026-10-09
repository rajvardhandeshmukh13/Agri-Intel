# models/price_model.py
# Mandi price forecaster for the sell-window decision engine.
#
# For each horizon (7d, 14d) three GradientBoosting quantile models predict the
# log-return of the modal price (p10 / p50 / p90). The band gives the engine a
# real downside estimate instead of a flat volatility heuristic.
#
# Feature extraction lives here and is shared by training and inference, so the
# two can never drift apart.

import math
import os
import pickle
from datetime import date, datetime
from typing import Any, Dict, List, Optional

import numpy as np

CROPS = ["soybean", "cotton", "wheat", "onion", "tur", "jowar", "sugarcane"]
HORIZONS = (7, 14)
QUANTILES = (0.1, 0.5, 0.9)
MODEL_VERSION = "price-v1-gbq"
PRICE_MODEL_PATH = os.path.join(os.path.dirname(__file__), "price_model.pkl")

# Feature groups used for per-request explanations (occlusion attribution).
FEATURE_NAMES = (
    [f"crop_{c}" for c in CROPS]
    + [
        "ch7", "ch14", "ch30",         # momentum
        "vol_pct",                     # volatility
        "z_mean",                      # price vs window mean
        "arrivals_chg",                # supply pressure
        "month_sin", "month_cos",      # seasonality
    ]
)
FEATURE_GROUPS = {
    "Price momentum": ["ch7", "ch14", "ch30"],
    "Mandi arrivals (supply)": ["arrivals_chg"],
    "Seasonal pattern": ["month_sin", "month_cos"],
    "Price vs 30-day average": ["z_mean"],
    "Price volatility": ["vol_pct"],
}


# --------------------------------------------------------------------------- #
# Feature extraction
# --------------------------------------------------------------------------- #

def _parse_date(value: Any) -> date:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    return datetime.fromisoformat(str(value)[:10]).date()


def extract_features(
    crop: str,
    dates: List[date],
    prices: List[float],
    arrivals: Optional[List[Optional[float]]] = None,
) -> np.ndarray:
    """Build the feature vector from a price window (any order, any gaps)."""
    order = sorted(range(len(dates)), key=lambda i: dates[i])
    d = [dates[i] for i in order]
    p = np.array([prices[i] for i in order], dtype=float)
    a = [arrivals[i] for i in order] if arrivals else [None] * len(p)

    last_date, last = d[-1], p[-1]

    def price_days_back(days: int) -> float:
        # Last observation at least `days` before the latest; else the oldest.
        for i in range(len(d) - 1, -1, -1):
            if (last_date - d[i]).days >= days:
                return float(p[i])
        return float(p[0])

    ch7 = last / price_days_back(7) - 1.0
    ch14 = last / price_days_back(14) - 1.0
    ch30 = last / price_days_back(30) - 1.0

    mean = float(np.mean(p))
    vol_pct = float(np.std(p) / mean * 100.0) if mean > 0 and len(p) > 1 else 0.0
    z_mean = (last - mean) / mean if mean > 0 else 0.0

    arr = [x for x in a if x is not None and x > 0]
    arrivals_chg = 0.0
    if len(arr) >= 4:
        third = max(1, len(arr) // 3)
        early, late = float(np.mean(arr[:third])), float(np.mean(arr[-third:]))
        arrivals_chg = late / early - 1.0 if early > 0 else 0.0

    month = last_date.month
    angle = 2 * math.pi * (month - 1) / 12.0

    onehot = [1.0 if crop == c else 0.0 for c in CROPS]
    return np.array(
        onehot
        + [
            float(np.clip(ch7, -0.5, 0.5)),
            float(np.clip(ch14, -0.6, 0.6)),
            float(np.clip(ch30, -0.8, 0.8)),
            float(np.clip(vol_pct, 0, 40)),
            float(np.clip(z_mean, -0.5, 0.5)),
            float(np.clip(arrivals_chg, -1.0, 3.0)),
            math.sin(angle),
            math.cos(angle),
        ],
        dtype=float,
    )


# --------------------------------------------------------------------------- #
# Inference
# --------------------------------------------------------------------------- #

def load_price_model(path: str = PRICE_MODEL_PATH) -> Dict[str, Any]:
    with open(path, "rb") as f:
        return pickle.load(f)


def _predict_returns(bundle: Dict[str, Any], x: np.ndarray) -> Dict[int, Dict[float, float]]:
    out: Dict[int, Dict[float, float]] = {}
    for h in HORIZONS:
        raw = sorted(float(bundle["models"][(h, q)].predict(x.reshape(1, -1))[0]) for q in QUANTILES)
        out[h] = {0.1: raw[0], 0.5: raw[1], 0.9: raw[2]}  # enforce non-crossing quantiles
    return out


def _explain(bundle: Dict[str, Any], x: np.ndarray, base_p50: float) -> List[Dict[str, str]]:
    """Occlusion attribution: neutralise one feature group at a time and see how
    much the 7-day median forecast moves."""
    medians = bundle["feature_medians"]
    model = bundle["models"][(7, 0.5)]
    factors = []
    for label, cols in FEATURE_GROUPS.items():
        x2 = x.copy()
        for c in cols:
            idx = FEATURE_NAMES.index(c)
            x2[idx] = medians[idx]
        delta = base_p50 - float(model.predict(x2.reshape(1, -1))[0])  # contribution of this group
        pct = delta * 100.0
        mag = "high" if abs(pct) >= 1.0 else "medium" if abs(pct) >= 0.4 else "low"
        direction = "positive" if pct > 0.15 else "negative" if pct < -0.15 else "neutral"
        factors.append({
            "factor": label,
            "value": f"{pct:+.1f}% effect on 7-day price forecast",
            "impact_direction": direction,
            "impact_magnitude": mag,
            "_abs": abs(pct),
        })
    factors.sort(key=lambda f: f["_abs"], reverse=True)
    for f in factors:
        f.pop("_abs")
    return factors


def predict_price(
    bundle: Dict[str, Any],
    crop: str,
    dates: List[Any],
    prices: List[float],
    arrivals: Optional[List[Optional[float]]] = None,
) -> Dict[str, Any]:
    crop = crop.lower()
    if crop not in CROPS:
        raise ValueError(f"Unsupported crop '{crop}'")
    if len(prices) < 3:
        raise ValueError("Need at least 3 price observations")

    parsed = [_parse_date(x) for x in dates]
    x = extract_features(crop, parsed, prices, arrivals)
    rets = _predict_returns(bundle, x)
    current = float(prices[int(np.argmax([dt.toordinal() for dt in parsed]))])

    forecasts = []
    for h in HORIZONS:
        r = rets[h]
        forecasts.append({
            "horizon_days": h,
            "p10": round(current * math.exp(r[0.1]), 1),
            "p50": round(current * math.exp(r[0.5]), 1),
            "p90": round(current * math.exp(r[0.9]), 1),
        })

    return {
        "model_version": MODEL_VERSION,
        "current_price": round(current, 1),
        "forecasts": forecasts,
        "drivers": _explain(bundle, x, rets[7][0.5]),
        "source": "ml-service",
    }
