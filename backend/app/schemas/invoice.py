"""Schema cho Invoice (Module 12: Hóa đơn tổng kết)."""
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class InvoiceBase(BaseModel):
    invoice_code: str = Field(..., min_length=1, max_length=30, examples=["INV-20261107-001"], description="Mã hóa đơn duy nhất")
    booking_id: int | None = Field(default=None, gt=0, examples=[1], description="ID lượt đặt sân (nếu có)")
    customer_id: int = Field(..., gt=0, examples=[1], description="ID khách hàng")
    total_court_amount: Decimal = Field(default=Decimal(0), ge=0, examples=[200000], description="Tổng tiền sân")
    total_service_amount: Decimal = Field(default=Decimal(0), ge=0, examples=[50000], description="Tổng tiền dịch vụ")
    discount_amount: Decimal = Field(default=Decimal(0), ge=0, examples=[20000], description="Số tiền giảm giá")
    discount_reason: str | None = Field(default=None, max_length=255, examples=["Khách quen"], description="Lý do giảm giá")
    grand_total: Decimal | None = Field(default=None, ge=0, examples=[230000], description="Tổng tiền thanh toán cuối cùng")

    @model_validator(mode="after")
    def calculate_grand_total(self):
        # Tự động tính grand_total = total_court_amount + total_service_amount - discount_amount nếu chưa truyền
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
