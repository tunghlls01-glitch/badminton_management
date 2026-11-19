"""Model thông báo gửi đến người dùng (ví dụ: admin hủy sân)."""
import enum
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.booking import Booking


class NotificationType(str, enum.Enum):
    BOOKING_CANCELLED_BY_ADMIN = "booking_cancelled_by_admin"
    BOOKING_CONFIRMED = "booking_confirmed"
    GENERAL = "general"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    booking_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True
    )
    type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType),
        default=NotificationType.GENERAL,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    admin_reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_read: Mapped[bool] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    booking = relationship("Booking", foreign_keys=[booking_id])
