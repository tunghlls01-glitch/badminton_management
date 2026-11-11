import enum
from sqlalchemy import Column, Integer, String, Text, Numeric, Enum, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship, synonym

from app.db.session import Base


class BookingType(str, enum.Enum):
    FixedSchedule = "FixedSchedule"
    Flexible = "Flexible"


class BookingStatus(str, enum.Enum):
    Confirmed = "Confirmed"
    CheckedIn = "CheckedIn"
    Completed = "Completed"
    Cancelled = "Cancelled"


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    booking_code = Column(String(20), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)

    # Alias customer_id trỏ về user_id
    customer_id = synonym("user_id")

    booking_type = Column(Enum(BookingType), default=BookingType.Flexible, nullable=False)
    status = Column(Enum(BookingStatus), default=BookingStatus.Confirmed, nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    # Khớp đúng back_populates='user' với model User
    user = relationship("User", back_populates="bookings", foreign_keys=[user_id])
    customer = synonym("user")

    slots = relationship("BookingSlot", back_populates="booking", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="booking")
    payments = relationship("Payment", back_populates="booking")
    service_orders = relationship("ServiceOrder", back_populates="booking")

    @property
    def invoice(self):
        return self.invoices[0] if self.invoices else None
