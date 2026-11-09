from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class CourtBlockBase(BaseModel):
    court_id: int = Field(..., example=1)
    start_time: datetime = Field(..., example="2026-11-10T08:00:00")
    end_time: datetime = Field(..., example="2026-11-10T12:00:00")
    reason: Optional[str] = Field(None, max_length=255, example="Bảo trì hệ thống đèn")

class CourtBlockCreate(CourtBlockBase):
    pass

class CourtBlockUpdate(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    reason: Optional[str] = None

class CourtBlockResponse(CourtBlockBase):
    id: int
    created_by: int = Field(..., example=1)

    class Config:
        from_attributes = True