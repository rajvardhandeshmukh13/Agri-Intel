"""
ml-service/main.py
FastAPI ML sidecar for AgriIntel yield and price forecasting.
Run with: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models.yield_model import predict_yield, load_model
from schemas.yield_input import YieldInputV1, YieldPredictionOutput
from schemas.price_input import PriceInputV1, PriceForecastOutput
from models.price_model import predict_price, load_price_model
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AgriIntel ML Service",
    description="Yield and price forecasting service for AgriIntel",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# Load model on initialization and startup
try:
    _model = load_model()
    logger.info("Initial yield model loaded successfully")
except Exception as e:
    _model = None
    logger.warning(f"Initial model load warning: {e}")

# Price forecast model (optional — endpoint returns 503 if not trained)
try:
    _price_model = load_price_model()
    logger.info("Price model loaded successfully")
except Exception as e:
    _price_model = None
    logger.warning(f"Price model not loaded (run train_price.py): {e}")


@app.on_event("startup")
async def startup_event():
    global _model, _price_model
    if _model is None:
        try:
            _model = load_model()
            logger.info("Yield model loaded successfully on startup")
        except Exception as e:
            logger.warning(f"Could not load trained model: {e}. Will use demo predictions.")
    if _price_model is None:
        try:
            _price_model = load_price_model()
            logger.info("Price model loaded successfully on startup")
        except Exception as e:
            logger.warning(f"Price model not loaded (run train_price.py): {e}")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": _model is not None,
        "price_model_loaded": _price_model is not None,
    }


@app.post("/predict/yield", response_model=YieldPredictionOutput)
def predict_yield_endpoint(input_data: YieldInputV1):
    try:
        result = predict_yield(input_data, _model)
        return result
    except Exception as e:
        logger.error(f"Yield prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.post("/predict/price", response_model=PriceForecastOutput)
def predict_price_endpoint(input_data: PriceInputV1):
    if _price_model is None:
        raise HTTPException(status_code=503, detail="Price model not trained. Run: python train_price.py")
    try:
        return predict_price(
            _price_model,
            input_data.crop,
            [r.date for r in input_data.records],
            [r.modal_price for r in input_data.records],
            [r.arrivals for r in input_data.records],
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Price prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")
