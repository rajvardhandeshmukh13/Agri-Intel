"""
ml-service/main.py
FastAPI ML sidecar for AgriIntel yield prediction.
Run with: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models.yield_model import predict_yield, load_model
from schemas.yield_input import YieldInputV1, YieldPredictionOutput
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AgriIntel ML Service",
    description="Yield prediction service for AgriIntel",
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

@app.on_event("startup")
async def startup_event():
    global _model
    if _model is None:
        try:
            _model = load_model()
            logger.info("Yield model loaded successfully on startup")
        except Exception as e:
            logger.warning(f"Could not load trained model: {e}. Will use demo predictions.")


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": _model is not None}


@app.post("/predict/yield", response_model=YieldPredictionOutput)
def predict_yield_endpoint(input_data: YieldInputV1):
    try:
        result = predict_yield(input_data, _model)
        return result
    except Exception as e:
        logger.error(f"Yield prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")
