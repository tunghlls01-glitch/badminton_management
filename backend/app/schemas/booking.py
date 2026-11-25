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


class RecurringCheckRequest(BaseModel):
    """Yêu cầu kiểm tra lịch trống cho các tuần cố định (4–8 tuần)."""

    court_id: int = Field(gt=0, examples=[1])
    start_date: date = Field(examples=["2026-11-20"])
    weeks_count: int = Field(ge=4, le=8, default=4, examples=[4], description="Số tuần đặt cố định: từ 4 đến 8 tuần")
    start_time: time = Field(examples=["18:00:00"])
    end_time: time = Field(examples=["20:00:00"])


class WeekSlotPreview(BaseModel):
    """Thông tin chi tiết một tuần trong chuỗi đặt cố định."""

    week_number: int
    booking_date: date
    day_of_week: str
    start_time: str
    end_time: str
    is_available: bool
    conflict_reason: Optional[str] = None
    price: float


class RecurringCheckResponse(BaseModel):
    """Kết quả kiểm tra chuỗi tuần cố định."""

    court_id: int
    court_name: Optional[str] = None
    total_weeks: int
    available_weeks_count: int
    conflict_weeks_count: int
    has_conflicts: bool
    estimated_total_price: float
    weeks: List[WeekSlotPreview]


class RecurringBookingCreate(BaseModel):
    """Yêu cầu tạo đặt sân cố định theo chuỗi 4–8 tuần trong 1 transaction."""

    court_id: int = Field(gt=0, examples=[1])
    start_date: date = Field(examples=["2026-11-20"])
    weeks_count: int = Field(ge=4, le=8, default=4, examples=[4])
    start_time: time = Field(examples=["18:00:00"])
    end_time: time = Field(examples=["20:00:00"])
    customer_name: Optional[str] = Field(default=None, examples=["Nguyễn Văn A"])
    customer_phone: Optional[str] = Field(default=None, examples=["0912345678"])
    booking_channel: BookingChannel = BookingChannel.Counter
    note: Optional[str] = None
    skip_conflict_dates: List[date] = Field(default_factory=list, description="Danh sách các ngày bị trùng mà khách chọn bỏ qua")


class RecurringBookingResponse(BaseModel):
    """Kết quả sau khi tạo đặt sân cố định trong 1 transaction."""

    booking_id: int
    booking_code: str
    court_id: int
    court_name: Optional[str] = None
    total_weeks_requested: int
    booked_weeks_count: int
    skipped_weeks_count: int
    total_price: float
    status: BookingStatus
    booked_dates: List[date]
    skipped_dates: List[date]
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
    payment_method: Optional[str] = None
    payment_status: Optional[str] = None
    has_transferred: bool = False
    receipt_url: Optional[str] = None
    paid_amount: Optional[float] = None


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
