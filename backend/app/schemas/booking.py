from datetime import date, datetime, time
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.booking import BookingChannel, BookingSlotStatus, BookingStatus


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


class BookingBase(BaseModel):
    user_id: int = Field(default=1, gt=0, examples=[1])
    booking_channel: BookingChannel = Field(
        default=BookingChannel.Counter, examples=[BookingChannel.Counter]
    )
    total_price: Decimal = Field(default=0, ge=0, examples=[150000])
    status: BookingStatus = Field(default=BookingStatus.Pending, examples=[BookingStatus.Pending])
    note: Optional[str] = Field(default=None, max_length=255)


class BookingCreate(BaseModel):
    """FE gửi lên khi tạo đơn đặt sân nhanh từ giao diện."""

    court_id: int = Field(gt=0, examples=[1])
    booking_date: date = Field(examples=["2026-11-20"])
    start_time: time = Field(examples=["14:00:00"])
    end_time: time = Field(examples=["15:30:00"])
    total_price: Decimal = Field(default=0, ge=0, examples=[75000])
    status: BookingStatus = Field(default=BookingStatus.Pending)
    customer_name: Optional[str] = Field(default=None, examples=["Nguyễn Văn A"])
    customer_phone: Optional[str] = Field(default=None, examples=["0912345678"])
    booking_channel: BookingChannel = BookingChannel.Counter
    note: Optional[str] = None


class BookingUpdate(BaseModel):
    status: Optional[BookingStatus] = None
    note: Optional[str] = None
    total_price: Optional[Decimal] = None


class CancellationPreviewOut(BaseModel):
    """Thông tin xem trước chính sách và % tiền hoàn trước khi hủy."""

    booking_id: int
    booking_code: str
    earliest_start: Optional[datetime] = None
    hours_before: float
    refund_percent: int
    refund_amount: float
    total_price: float
    policy_message: str
    summary_message: str


class CancelBookingOut(BaseModel):
    """Kết quả trả về sau khi hủy lịch đặt."""

    booking_id: int
    booking_code: str
    status: BookingStatus
    refund_percent: int
    refund_amount: float
    policy_message: str
    message: str


class BookingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    booking_code: str
    user_id: int
    user_name: Optional[str] = None
    user_phone: Optional[str] = None
    court_id: Optional[int] = None
    court_name: Optional[str] = None
    booking_date: Optional[date] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    booking_channel: BookingChannel
    total_price: float
    status: BookingStatus
    note: Optional[str] = None
    created_at: datetime
    slots: List[BookingSlotOut] = []
