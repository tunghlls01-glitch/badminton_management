from datetime import date, datetime, time
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.booking import BookingChannel, BookingStatus
from .booking_slot import BookingSlotOut


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


class BookingCheckoutRequest(BaseModel):
    payment_method: str = Field(
        default="CASH",
        examples=["CASH", "BANK_TRANSFER"],
        description="Phương thức thanh toán: CASH hoặc BANK_TRANSFER"
    )
    discount_amount: Decimal = Field(
        default=Decimal(0),
        ge=0,
        examples=[20000],
        description="Số tiền giảm giá thủ công (>= 0)"
    )
    discount_reason: Optional[str] = Field(
        default=None,
        max_length=255,
        examples=["Khách quen giảm 10%"],
        description="Lý do giảm giá (bắt buộc nếu discount_amount > 0)"
    )
    transaction_code: Optional[str] = Field(
        default=None,
        max_length=100,
        examples=["VCB123456789"],
        description="Mã giao dịch chuyển khoản ngân hàng"
    )
    note: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Ghi chú thêm khi thanh toán"
    )


class BookingCheckoutResponse(BaseModel):
    message: str = "Thanh toán và hoàn thành booking thành công"
    booking_id: int
    booking_code: str
    booking_status: BookingStatus
    total_court_amount: float
    total_service_amount: float
    discount_amount: float
    discount_reason: Optional[str] = None
    grand_total: float
    payment_method: str
    payment_status: str
    transaction_code: Optional[str] = None
    invoice_code: str
