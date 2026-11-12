import enum
from sqlalchemy import Column, Integer, String, Numeric, Enum, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship

from app.db.session import Base

class ServiceOrderStatus(str, enum.Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class ServiceOrder(Base):
    __tablename__ = "service_orders"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True, index=True)
    customer_id = Column(Integer, nullable=True, index=True)
    total_amount = Column(Numeric(12, 2), default=0, nullable=False)
    status = Column(Enum(ServiceOrderStatus), default=ServiceOrderStatus.PENDING, nullable=False, index=True)
    note = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    @property
    def total_price(self):
        return self.total_amount

    @total_price.setter
    def total_price(self, val):
        self.total_amount = val

    # Relationships
    items = relationship("ServiceOrderItem", back_populates="order", cascade="all, delete-orphan")
    booking = relationship("Booking", back_populates="service_orders")
