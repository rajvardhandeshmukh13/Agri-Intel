# ml-service/train.py
"""
Train explainable RandomForestRegressor yield model on Maharashtra agronomic datasets.
Covers 6 major crops: Soybean, Cotton, Wheat, Onion, Tur, and Jowar.
Saves serialized model and metadata to models/yield_model.pkl.
"""

import os
import pickle
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_absolute_error

CROPS = ["soybean", "cotton", "wheat", "onion", "tur", "jowar", "sugarcane"]
SEASONS = ["kharif", "rabi"]
SOILS = ["black", "alluvial", "loamy", "red", "sandy"]
IRRIGATIONS = ["rainfed", "irrigated", "partial"]

# Agronomic baselines (qtl/ha) in Maharashtra
CROP_BASELINES = {
    "soybean":   {"baseline": 18.5,  "opt_rain": 620,  "opt_temp": 28.0, "rabi": False},
    "cotton":    {"baseline": 14.0,  "opt_rain": 550,  "opt_temp": 30.0, "rabi": False},
    "wheat":     {"baseline": 30.0,  "opt_rain": 380,  "opt_temp": 22.0, "rabi": True},
    "onion":     {"baseline": 110.0, "opt_rain": 450,  "opt_temp": 25.0, "rabi": True},
    "tur":       {"baseline": 11.5,  "opt_rain": 580,  "opt_temp": 29.0, "rabi": False},
    "jowar":     {"baseline": 16.0,  "opt_rain": 480,  "opt_temp": 28.5, "rabi": True},
    "sugarcane": {"baseline": 800.0, "opt_rain": 1400, "opt_temp": 30.0, "rabi": True},
}

SOIL_MULT = {"black": 1.06, "alluvial": 1.04, "loamy": 1.02, "red": 0.97, "sandy": 0.90}
IRR_MULT = {"irrigated": 1.18, "partial": 1.08, "rainfed": 1.00}


def generate_synthetic_agronomic_dataset(n_samples_per_crop: int = 600) -> pd.DataFrame:
    """Generate realistic agronomic training data based on Maharashtra field conditions."""
    np.random.seed(42)
    records = []

    for crop in CROPS:
        info = CROP_BASELINES[crop]
        for _ in range(n_samples_per_crop):
            # Season matching
            if info["rabi"]:
                season = np.random.choice(["rabi", "kharif"], p=[0.7, 0.3])
            else:
                season = "kharif"

            soil = np.random.choice(SOILS, p=[0.45, 0.20, 0.15, 0.12, 0.08])
            irrigation = np.random.choice(IRRIGATIONS, p=[0.55, 0.25, 0.20])

            # Weather distribution
            opt_temp = info["opt_temp"]
            temp = float(np.random.normal(opt_temp, 2.8))
            temp = np.clip(temp, 16.0, 38.0)

            opt_rain = info["opt_rain"]
            rainfall = float(np.random.gamma(shape=9.0, scale=opt_rain / 9.0))
            rainfall = np.clip(rainfall, 150.0, 1200.0)

            humidity = float(np.clip(np.random.normal(68.0, 10.0), 35.0, 95.0))
            rainy_days = int(np.clip(rainfall / 28.0 + np.random.normal(0, 3), 4, 45))

            # Satellite NDVI (vegetation proxy)
            # Higher NDVI correlates with adequate moisture and good soil
            moisture_factor = min(1.0, rainfall / opt_rain)
            base_ndvi = 0.50 + 0.25 * moisture_factor + (0.05 if irrigation == "irrigated" else 0.0)
            ndvi = float(np.clip(np.random.normal(base_ndvi, 0.08), 0.25, 0.88))

            # Historical baseline
            hist_yield = float(np.random.normal(info["baseline"], info["baseline"] * 0.12))
            hist_yield = max(2.0, hist_yield)

            # Agronomic yield response formula
            # 1. Rainfall response (bell curve around optimum)
            rain_ratio = rainfall / opt_rain
            if rain_ratio < 0.6:
                rain_mult = 0.65 + 0.45 * (rain_ratio / 0.6)
            elif rain_ratio > 1.4:
                rain_mult = max(0.75, 1.10 - 0.25 * (rain_ratio - 1.4))
            else:
                rain_mult = 1.0 + 0.12 * (1.0 - abs(rain_ratio - 1.0) / 0.4)

            # 2. Temperature response
            temp_dev = abs(temp - opt_temp)
            temp_mult = max(0.70, 1.05 - 0.04 * temp_dev)

            # 3. NDVI vigour multiplier
            ndvi_mult = 0.75 + (ndvi * 0.45)

            # 4. Soil and irrigation
            soil_mult = SOIL_MULT[soil]
            irr_mult = IRR_MULT[irrigation]

            # Combined realistic yield
            final_yield = hist_yield * rain_mult * temp_mult * ndvi_mult * soil_mult * irr_mult
            # Add micro-environmental residual variance (~4%)
            final_yield *= np.random.normal(1.0, 0.04)
            final_yield = round(max(1.5, final_yield), 2)

            records.append({
                "crop": crop,
                "season": season,
                "soil_type": soil,
                "irrigation_type": irrigation,
                "avg_temp_c": round(temp, 1),
                "total_rainfall_mm": round(rainfall, 1),
                "avg_humidity_pct": round(humidity, 1),
                "rainy_days_count": rainy_days,
                "latest_ndvi": round(ndvi, 3),
                "historical_avg_yield_q_per_ha": round(hist_yield, 2),
                "yield_q_per_ha": final_yield,
            })

    return pd.DataFrame(records)


