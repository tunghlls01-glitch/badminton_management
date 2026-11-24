from datetime import time
from typing import Optional
from pydantic import BaseModel, Field

class PriceRuleBase(BaseModel):
    court_id: int = Field(..., example=1)
    day_of_week: Optional[str] = Field("WEEKDAY", max_length=20, example="WEEKDAY")
    start_time: time = Field(..., example="06:00:00")
    end_time: time = Field(..., example="16:00:00")
    hourly_rate: float = Field(..., gt=0, example=80000.0)

class PriceRuleCreate(PriceRuleBase):
    weekday_index: Optional[int] = Field(None, ge=0, le=6)

class PriceRuleUpdate(BaseModel):
    weekday_index: Optional[int] = Field(None, ge=0, le=6)
    day_of_week: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    hourly_rate: Optional[float] = Field(None, gt=0)

class PriceRuleResponse(PriceRuleBase):
    id: int
    weekday_index: int

    class Config:
        from_attributes = True