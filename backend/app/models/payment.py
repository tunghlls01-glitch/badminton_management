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
    invoice_id = Column(Integer, nullable=False, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_method = Column(Enum(PaymentMethod), nullable=False, default=PaymentMethod.CASH)
    status = Column(Enum(PaymentStatus), nullable=False, default=PaymentStatus.PENDING)
    transaction_id = Column(String(100), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False)

    # Relationship ngược về Booking
    booking = relationship("Booking", back_populates="payments")