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
    assert data["model_loaded"] is True
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

def test_predict_price():
    payload = {
        "crop": "soybean",
        "records": [
            {"date": f"2024-09-{d:02d}", "modal_price": 4100 + d * 6, "arrivals": 3000 - d * 10}
            for d in range(1, 29)
        ],
    }
    r = client.post("/predict/price", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert len(data["forecasts"]) == 2
    for f in data["forecasts"]:
        assert f["p10"] <= f["p50"] <= f["p90"]
    assert data["drivers"]
    print("test_predict_price: PASSED ->", data["forecasts"])

def test_predict_price_bad_crop():
    payload = {"crop": "banana", "records": [{"date": "2024-09-0%d" % d, "modal_price": 100} for d in range(1, 5)]}
    assert client.post("/predict/price", json=payload).status_code == 422
    print("test_predict_price_bad_crop: PASSED (correctly rejected with 422)")

if __name__ == "__main__":
    test_health()
    test_predict_yield_valid()
    test_predict_yield_invalid()
    test_predict_price()
    test_predict_price_bad_crop()
    print("\nALL FASTAPI PYTHON TESTS (YIELD + PRICE) PASSED!")
