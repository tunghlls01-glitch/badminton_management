import enum
from decimal import Decimal
from sqlalchemy import Column, Integer, SmallInteger, Time, ForeignKey, Numeric, Enum
from sqlalchemy.orm import relationship
from app.db.session import Base


class PriceRuleStatus(str, enum.Enum):
    Active = "Active"
    Inactive = "Inactive"


class PriceRule(Base):
    __tablename__ = "price_rules"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    court_id = Column(Integer, ForeignKey("courts.id"), nullable=False)
    day_of_week = Column(SmallInteger, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    price_per_hour = Column(Numeric(10, 2), nullable=False)
    status = Column(Enum(PriceRuleStatus), default=PriceRuleStatus.Active, server_default="Active", nullable=False)

    # Alias để tương thích nếu code gọi hourly_rate
    @property
    def hourly_rate(self) -> Decimal:
        return self.price_per_hour

    @hourly_rate.setter
    def hourly_rate(self, val: Decimal):
        self.price_per_hour = val

    # Relationship
    court = relationship("Court", back_populates="price_rules")