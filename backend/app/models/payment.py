"""Model Payment: Module 11 - Thanh toán."""
from datetime import datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import DateTime, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class PaymentMethod(str, Enum):
    CASH = "CASH"
    BANK_TRANSFER = "BANK_TRANSFER"
    QR_VNPAY = "QR_VNPAY"


class PaymentStatus(str, Enum):
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    booking_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    service_order_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    payment_method: Mapped[str] = mapped_column(String(20), nullable=False, default=PaymentMethod.CASH.value)
    payment_status: Mapped[str] = mapped_column(String(20), nullable=False, default=PaymentStatus.SUCCESS.value)
    transaction_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

