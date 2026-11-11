import enum
from sqlalchemy import Column, Integer, String, Enum, DateTime, func, Text
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

    id = Column(Integer, primary_key=True, index=True)
    court_name = Column(String(100), nullable=False)  # Hoặc 'name' tùy bạn chọn
    court_type = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    image_url = Column(String(255), nullable=True)
    status = Column(String(50), default="HOẠT ĐỘNG")

    price_rules = relationship("PriceRule", back_populates="court", cascade="all, delete-orphan")
    blocks = relationship("CourtBlock", back_populates="court", cascade="all, delete-orphan")
    booking_slots = relationship("BookingSlot", back_populates="court")
