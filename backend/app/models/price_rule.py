import enum
from decimal import Decimal
from sqlalchemy import Column, Integer, String, Time, ForeignKey, Numeric, Enum
from sqlalchemy.orm import relationship
from app.db.session import Base


class PriceRuleStatus(str, enum.Enum):
    Active = "Active"
    Inactive = "Inactive"


class PriceRule(Base):
    __tablename__ = "price_rules"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    court_id = Column(Integer, ForeignKey("courts.id"), nullable=False)
    day_of_week = Column(String(20), nullable=False, default="WEEKDAY")  # "WEEKDAY" hoặc "WEEKEND"
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    hourly_rate = Column(Numeric(10, 2), nullable=False)
    status = Column(
        Enum(PriceRuleStatus),
        default=PriceRuleStatus.Active,
        server_default="Active",
        nullable=False,
    )

    # Alias giữ tương thích nếu code cũ của nhóm gọi price_per_hour
    @property
    def price_per_hour(self) -> Decimal:
        return self.hourly_rate

    @price_per_hour.setter
    def price_per_hour(self, val: Decimal):
        self.hourly_rate = val

    # Relationship
    court = relationship("Court", back_populates="price_rules")