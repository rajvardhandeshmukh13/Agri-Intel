# schemas/yield_input.py
# Versioned Pydantic schemas for yield prediction I/O.

from pydantic import BaseModel, Field
from typing import Optional, List


class YieldInputV1(BaseModel):
    """Version 1 yield prediction input schema."""
    model_version: str = Field(default="v1", description="Schema version for forward compatibility")
    crop: str = Field(..., description="Crop name, e.g. 'soybean'")
    state: str = Field(..., description="Indian state, e.g. 'Maharashtra'")
    district: str = Field(..., description="District, e.g. 'Latur'")
    season: str = Field(..., description="'kharif' or 'rabi'")
    sowing_date: str = Field(..., description="ISO date string, e.g. '2024-06-20'")
    area_hectares: float = Field(..., gt=0, description="Farm area in hectares")
    soil_type: Optional[str] = Field(None, description="'black', 'red', 'alluvial', etc.")
    irrigation_type: Optional[str] = Field(None, description="'rainfed', 'irrigated', 'partial'")
    latitude: Optional[float] = Field(None, description="Farm latitude in decimal degrees")
    longitude: Optional[float] = Field(None, description="Farm longitude in decimal degrees")

    # Weather aggregates (last 60 days from sowing)
    avg_temp_c: float = Field(..., description="Average temperature in Celsius")
    total_rainfall_mm: float = Field(..., ge=0, description="Total rainfall in mm")
    avg_humidity_pct: float = Field(..., ge=0, le=100)
    rainy_days_count: int = Field(..., ge=0)

    # Satellite (optional)
    latest_ndvi: Optional[float] = Field(None, ge=-1, le=1)
    avg_ndvi: Optional[float] = Field(None, ge=-1, le=1)

    # Historical baseline
    historical_avg_yield_q_per_ha: float = Field(..., gt=0, description="Historical avg yield qtl/ha")


class ExplanationFactor(BaseModel):
    factor: str
    value: str
    impact_direction: str  # 'positive', 'negative', 'neutral'
    impact_magnitude: str  # 'high', 'medium', 'low'


class YieldPredictionOutput(BaseModel):
    """Version 1 yield prediction output."""
    farm_season_id: str = "unknown"
    model_version: str
    expected_yield_q_per_ha: float
    total_harvest_q: float
    confidence_low: float
    confidence_high: float
    confidence_level: Optional[str] = "moderate"
    explanation: List[ExplanationFactor]
    source: str = "ml-service"
