import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Integer,
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
    
    start_at: Mapped[datetime] = mapped_column("start_time", DateTime, nullable=False)
    end_at: Mapped[datetime] = mapped_column("end_time", DateTime, nullable=False)
    
    status: Mapped[BookingSlotStatus] = mapped_column(
        Enum(BookingSlotStatus), default=BookingSlotStatus.Active, server_default="Active", nullable=False
    )


    booking: Mapped["Booking"] = relationship("Booking", back_populates="booking_slots")
    court: Mapped["Court"] = relationship("Court", back_populates="booking_slots")