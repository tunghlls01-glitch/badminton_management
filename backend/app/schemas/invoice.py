"""Schema cho Invoice (Module 12: Hóa đơn tổng kết & Chốt ca)."""
from datetime import date as CalendarDate, datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


class InvoiceBase(BaseModel):
    invoice_code: str = Field(..., min_length=1, max_length=30, examples=["INV-20261107-001"], description="Mã hóa đơn duy nhất")
    booking_id: int | None = Field(default=None, gt=0, examples=[1], description="ID lượt đặt sân (nếu có)")
    customer_id: int = Field(..., gt=0, examples=[1], description="ID khách hàng")
    staff_id: int | None = Field(default=None, gt=0, examples=[2], description="ID lễ tân/nhân viên lập hóa đơn")
    total_court_amount: Decimal = Field(default=Decimal(0), ge=0, examples=[200000], description="Tổng tiền sân")
    total_service_amount: Decimal = Field(default=Decimal(0), ge=0, examples=[50000], description="Tổng tiền dịch vụ")
    discount_amount: Decimal = Field(default=Decimal(0), ge=0, examples=[20000], description="Số tiền giảm giá")
    discount_reason: str | None = Field(default=None, max_length=255, examples=["Khách quen"], description="Lý do giảm giá")
    grand_total: Decimal | None = Field(default=None, ge=0, examples=[230000], description="Tổng tiền thanh toán cuối cùng")

    @model_validator(mode="after")
    def calculate_grand_total(self):
        if self.grand_total is None:
            calculated = self.total_court_amount + self.total_service_amount - self.discount_amount
            self.grand_total = max(Decimal(0), calculated)
        return self


class InvoiceCreate(InvoiceBase):
    """Dữ liệu FE gửi lên khi TẠO hóa đơn tổng kết mới."""
    pass


class InvoiceUpdate(BaseModel):
    """Dữ liệu FE gửi lên khi CẬP NHẬT hóa đơn."""
    invoice_code: str | None = Field(default=None, min_length=1, max_length=30)
    booking_id: int | None = Field(default=None, gt=0)
    customer_id: int | None = Field(default=None, gt=0)
    staff_id: int | None = Field(default=None, gt=0)
    total_court_amount: Decimal | None = Field(default=None, ge=0)
    total_service_amount: Decimal | None = Field(default=None, ge=0)
    discount_amount: Decimal | None = Field(default=None, ge=0)
    discount_reason: str | None = Field(default=None, max_length=255)
    grand_total: Decimal | None = Field(default=None, ge=0)


class InvoiceOut(InvoiceBase):
    """Dữ liệu API trả về cho FE."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    total_court_amount: float
    total_service_amount: float
    discount_amount: float = 0.0
    discount_reason: str | None = None
    grand_total: float
    created_at: datetime


class ReceptionistOut(BaseModel):
    """Thông tin lễ tân/nhân viên cho dropdown lọc."""
    id: int
    full_name: str
    email: str
    phone: Optional[str] = None
    role: str


class InvoiceListItem(BaseModel):
    """Dòng hóa đơn trong danh sách tìm kiếm & lọc."""
    id: int
    invoice_code: str
    booking_id: Optional[int] = None
    booking_code: Optional[str] = None
    customer_id: int
    customer_name: str
    customer_phone: Optional[str] = None
    staff_id: Optional[int] = None
    staff_name: Optional[str] = None
    total_court_amount: float
    total_service_amount: float
    discount_amount: float
    discount_reason: Optional[str] = None
    grand_total: float
    payment_method: Optional[str] = None
    payment_status: Optional[str] = None
    transaction_code: Optional[str] = None
    created_at: datetime


class InvoiceSummaryStats(BaseModel):
    """Thống kê tổng hợp hóa đơn theo bộ lọc."""
    total_invoices: int = 0
    total_revenue: float = 0.0
    total_cash: float = 0.0
    total_bank_transfer: float = 0.0
    total_court_amount: float = 0.0
    total_service_amount: float = 0.0
    total_discount_amount: float = 0.0


class InvoiceListResponse(BaseModel):
    """Response trả về danh sách hóa đơn có phân trang và tổng hợp số liệu."""
    items: List[InvoiceListItem]
    total: int
    page: int
    limit: int
    summary: InvoiceSummaryStats


class InvoiceSlotItem(BaseModel):
    """Chi tiết khung giờ sân trong hóa đơn."""
    court_name: str
    court_type: Optional[str] = None
    play_date: str
    time_slot: str
    hours: float
    price_per_hour: float
    amount: float


class InvoiceServiceItem(BaseModel):
    """Chi tiết dịch vụ đã sử dụng trong hóa đơn."""
    service_id: int
    service_name: str
    category: Optional[str] = None
    unit: str
    quantity: int
    unit_price: float
    amount: float


class InvoiceDetailResponse(BaseModel):
    """Chi tiết đầy đủ của hóa đơn phục vụ xem & in lại."""
    id: int
    invoice_code: str
    created_at: datetime
    customer_id: int
    customer_name: str
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    staff_id: Optional[int] = None
    staff_name: Optional[str] = None
    booking_id: Optional[int] = None
    booking_code: Optional[str] = None
    court_slots: List[InvoiceSlotItem] = []
    services: List[InvoiceServiceItem] = []
    total_court_amount: float
    total_service_amount: float
    discount_amount: float
    discount_reason: Optional[str] = None
    grand_total: float
    payment_method: str
    payment_status: str
    transaction_code: Optional[str] = None
    is_reprint: bool = False
    club_info: Dict[str, str] = {
        "name": "RK BADMINTON",
        "address": "28 Nguyễn Thị Minh Khai, Quận 1, TP. Hồ Chí Minh",
        "phone": "028 3822 1818",
    }


class ShiftInvoiceItem(BaseModel):
    """Dòng hóa đơn tóm tắt trong ca làm việc."""
    id: int
    invoice_code: str
    booking_code: Optional[str] = None
    customer_name: str
    payment_method: str
    total_court_amount: float
    total_service_amount: float
    discount_amount: float
    grand_total: float
    created_at: datetime


class ShiftClosingResponse(BaseModel):
    """Kết quả chốt ca: tổng tiền mặt/chuyển khoản của lễ tân trong ca."""
    staff_id: int
    staff_name: str
    staff_email: Optional[str] = None
    staff_phone: Optional[str] = None
    date: str
    shift_type: str
    shift_name: str
    start_time: str
    end_time: str
    total_invoices: int
    total_cash: float
    total_bank_transfer: float
    total_revenue: float
    total_court_amount: float
    total_service_amount: float
    total_discount_amount: float
    invoices: List[ShiftInvoiceItem]
    closed_at: datetime


class ShiftCloseRequest(BaseModel):
    """Yêu cầu xác nhận chốt ca đối soát két và ghi chú bàn giao."""
    staff_id: Optional[int] = None
    date: Optional[CalendarDate] = None
    shift_type: str = "ALL_DAY"
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    actual_cash: Optional[float] = None
    difference: Optional[float] = 0.0
    note: Optional[str] = None


class ShiftCloseResponse(BaseModel):
    """Kết quả xác nhận chốt ca làm việc."""
    success: bool = True
    message: str = "Chốt ca làm việc và đối soát két thành công"
    summary: ShiftClosingResponse
    actual_cash: Optional[float] = None
    difference: Optional[float] = 0.0
    note: Optional[str] = None
    confirmed_at: datetime

