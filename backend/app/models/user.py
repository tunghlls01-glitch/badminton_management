from datetime import datetime
import enum
from typing import TYPE_CHECKING, List

from sqlalchemy import DateTime, Enum, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.booking import Booking
    from app.models.court import CourtBlock


class UserRole(str, enum.Enum):
    Admin = "Admin"
    Receptionist = "Receptionist"
    Customer = "Customer"


class UserStatus(str, enum.Enum):
    Active = "Active"
    Inactive = "Inactive"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(15), nullable=True)
    email: Mapped[str | None] = mapped_column(String(100), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True, default="")
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole), default=UserRole.Customer, server_default="Customer", nullable=False
    )
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus), default=UserStatus.Active, server_default="Active", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    bookings: Mapped[List["Booking"]] = relationship(
        "Booking", foreign_keys="Booking.user_id", back_populates="user"
    )
    court_blocks: Mapped[List["CourtBlock"]] = relationship("CourtBlock", back_populates="creator")
