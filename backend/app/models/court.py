import enum
from sqlalchemy import Column, Integer, String, Enum, DateTime, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class CourtStatus(str, enum.Enum):
    Active = "Active"
    Maintenance = "Maintenance"
    Inactive = "Inactive"

    # Alias nếu code dùng HOẠT ĐỘNG
    HOẠT_ĐỘNG = "Active"
    BẢO_TRÌ = "Maintenance"
    NGƯNG_HOẠT_ĐỘNG = "Inactive"


class Court(Base):
    __tablename__ = "courts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(50), nullable=False)
    description = Column(String(255), nullable=True)
    status = Column(Enum(CourtStatus), default=CourtStatus.Active, server_default="Active", nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    price_rules = relationship("PriceRule", back_populates="court", cascade="all, delete-orphan")
    blocks = relationship("CourtBlock", back_populates="court", cascade="all, delete-orphan")
    booking_slots = relationship("BookingSlot", back_populates="court")
