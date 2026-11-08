from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.orm import relationship
from app.db.session import Base 

class Court(Base):
    __tablename__ = "courts"

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