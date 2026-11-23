from datetime import datetime
from pydantic import BaseModel, Field


class MaintenanceBlockCreate(BaseModel):
    reason: str = Field(..., min_length=1, max_length=255)
    start_at: datetime
    end_at: datetime


class AffectedBookingOut(BaseModel):
    id: int
    customer_name: str | None = None
    start_at: datetime
    end_at: datetime
    status: str | None = None

    class Config:
        from_attributes = True


class MaintenanceBlockOut(BaseModel):
    id: int
    court_id: int
    reason: str
    start_at: datetime
    end_at: datetime
    affected_bookings: list[AffectedBookingOut] = []

    class Config:
        from_attributes = True