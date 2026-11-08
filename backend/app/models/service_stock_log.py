import enum
from sqlalchemy import Column, Integer, String, Enum, DateTime, func
from app.db.session import Base

class StockChangeType(str, enum.Enum):
    IMPORT = "Nhập hàng"
    SALE = "Bán lẻ"
    ADJUSTMENT = "Điều chỉnh"

class ServiceStockLog(Base):
    __tablename__ = "service_stock_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    service_id = Column(Integer, nullable=False, index=True)
    change_type = Column(Enum(StockChangeType), nullable=False)
    quantity_change = Column(Integer, nullable=False)  # Số dương: nhập hàng, Số âm: bán ra
    quantity_before = Column(Integer, nullable=False)  # Tồn kho trước khi đổi
    quantity_after = Column(Integer, nullable=False)   # Tồn kho sau khi đổi
    note = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
