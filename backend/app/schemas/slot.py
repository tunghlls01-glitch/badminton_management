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

from pydantic import BaseModel, Field, model_validator


class SlotTimeRange(BaseModel):
    start_at: datetime = Field(examples=["2026-11-20T08:00:00"])
    end_at: datetime = Field(examples=["2026-11-20T09:00:00"])

    @model_validator(mode="after")
    def check_time_order(self):
        if self.end_at <= self.start_at:
            raise ValueError("end_at phải lớn hơn start_at")
        return self


class SlotHoldRequest(BaseModel):
    court_id: int = Field(gt=0, examples=[1])
    user_id: int = Field(gt=0, examples=[1])
    slots: List[SlotTimeRange] = Field(min_length=1)

    @model_validator(mode="after")
    def check_contiguous_slots(self):
        self.slots.sort(key=lambda s: s.start_at)
        for i in range(len(self.slots) - 1):
            if self.slots[i].end_at != self.slots[i + 1].start_at:
                raise ValueError("Các slot được chọn phải liền nhau")
        return self


class SlotHoldResponse(BaseModel):
    booking_id: int
    court_id: int
    held_slot_ids: List[int]
    hold_expires_at: datetime
    message: str


class SlotReleaseRequest(BaseModel):
    booking_id: int = Field(gt=0, examples=[10])
    user_id: int = Field(gt=0, examples=[1])
    slots: Optional[List[SlotTimeRange]] = None