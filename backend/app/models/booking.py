from datetime import datetime
from decimal import Decimal
import enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.booking_slot import BookingSlot, BookingSlotStatus

if TYPE_CHECKING:
    from app.models.invoice import Invoice
    from app.models.payment import Payment
    from app.models.service import ServiceOrder
    from app.models.user import User


class BookingChannel(str, enum.Enum):
    Online = "Online"
    Counter = "Counter"
    Admin = "Admin"


class BookingStatus(str, enum.Enum):
    Pending = "Pending"
    Confirmed = "Confirmed"
    CHECKED_IN = "CHECKED_IN"
    NO_SHOW = "NO_SHOW"
    Completed = "Completed"
    Cancelled = "Cancelled"
    Expired = "Expired"


class InvoiceStatus(str, enum.Enum):
    Draft = "Draft"
    Issued = "Issued"
    Cancelled = "Cancelled"


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    booking_code: Mapped[str] = mapped_column(String(30), unique=True, index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    booking_channel: Mapped[BookingChannel] = mapped_column(
        Enum(BookingChannel), default=BookingChannel.Counter, server_default="Counter", nullable=False
    )
    total_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    status: Mapped[BookingStatus] = mapped_column(
        Enum(BookingStatus), default=BookingStatus.Pending, server_default="Pending", nullable=False
    )
    note: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # Alias để code dùng total_amount hay total_price đều được
    @property
    def total_amount(self) -> Decimal:
        return self.total_price

    @total_amount.setter
    def total_amount(self, value: Decimal):
        self.total_price = value

    @property
    def customer_id(self) -> int:
        return self.user_id

    # Relationships
    user = relationship("User", back_populates="bookings", foreign_keys=[user_id])
    creator: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by])
    booking_slots: Mapped[List["BookingSlot"]] = relationship(
        "BookingSlot", back_populates="booking", cascade="all, delete-orphan"
    )
    payments = relationship("Payment", back_populates="booking", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="booking", cascade="all, delete-orphan")
    service_orders = relationship("ServiceOrder", back_populates="booking", cascade="all, delete-orphan")

    # Alias slots -> booking_slots
    @property
    def slots(self):
        return self.booking_slots

    @property
    def invoice(self) -> Optional["Invoice"]:
        return self.invoices[0] if self.invoices else None
