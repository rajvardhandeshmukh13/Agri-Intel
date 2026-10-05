# models/yield_model.py
# Simple, explainable yield prediction model.
# Uses RandomForestRegressor trained on synthetic seed data.
# Designed to be simple and interpretable for a hackathon.

import os
import pickle
import numpy as np
import pandas as pd
from typing import Optional, Any

# Try to import sklearn — gracefully handle if not installed
try:
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.preprocessing import LabelEncoder
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

from schemas.yield_input import YieldInputV1, YieldPredictionOutput, ExplanationFactor

MODEL_PATH = os.path.join(os.path.dirname(__file__), "yield_model.pkl")

# Crop-specific baselines (quintals per hectare) for Maharashtra
CROP_BASELINES = {
    "soybean": {"kharif": 18.0, "rabi": 0},
    "wheat":   {"kharif": 0,    "rabi": 28.0},
    "cotton":  {"kharif": 12.0, "rabi": 0},
    "onion":   {"kharif": 80.0, "rabi": 120.0},
    "tur":     {"kharif": 10.0, "rabi": 0},
    "jowar":   {"kharif": 15.0, "rabi": 18.0},
    "sugarcane": {"kharif": 750.0, "rabi": 850.0},
}

SOIL_FACTORS = {"black": 1.05, "alluvial": 1.03, "loamy": 1.02, "red": 0.98, "sandy": 0.92}
IRRIGATION_FACTORS = {"irrigated": 1.15, "partial": 1.05, "rainfed": 1.0}

OPTIMAL_RAINFALL = {"soybean": 600, "wheat": 400, "cotton": 500, "onion": 500, "tur": 650, "jowar": 450, "sugarcane": 1500}


def _rule_based_predict(inp: YieldInputV1) -> tuple[float, list[ExplanationFactor]]:
    """
    Simple rule-based yield estimation with explanation.
    Used when sklearn is not available or model is not trained.
    """
    baseline = CROP_BASELINES.get(inp.crop, {}).get(inp.season, 18.0)
    if baseline == 0:
        baseline = inp.historical_avg_yield_q_per_ha

    yield_estimate = baseline
    explanation = []

    # Historical baseline
    hist_factor = inp.historical_avg_yield_q_per_ha / baseline if baseline > 0 else 1.0
    yield_estimate = inp.historical_avg_yield_q_per_ha
    explanation.append(ExplanationFactor(
        factor="Historical yield data",
        value=f"Avg {inp.historical_avg_yield_q_per_ha:.1f} qtl/ha in {inp.district} (last 5 years)",
        impact_direction="positive" if hist_factor >= 1 else "neutral",
        impact_magnitude="high",
    ))

    # Rainfall effect
    optimal_rain = OPTIMAL_RAINFALL.get(inp.crop, 550)
    rain_ratio = inp.total_rainfall_mm / optimal_rain
    rain_multiplier = max(0.7, min(1.15, rain_ratio))
    rain_deviation = abs(inp.total_rainfall_mm - optimal_rain) / optimal_rain
    rain_impact = "positive" if rain_deviation < 0.1 else ("neutral" if rain_deviation < 0.3 else "negative")
    yield_estimate *= rain_multiplier
    explanation.append(ExplanationFactor(
        factor="Weather conditions",
        value=f"{inp.total_rainfall_mm:.0f} mm total rainfall — {'near optimal' if rain_deviation < 0.2 else 'above/below optimal'}",
        impact_direction=rain_impact,
        impact_magnitude="medium",
    ))

    # NDVI effect
    if inp.latest_ndvi is not None:
        ndvi_multiplier = 0.8 + (inp.latest_ndvi * 0.4)  # 0.8–1.2 range
        ndvi_impact = "positive" if inp.latest_ndvi > 0.6 else ("neutral" if inp.latest_ndvi > 0.4 else "negative")
        yield_estimate *= ndvi_multiplier
        explanation.append(ExplanationFactor(
            factor="Crop health (NDVI)",
            value=f"Peak NDVI {inp.latest_ndvi:.2f} — {'good' if inp.latest_ndvi > 0.6 else 'moderate'} vegetation",
            impact_direction=ndvi_impact,
            impact_magnitude="medium",
        ))

    # Soil type
    soil_factor = SOIL_FACTORS.get(inp.soil_type or "black", 1.0)
    yield_estimate *= soil_factor
    explanation.append(ExplanationFactor(
        factor="Soil type",
        value=f"{inp.soil_type or 'Unknown'} soil — {'suitable' if soil_factor >= 1.0 else 'moderate'} for {inp.crop}",
        impact_direction="positive" if soil_factor >= 1.0 else "neutral",
        impact_magnitude="low",
    ))

    # Irrigation
    irr_factor = IRRIGATION_FACTORS.get(inp.irrigation_type or "rainfed", 1.0)
    yield_estimate *= irr_factor
    if inp.irrigation_type and inp.irrigation_type != "rainfed":
        explanation.append(ExplanationFactor(
            factor="Irrigation",
            value=f"{inp.irrigation_type} — beneficial for yield stability",
            impact_direction="positive",
            impact_magnitude="low",
        ))

    return round(yield_estimate, 2), explanation


