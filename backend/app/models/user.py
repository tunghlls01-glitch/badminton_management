from datetime import datetime
import enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, Enum, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.booking import Booking
    from app.models.court import CourtBlock


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    STAFF = "STAFF"
    CUSTOMER = "CUSTOMER"

    # Aliases tương thích ngược
    Admin = "ADMIN"
    Receptionist = "STAFF"
    Customer = "CUSTOMER"


class UserStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    LOCKED = "LOCKED"

    # Aliases tương thích ngược
    Active = "ACTIVE"
    Inactive = "LOCKED"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    phone: Mapped[str] = mapped_column(String(15), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, native_enum=False, length=20),
        default=UserRole.CUSTOMER,
        server_default=UserRole.CUSTOMER.value,
        nullable=False,
    )
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus, native_enum=False, length=20),
        default=UserStatus.ACTIVE,
        server_default=UserStatus.ACTIVE.value,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Aliases để tương thích nếu code gọi .name hoặc .password_hash
    @property
    def name(self) -> str:
        return self.full_name

    @name.setter
    def name(self, val: str):
        self.full_name = val

    @property
    def password_hash(self) -> str:
        return self.hashed_password

    @password_hash.setter
    def password_hash(self, val: str):
        self.hashed_password = val

    # Relationships
    bookings: Mapped[List["Booking"]] = relationship(
        "Booking", foreign_keys="Booking.user_id", back_populates="user"
    )
    court_blocks: Mapped[List["CourtBlock"]] = relationship(
        "CourtBlock", foreign_keys="CourtBlock.created_by", back_populates="creator"
    )
