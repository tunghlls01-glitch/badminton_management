<<<<<<< HEAD
from datetime import datetime, time
from decimal import Decimal
import enum
from typing import TYPE_CHECKING, List

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Time,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.booking import BookingSlot
    from app.models.user import User


class CourtStatus(str, enum.Enum):
    Active = "Active"
    Maintenance = "Maintenance"
    Inactive = "Inactive"


class PriceRuleStatus(str, enum.Enum):
    Active = "Active"
    Inactive = "Inactive"


class CourtBlockStatus(str, enum.Enum):
    Active = "Active"
    Cancelled = "Cancelled"

=======
from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.orm import relationship
from app.db.session import Base 
>>>>>>> e37cffa230bdbaaa69456dce5e0b004f7490fbaa

class Court(Base):
    __tablename__ = "courts"

<<<<<<< HEAD
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[CourtStatus] = mapped_column(
        Enum(CourtStatus), default=CourtStatus.Active, server_default="Active", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    price_rules: Mapped[List["PriceRule"]] = relationship(
        "PriceRule", back_populates="court", cascade="all, delete-orphan"
    )
    court_blocks: Mapped[List["CourtBlock"]] = relationship(
        "CourtBlock", back_populates="court", cascade="all, delete-orphan"
    )
    booking_slots: Mapped[List["BookingSlot"]] = relationship(
        "BookingSlot", back_populates="court"
    )


class PriceRule(Base):
    __tablename__ = "price_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    court_id: Mapped[int] = mapped_column(Integer, ForeignKey("courts.id", ondelete="CASCADE"), nullable=False)
    day_of_week: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    price_per_hour: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[PriceRuleStatus] = mapped_column(
        Enum(PriceRuleStatus), default=PriceRuleStatus.Active, server_default="Active", nullable=False
    )

    court: Mapped["Court"] = relationship("Court", back_populates="price_rules")


class CourtBlock(Base):
    __tablename__ = "court_blocks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    court_id: Mapped[int] = mapped_column(Integer, ForeignKey("courts.id", ondelete="CASCADE"), nullable=False)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    start_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[CourtBlockStatus] = mapped_column(
        Enum(CourtBlockStatus), default=CourtBlockStatus.Active, server_default="Active", nullable=False
    )

    court: Mapped["Court"] = relationship("Court", back_populates="court_blocks")
    creator: Mapped["User"] = relationship("User", back_populates="court_blocks")
=======
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    court_name = Column(String(50), nullable=False)
    court_type = Column(String(30), nullable=True)
    status = Column(String(20), default="HOẠT ĐỘNG")
    description = Column(Text, nullable=True)
    image_url = Column(String(255), nullable=True)
    created_at = Column(DateTime, nullable=True)

    # Relationships
    price_rules = relationship("PriceRule", back_populates="court", cascade="all, delete-orphan")
    court_blocks = relationship("CourtBlock", back_populates="court", cascade="all, delete-orphan")
>>>>>>> e37cffa230bdbaaa69456dce5e0b004f7490fbaa
