from datetime import datetime
from decimal import Decimal
import enum
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.booking import Booking
    from app.models.court import Court


class BookingSlotStatus(str, enum.Enum):
    Active = "Active"
    Cancelled = "Cancelled"


class BookingSlot(Base):
    __tablename__ = "booking_slots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    booking_id: Mapped[int] = mapped_column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    court_id: Mapped[int] = mapped_column(Integer, ForeignKey("courts.id", ondelete="CASCADE"), nullable=False)
    
    start_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    price_per_hour: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=50000)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=50000)
    
    status: Mapped[BookingSlotStatus] = mapped_column(
        Enum(BookingSlotStatus), default=BookingSlotStatus.Active, server_default="Active", nullable=False
    )

    booking: Mapped["Booking"] = relationship("Booking", back_populates="booking_slots")
    court: Mapped["Court"] = relationship("Court", back_populates="booking_slots")