def _build_feature_vector(inp: YieldInputV1, bundle: dict) -> np.ndarray:
    crops = bundle.get("crops", ["soybean", "cotton", "wheat", "onion", "tur", "jowar"])
    seasons = bundle.get("seasons", ["kharif", "rabi"])
    soils = bundle.get("soils", ["black", "alluvial", "loamy", "red", "sandy"])
    irrigations = bundle.get("irrigations", ["rainfed", "irrigated", "partial"])

    features = []
    # One-hot crops
    inp_crop = (inp.crop or "soybean").lower().strip()
    for c in crops:
        features.append(1.0 if inp_crop == c else 0.0)

    # One-hot seasons
    inp_season = (inp.season or "kharif").lower().strip()
    for s in seasons:
        features.append(1.0 if inp_season == s else 0.0)

    # One-hot soils
    inp_soil = (inp.soil_type or "black").lower().strip()
    for s in soils:
        features.append(1.0 if inp_soil == s else 0.0)

    # One-hot irrigations
    inp_irr = (inp.irrigation_type or "rainfed").lower().strip()
    for i in irrigations:
        features.append(1.0 if inp_irr == i else 0.0)

    # Numerical features
    features.append(float(inp.avg_temp_c))
    features.append(float(inp.total_rainfall_mm))
    features.append(float(inp.avg_humidity_pct))
    features.append(float(inp.rainy_days_count))
    features.append(float(inp.latest_ndvi if inp.latest_ndvi is not None else 0.60))
    features.append(float(inp.historical_avg_yield_q_per_ha))

    return np.array([features], dtype=float)


def load_model() -> Optional[Any]:
    """Load the trained model bundle from disk if available."""
    if not SKLEARN_AVAILABLE:
        return None
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, "rb") as f:
            return pickle.load(f)
    return None


