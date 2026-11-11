import enum
from datetime import datetime
from typing import List

from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, func
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.models.price_rule import PriceRule
from app.models.court_block import CourtBlock


class CourtStatus(str, enum.Enum):
    Active = "HOẠT ĐỘNG"
    Maintenance = "BẢO TRÌ"
    Inactive = "NGƯNG HOẠT ĐỘNG"


class Court(Base):
    __tablename__ = "courts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)

    status = Column(
        Enum(
            CourtStatus, 
            values_callable=lambda obj: [e.value for e in obj]
        ), 
        default=CourtStatus.Active, 
        nullable=False
    )
    
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    price_rules = relationship("PriceRule", back_populates="court", cascade="all, delete-orphan")
    court_blocks = relationship("CourtBlock", back_populates="court", cascade="all, delete-orphan")
    

    booking_slots = relationship("BookingSlot", back_populates="court")