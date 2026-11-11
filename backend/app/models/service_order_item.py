from sqlalchemy import Column, Integer, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base

class ServiceOrderItem(Base):
    __tablename__ = "service_order_items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    service_order_id = Column(Integer, ForeignKey("service_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False, index=True)
    quantity = Column(Integer, default=1, nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)  # Giá tại thời điểm đặt món
    amount = Column(Numeric(12, 2), nullable=False)      # Thành tiền = quantity * unit_price

    # Relationships
    order = relationship("ServiceOrder", back_populates="items")
    service = relationship("Service", back_populates="order_items")
