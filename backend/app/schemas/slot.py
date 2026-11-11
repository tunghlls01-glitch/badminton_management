from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class SlotDisplayStatus(str, Enum):
    FREE = "FREE"         # Slot còn trống
    BOOKED = "BOOKED"     # Đã đặt / Đã thanh toán
    HOLD = "HOLD"         # Đang giữ tạm thời chờ thanh toán
    LOCKED = "LOCKED"     # Sân bị khóa / Bảo trì


# 1. Loại bỏ court_id và court_name khỏi từng slot item
class SlotGridItem(BaseModel):
    start_at: datetime
    end_at: datetime
    status: SlotDisplayStatus
    price: Decimal = Field(ge=0, default=Decimal("50000"), examples=[150000])
    booking_id: Optional[int] = Field(default=None, examples=[10])
    hold_expires_at: Optional[datetime] = None
    lock_reason: Optional[str] = Field(default=None, examples=["Bảo trì đèn thắp sáng"])


# 2. Cập nhật ví dụ minh họa và giữ nguyên court_id, court_name ở cấp Sân
class CourtSlotGrid(BaseModel):
    court_id: int = Field(gt=0, examples=[1])
    court_name: str = Field(examples=["Sân 1 - Thường"])
    slots: List[SlotGridItem] = Field(default_factory=list)


# 3. Response tổng hợp giữ nguyên
class SlotGridResponse(BaseModel):
    date: str = Field(examples=["2026-11-20"])
    operating_hours: dict = Field(
        default={
            "open": "06:00",
            "close": "22:00",
            "slot_duration_minutes": 60
        }
    )
    courts: List[CourtSlotGrid] = Field(default_factory=list)