def encode_features(df: pd.DataFrame) -> tuple[np.ndarray, list[str]]:
    """Convert dataframe columns into numerical feature matrix."""
    feature_cols = []
    arrays = []

    # One-hot encode categorical features for deterministic ordering
    for crop in CROPS:
        col = f"crop_{crop}"
        feature_cols.append(col)
        arrays.append((df["crop"] == crop).astype(float).values)

    for season in SEASONS:
        col = f"season_{season}"
        feature_cols.append(col)
        arrays.append((df["season"] == season).astype(float).values)

    for soil in SOILS:
        col = f"soil_{soil}"
        feature_cols.append(col)
        arrays.append((df["soil_type"] == soil).astype(float).values)

    for irr in IRRIGATIONS:
        col = f"irr_{irr}"
        feature_cols.append(col)
        arrays.append((df["irrigation_type"] == irr).astype(float).values)

    # Numerical features
    num_cols = [
        "avg_temp_c",
        "total_rainfall_mm",
        "avg_humidity_pct",
        "rainy_days_count",
        "latest_ndvi",
        "historical_avg_yield_q_per_ha",
    ]
    for col in num_cols:
        feature_cols.append(col)
        arrays.append(df[col].astype(float).values)

    X = np.column_stack(arrays)
    return X, feature_cols


def train_and_save():
    print("Generating Maharashtra agronomic training dataset (3,600 samples)...")
    df = generate_synthetic_agronomic_dataset(n_samples_per_crop=600)
    print(f"Dataset generated: {len(df)} rows across {len(CROPS)} crops.")

    X, feature_names = encode_features(df)
    y = df["yield_q_per_ha"].values

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.20, random_state=42)

    print("\nTraining RandomForestRegressor...")
    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=14,
        min_samples_split=4,
        min_samples_leaf=2,
        max_features="sqrt",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    r2 = r2_score(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)

    print(f"Model evaluation on test set:")
    print(f"  R^2 Score: {r2:.4f} (Accuracy: {r2*100:.2f}%)")
    print(f"  Mean Absolute Error: {mae:.2f} qtl/ha")

    # Display Top 5 Important Features
    importances = model.feature_importances_
    sorted_idx = np.argsort(importances)[::-1][:6]
    print("\nTop Predictor Features:")
    for idx in sorted_idx:
        print(f"  - {feature_names[idx]}: {importances[idx]*100:.2f}%")

    # Serialize bundle
    output_dir = os.path.join(os.path.dirname(__file__), "models")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "yield_model.pkl")

    bundle = {
        "model": model,
        "feature_names": feature_names,
        "crops": CROPS,
        "seasons": SEASONS,
        "soils": SOILS,
        "irrigations": IRRIGATIONS,
        "metrics": {
            "r2": round(float(r2), 4),
            "mae": round(float(mae), 3),
            "samples": len(df),
        },
    }

    with open(output_path, "wb") as f:
        pickle.dump(bundle, f)

    print(f"\nModel successfully saved to: {output_path}")


if __name__ == "__main__":
    train_and_save()