def predict_yield(inp: YieldInputV1, model: Optional[Any] = None) -> YieldPredictionOutput:
    """
    Predict crop yield.
    Uses trained ML model if available, otherwise falls back to rule-based prediction.
    """
    if model is not None:
        try:
            bundle = model if isinstance(model, dict) else {"model": model}
            rf = bundle.get("model", model)
            X = _build_feature_vector(inp, bundle)
            yield_pred = float(rf.predict(X)[0])
            yield_q_per_ha = round(max(1.0, yield_pred), 2)

            # Confidence interval via RandomForest tree estimator variance
            if hasattr(rf, "estimators_") and len(rf.estimators_) > 0:
                tree_preds = [float(e.predict(X)[0]) for e in rf.estimators_]
                std_err = float(np.std(tree_preds))
            else:
                std_err = yield_q_per_ha * 0.06

            delta = max(0.5, 1.96 * std_err)
            confidence_low = round(max(0.5, yield_q_per_ha - delta), 2)
            confidence_high = round(yield_q_per_ha + delta, 2)
            cv = std_err / yield_q_per_ha if yield_q_per_ha > 0 else 0.1
            confidence_level = "high" if cv < 0.07 else ("moderate" if cv < 0.14 else "low")

            # Dynamic explanation factors based on agronomic inputs
            explanation: list[ExplanationFactor] = []

            # 1. Historical baseline
            hist_diff = yield_q_per_ha - inp.historical_avg_yield_q_per_ha
            explanation.append(ExplanationFactor(
                factor="Historical yield data",
                value=f"District 5-yr baseline is {inp.historical_avg_yield_q_per_ha:.1f} qtl/ha (predicted: {yield_q_per_ha:.1f})",
                impact_direction="positive" if hist_diff >= 0 else "neutral",
                impact_magnitude="high",
            ))

            # 2. Weather & Rainfall
            optimal_rain = OPTIMAL_RAINFALL.get(inp.crop, 550)
            rain_dev = abs(inp.total_rainfall_mm - optimal_rain) / optimal_rain
            explanation.append(ExplanationFactor(
                factor="Weather conditions",
                value=f"{inp.total_rainfall_mm:.0f} mm rainfall (optimal: {optimal_rain} mm) — {'near optimal' if rain_dev < 0.2 else 'divergence from optimal'}",
                impact_direction="positive" if rain_dev < 0.2 else "neutral",
                impact_magnitude="medium",
            ))

            # 3. Satellite NDVI vigour
            if inp.latest_ndvi is not None:
                ndvi_val = inp.latest_ndvi
                explanation.append(ExplanationFactor(
                    factor="Crop health (NDVI)",
                    value=f"Vegetation index {ndvi_val:.2f} — {'strong canopy vigour' if ndvi_val > 0.6 else 'moderate canopy density'}",
                    impact_direction="positive" if ndvi_val > 0.6 else ("neutral" if ndvi_val > 0.4 else "negative"),
                    impact_magnitude="medium",
                ))

            # 4. Soil & Irrigation
            soil_name = inp.soil_type or "black"
            irr_name = inp.irrigation_type or "rainfed"
            explanation.append(ExplanationFactor(
                factor="Soil & Irrigation",
                value=f"{soil_name.capitalize()} soil with {irr_name} management — stable root zone capacity",
                impact_direction="positive" if soil_name in ["black", "alluvial"] or irr_name == "irrigated" else "neutral",
                impact_magnitude="low",
            ))

            total_harvest = round(yield_q_per_ha * inp.area_hectares, 2)

            return YieldPredictionOutput(
                model_version="v1-rf",
                expected_yield_q_per_ha=yield_q_per_ha,
                total_harvest_q=total_harvest,
                confidence_low=confidence_low,
                confidence_high=confidence_high,
                confidence_level=confidence_level,
                explanation=explanation,
                source="ml-service",
            )
        except Exception as e:
            # Fall back to rule-based on any computation issue
            pass

    yield_q_per_ha, explanation = _rule_based_predict(inp)
    total_harvest = round(yield_q_per_ha * inp.area_hectares, 2)

    confidence_pct = 0.15
    confidence_low = round(max(0.5, yield_q_per_ha * (1 - confidence_pct)), 2)
    confidence_high = round(yield_q_per_ha * (1 + confidence_pct), 2)

    return YieldPredictionOutput(
        model_version="v1-rule-based",
        expected_yield_q_per_ha=yield_q_per_ha,
        total_harvest_q=total_harvest,
        confidence_low=confidence_low,
        confidence_high=confidence_high,
        confidence_level="moderate",
        explanation=explanation,
        source="ml-service",
    )
