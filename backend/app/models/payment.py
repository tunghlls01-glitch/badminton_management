"""Model Payment: Quản lý thanh toán."""
import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Column, DateTime, Enum, Integer, Numeric, String, func, ForeignKey
from app.db.session import Base
from sqlalchemy.orm import relationship

class PaymentMethod(str, enum.Enum):
    CASH = "CASH"
    BANK_TRANSFER = "BANK_TRANSFER"
    E_WALLET = "E_WALLET"


class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True)
    service_order_id = Column(Integer, nullable=True)
    invoice_id = Column(Integer, nullable=True, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_method = Column(Enum(PaymentMethod), nullable=False, default=PaymentMethod.CASH)
    payment_status = Column(Enum(PaymentStatus), nullable=False, default=PaymentStatus.PENDING)
    transaction_code = Column(String(100), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    @property
    def status(self) -> PaymentStatus:
        return self.payment_status

    @status.setter
    def status(self, val):
        self.payment_status = val

    @property
    def transaction_id(self):
        return self.transaction_code

    @transaction_id.setter
    def transaction_id(self, val):
        self.transaction_code = val

    # Relationship ngược về Booking
    booking = relationship("Booking", back_populates="payments")