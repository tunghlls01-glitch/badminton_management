"""Model ServiceOrder: Đơn đặt dịch vụ / đồ ăn nước uống."""
import enum
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, List

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.service_order_item import ServiceOrderItem


class ServiceOrderStatus(str, enum.Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class ServiceOrder(Base):
    __tablename__ = "service_orders"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    booking_id = Column(Integer, nullable=True, index=True)
    customer_id = Column(Integer, nullable=False, index=True)
    total_amount = Column(Numeric(12, 2), nullable=False, default=0)
    status = Column(Enum(ServiceOrderStatus), nullable=False, default=ServiceOrderStatus.PENDING, index=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    items = relationship("ServiceOrderItem", back_populates="order")

    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True) 

    booking = relationship("Booking", back_populates="service_orders")

