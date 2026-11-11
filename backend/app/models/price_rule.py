from sqlalchemy import Column, Integer, String, Time, ForeignKey, Numeric
from sqlalchemy.orm import relationship
from app.db.session import Base

class PriceRule(Base):
    __tablename__ = "price_rules"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    court_id = Column(Integer, ForeignKey("courts.id"), nullable=False)
    day_of_week = Column(String(20), nullable=True)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    hourly_rate = Column(Numeric(12, 2), nullable=False)

    # Relationship
    court = relationship("Court", back_populates="price_rules")