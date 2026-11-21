from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class RacketRentalBase(BaseModel):
    booking_id: int
    service_id: int
    quantity: int = 1
    note: Optional[str] = None


class RacketRentalCreate(RacketRentalBase):
    service_order_id: Optional[int] = None


class RacketRentalReturn(BaseModel):
    note: Optional[str] = None


class RacketRentalOut(BaseModel):
    id: int
    booking_id: int
    service_id: int
    service_name: Optional[str] = None
    service_order_id: Optional[int] = None
    quantity: int
    status: str
    rented_at: datetime
    returned_at: Optional[datetime] = None
    note: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BookingRentalWarningOut(BaseModel):
    booking_id: int
    has_unreturned_rackets: bool
    unreturned_count: int
    rentals: List[RacketRentalOut]
