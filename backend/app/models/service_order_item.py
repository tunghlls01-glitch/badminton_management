from sqlalchemy import Column, Integer, Numeric
from app.db.session import Base

class ServiceOrderItem(Base):
    __tablename__ = "service_order_items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    service_order_id = Column(Integer, nullable=False, index=True)
    service_id = Column(Integer, nullable=False, index=True)
    quantity = Column(Integer, default=1, nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)  # Giá tại thời điểm đặt món
    amount = Column(Numeric(12, 2), nullable=False)      # Thành tiền = quantity * unit_price
