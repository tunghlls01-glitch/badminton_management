import enum

from sqlalchemy import Column, Integer, String, Enum, DateTime, func, Text
from sqlalchemy.orm import relationship

from sqlalchemy import Column, Integer, String, DateTime, func, Text
from sqlalchemy.orm import relationship, synonym


from app.db.session import Base


class CourtStatus(str, enum.Enum):
    Active = "Active"
    Maintenance = "Maintenance"
    Inactive = "Inactive"

    # Alias tiếng Việt
    HOẠT_ĐỘNG = "Active"
    BẢO_TRÌ = "Maintenance"
    NGƯNG_HOẠT_ĐỘNG = "Inactive"


class Court(Base):
    __tablename__ = "courts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    court_name = Column(String(100), nullable=False)
    name = synonym("court_name")  # Alias giúp tương thích nếu router khác gọi court.name
    court_type = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    image_url = Column(String(255), nullable=True)
    status = Column(String(50), default="HOẠT ĐỘNG")

    created_at = Column(DateTime, server_default=func.now(), nullable=True)


    price_rules = relationship("PriceRule", back_populates="court", cascade="all, delete-orphan")
    blocks = relationship("CourtBlock", back_populates="court", cascade="all, delete-orphan")
    court_blocks = synonym("blocks")
    booking_slots = relationship("BookingSlot", back_populates="court")