# schemas/price_input.py
# Pydantic schemas for the price forecast endpoint.

from typing import List, Optional
from pydantic import BaseModel, Field


class PriceObservation(BaseModel):
    date: str = Field(..., description="ISO date, e.g. '2024-10-01'")
    modal_price: float = Field(..., gt=0, description="Modal price INR/quintal")
    arrivals: Optional[float] = Field(None, ge=0, description="Mandi arrivals in quintals")


class PriceInputV1(BaseModel):
    crop: str
    records: List[PriceObservation] = Field(..., min_length=3, description="Recent price history (up to ~30 days)")


class PriceForecastPoint(BaseModel):
    horizon_days: int
    p10: float
    p50: float
    p90: float


class PriceDriver(BaseModel):
    factor: str
    value: str
    impact_direction: str
    impact_magnitude: str


class PriceForecastOutput(BaseModel):
    model_version: str
    current_price: float
    forecasts: List[PriceForecastPoint]
    drivers: List[PriceDriver]
    source: str = "ml-service"
