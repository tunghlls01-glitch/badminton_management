"""Schema cho Payment (Module 11: Thanh toán)."""
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.payment import PaymentMethod, PaymentStatus


class PaymentBase(BaseModel):
    booking_id: int | None = None
    invoice_id: int | None = None
    service_order_id: int | None = None
    amount: Decimal = Field(gt=0, examples=[250000])
    payment_method: PaymentMethod = PaymentMethod.CASH
    payment_status: PaymentStatus = PaymentStatus.SUCCESS
    transaction_code: str | None = None


class PaymentCreate(PaymentBase):
    """Dữ liệu gửi lên khi tạo thanh toán mới."""
    pass


class PaymentUpdate(BaseModel):
    """Dữ liệu gửi lên khi cập nhật thanh toán."""
    booking_id: int | None = None
    service_order_id: int | None = None
    amount: Decimal | None = Field(default=None, gt=0)
    payment_method: PaymentMethod | None = None
    payment_status: PaymentStatus | None = None
    transaction_code: str | None = None

class PaymentOut(PaymentBase):
    """Dữ liệu API trả về cho Frontend."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount: float
    created_at: datetime
