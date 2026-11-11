import enum
from sqlalchemy import Column, Integer, String, Enum, DateTime, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class CourtStatus(str, enum.Enum):
    Available = "Available"
    Occupied = "Occupied"
    Maintenance = "Maintenance"


class Court(Base):
    __tablename__ = "courts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(50), nullable=False)
    court_type = Column(String(50), default="Standard", nullable=False)
    status = Column(Enum(CourtStatus), default=CourtStatus.Available, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    price_rules = relationship("PriceRule", back_populates="court", cascade="all, delete-orphan")
    blocks = relationship("CourtBlock", back_populates="court", cascade="all, delete-orphan")
    booking_slots = relationship("BookingSlot", back_populates="court")
