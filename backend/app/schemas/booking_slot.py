from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.booking import BookingSlotStatus


class BookingSlotBase(BaseModel):
    court_id: int = Field(gt=0, examples=[1])
    start_at: datetime
    end_at: datetime
    duration_minutes: int = Field(gt=0, default=60)
    price_per_hour: Decimal = Field(ge=0, default=50000)
    amount: Decimal = Field(ge=0, default=50000)
    status: BookingSlotStatus = BookingSlotStatus.Active


class BookingSlotOut(BookingSlotBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    booking_id: int
    court_name: Optional[str] = None
    price_per_hour: float
    amount: float