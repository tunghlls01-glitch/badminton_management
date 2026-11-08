from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.models.court import CourtStatus


class CourtOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    status: CourtStatus


class CourtStatusOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    status: CourtStatus
    is_vip: bool = False
    price_per_hour: float = 50000.0
    current_state: str  # 'empty', 'playing', 'booked'
    state_note: Optional[str] = None
    active_booking_id: Optional[int] = None
