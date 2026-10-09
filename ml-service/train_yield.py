# train_yield.py
# Trains the Random Forest yield model and saves it to models/yield_model.pkl.
#
# Preferred path: trains on REAL historical data from
#   data/historical_training.csv  (built by fetch_historical_data.py from the
#   India Data Portal APY dataset + Open-Meteo historical weather archive).
#   Features: [rainfall_mm, gdd, soil_moisture] + one-hot crop.
#
# Fallback path: if the CSV is missing, trains on the small built-in sample
#   with features [ndvi_mean, ndvi_peak, rainfall_mm, gdd, soil_moisture].
#
# Run with: python train_yield.py

from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import cross_val_score

DATA_PATH = Path(__file__).parent / "data" / "historical_training.csv"
MODEL_PATH = Path(__file__).parent / "models" / "yield_model.pkl"


def train_from_historical_data() -> None:
    df = pd.read_csv(DATA_PATH)
    print(f"Loaded {len(df)} real historical training rows from {DATA_PATH.name}")

    X = pd.get_dummies(df[["rainfall_mm", "gdd", "soil_moisture", "crop"]], columns=["crop"])
    y = df["yield_qtl_ha"]

    model = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
    scores = cross_val_score(model, X, y, cv=5, scoring="r2")
    print(f"Cross-validated R2: {scores.mean():.3f} (folds: {np.round(scores, 3)})")

    model.fit(X, y)
    # Save model together with its feature layout so inference can never drift
    joblib.dump(
        {"model": model, "feature_columns": list(X.columns), "kind": "historical-weather-crop"},
        MODEL_PATH,
    )
    print(f"Yield model trained on real data and saved to {MODEL_PATH}")


def train_from_sample_data() -> None:
    print("historical_training.csv not found - using built-in sample data.")
    print("Run 'python fetch_historical_data.py' first for real-data training.")

    # Feature order: [ndvi_mean, ndvi_peak, rainfall_mm, gdd, soil_moisture]
    X_train = np.array([
        [0.45, 0.72, 450, 1200, 0.28],
        [0.52, 0.81, 520, 1350, 0.32],
        [0.38, 0.61, 380, 1100, 0.22],
        [0.60, 0.88, 600, 1400, 0.35],
        [0.49, 0.77, 490, 1280, 0.30],
        [0.55, 0.84, 540, 1310, 0.31],
    ])
    # Target: yield in quintals per hectare
    y_train = np.array([35.0, 42.5, 28.0, 48.0, 39.0, 44.0])

    model = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
    model.fit(X_train, y_train)
    joblib.dump({"model": model, "feature_columns": None, "kind": "sample-ndvi"}, MODEL_PATH)
    print(f"Sample yield model trained and saved to {MODEL_PATH}")


if __name__ == "__main__":
    if DATA_PATH.exists():
        train_from_historical_data()
    else:
        train_from_sample_data()
