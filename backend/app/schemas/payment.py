"""Schema cho Payment (Module 11: Thanh toán)."""
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.payment import PaymentMethod, PaymentStatus


class PaymentBase(BaseModel):
    booking_id: int | None = Field(default=None, gt=0, examples=[1], description="ID lượt đặt sân (nếu có)")
    service_order_id: int | None = Field(
        default=None, gt=0, examples=[1], description="ID đơn dịch vụ (nếu có)"
    )
    amount: Decimal = Field(..., gt=0, examples=[250000], description="Số tiền thanh toán")
    payment_method: PaymentMethod = Field(
        default=PaymentMethod.CASH,
        examples=[PaymentMethod.CASH],
        description="Phương thức: CASH, BANK_TRANSFER, QR_VNPAY",
    )
    payment_status: PaymentStatus = Field(
        default=PaymentStatus.SUCCESS,
        examples=[PaymentStatus.SUCCESS],
        description="Trạng thái: PENDING, SUCCESS, FAILED",
    )
    transaction_code: str | None = Field(
        default=None, max_length=100, examples=["TXN123456789"], description="Mã giao dịch ngân hàng/VNPAY"
    )

    @field_validator("payment_method", mode="before")
    @classmethod
    def normalize_payment_method(cls, value):
        if isinstance(value, str):
            clean = value.strip().upper()
            if clean in ["CASH", "TIEN_MAT", "TIỀN MẶT"]:
                return PaymentMethod.CASH
            if clean in ["BANK_TRANSFER", "CHUYEN_KHOAN", "CHUYỂN KHOẢN", "TRANSFER"]:
                return PaymentMethod.BANK_TRANSFER
            if clean in ["QR_VNPAY", "VNPAY", "QR"]:
                return PaymentMethod.QR_VNPAY
        return value

    @field_validator("payment_status", mode="before")
    @classmethod
    def normalize_payment_status(cls, value):
        if isinstance(value, str):
            clean = value.strip().upper()
            if clean in ["PENDING", "CHO_XU_LY", "CHỜ XỬ LÝ"]:
                return PaymentStatus.PENDING
            if clean in ["SUCCESS", "THANH_CONG", "THÀNH CÔNG"]:
                return PaymentStatus.SUCCESS
            if clean in ["FAILED", "THAT_BAI", "THẤT BẠI"]:
                return PaymentStatus.FAILED
        return value


class PaymentCreate(PaymentBase):
    """Dữ liệu FE gửi lên khi TẠO thanh toán mới."""
    pass


class PaymentUpdate(BaseModel):
    """Dữ liệu FE gửi lên khi CẬP NHẬT thanh toán."""
    booking_id: int | None = Field(default=None, gt=0)
    service_order_id: int | None = Field(default=None, gt=0)
    amount: Decimal | None = Field(default=None, gt=0)
    payment_method: PaymentMethod | None = None
    payment_status: PaymentStatus | None = None
    transaction_code: str | None = Field(default=None, max_length=100)

    @field_validator("payment_method", mode="before")
    @classmethod
    def normalize_payment_method(cls, value):
        if value is None:
            return None
        if isinstance(value, str):
            clean = value.strip().upper()
            if clean in ["CASH", "TIEN_MAT", "TIỀN MẶT"]:
                return PaymentMethod.CASH
            if clean in ["BANK_TRANSFER", "CHUYEN_KHOAN", "CHUYỂN KHOẢN", "TRANSFER"]:
                return PaymentMethod.BANK_TRANSFER
            if clean in ["QR_VNPAY", "VNPAY", "QR"]:
                return PaymentMethod.QR_VNPAY
        return value

    @field_validator("payment_status", mode="before")
    @classmethod
    def normalize_payment_status(cls, value):
        if value is None:
            return None
        if isinstance(value, str):
            clean = value.strip().upper()
            if clean in ["PENDING", "CHO_XU_LY", "CHỜ XỬ LÝ"]:
                return PaymentStatus.PENDING
            if clean in ["SUCCESS", "THANH_CONG", "THÀNH CÔNG"]:
                return PaymentStatus.SUCCESS
            if clean in ["FAILED", "THAT_BAI", "THẤT BẠI"]:
                return PaymentStatus.FAILED
        return value


class PaymentOut(PaymentBase):
    """Dữ liệu API trả về cho FE."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount: float
    created_at: datetime
