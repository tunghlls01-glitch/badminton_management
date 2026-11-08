import enum
from sqlalchemy import Column, Integer, String, Numeric, Enum, DateTime, func
from app.db.session import Base

class ServiceOrderStatus(str, enum.Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class ServiceOrder(Base):
    __tablename__ = "service_orders"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    booking_id = Column(Integer, nullable=True, index=True)  # Null: khách vãng lai, Có ID: đi kèm lịch đặt sân
    total_price = Column(Numeric(12, 2), default=0, nullable=False)
    status = Column(Enum(ServiceOrderStatus), default=ServiceOrderStatus.PENDING, nullable=False)
    note = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
