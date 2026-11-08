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
from app.models.invoice import Invoice
from app.models.payment import Payment, PaymentMethod, PaymentStatus

if TYPE_CHECKING:
    from app.models.court import Court
    from app.models.service import ServiceOrder
    from app.models.user import User


class BookingChannel(str, enum.Enum):
    Online = "Online"
    Counter = "Counter"
    Admin = "Admin"


class BookingStatus(str, enum.Enum):
    Pending = "Pending"
    Confirmed = "Confirmed"
    Completed = "Completed"
    Cancelled = "Cancelled"
    Expired = "Expired"


class BookingSlotStatus(str, enum.Enum):
    Active = "Active"
    Cancelled = "Cancelled"


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

    # Relationships
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], back_populates="bookings")
    creator: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by])
    booking_slots: Mapped[List["BookingSlot"]] = relationship(
        "BookingSlot", back_populates="booking", cascade="all, delete-orphan"
    )
    payments: Mapped[List["Payment"]] = relationship(
        "Payment", back_populates="booking", cascade="all, delete-orphan"
    )
    invoices: Mapped[List["Invoice"]] = relationship(
        "Invoice", back_populates="booking", cascade="all, delete-orphan"
    )
    service_orders: Mapped[List["ServiceOrder"]] = relationship(
        "ServiceOrder", back_populates="booking", cascade="all, delete-orphan"
    )

    @property
    def invoice(self) -> Optional["Invoice"]:
        return self.invoices[0] if self.invoices else None


class BookingSlot(Base):
    __tablename__ = "booking_slots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    booking_id: Mapped[int] = mapped_column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    court_id: Mapped[int] = mapped_column(Integer, ForeignKey("courts.id", ondelete="CASCADE"), nullable=False)
    start_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    price_per_hour: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[BookingSlotStatus] = mapped_column(
        Enum(BookingSlotStatus), default=BookingSlotStatus.Active, server_default="Active", nullable=False
    )

    # Relationships
    booking: Mapped["Booking"] = relationship("Booking", back_populates="booking_slots")
    court: Mapped["Court"] = relationship("Court", back_populates="booking_slots")