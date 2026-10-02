# ml-service/test_api.py
# Python API tests for AgriIntel FastAPI ML service

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    print("test_health: PASSED ->", data)

def test_predict_yield_valid():
    payload = {
        "model_version": "v1",
        "crop": "soybean",
        "state": "Maharashtra",
        "district": "Latur",
        "season": "kharif",
        "sowing_date": "2024-06-20",
        "area_hectares": 3.5,
        "soil_type": "black",
        "irrigation_type": "rainfed",
        "latitude": 18.2333,
        "longitude": 76.7167,
        "avg_temp_c": 28.5,
        "total_rainfall_mm": 580.0,
        "avg_humidity_pct": 75.0,
        "rainy_days_count": 22,
        "latest_ndvi": 0.68,
        "avg_ndvi": 0.62,
        "historical_avg_yield_q_per_ha": 19.5
    }
    response = client.post("/predict/yield", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["expected_yield_q_per_ha"] > 0
    assert data["total_harvest_q"] > 0
    assert data["confidence_low"] < data["expected_yield_q_per_ha"] < data["confidence_high"]
    assert data.get("confidence_level") in ["low", "moderate", "high"]
    assert len(data["explanation"]) > 0
    assert data["source"] == "ml-service"
    print("test_predict_yield_valid: PASSED -> expected:", data["expected_yield_q_per_ha"], "total:", data["total_harvest_q"], "confidence:", data.get("confidence_level"), "factors:", len(data["explanation"]))

def test_predict_yield_invalid():
    # Negative area
    payload = {
        "crop": "soybean",
        "state": "Maharashtra",
        "district": "Latur",
        "season": "kharif",
        "sowing_date": "2024-06-20",
        "area_hectares": -5.0,
        "avg_temp_c": 28.5,
        "total_rainfall_mm": 580.0,
        "avg_humidity_pct": 75.0,
        "rainy_days_count": 22,
        "historical_avg_yield_q_per_ha": 19.5
    }
    response = client.post("/predict/yield", json=payload)
    assert response.status_code == 422 # Unprocessable Entity
    print("test_predict_yield_invalid: PASSED (correctly rejected with 422)")

if __name__ == "__main__":
    test_health()
    test_predict_yield_valid()
    test_predict_yield_invalid()
    print("\nALL FASTAPI PYTHON TESTS PASSED!")
