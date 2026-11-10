"""Model ServiceStockLog: Lịch sử nhập/xuất kho dịch vụ."""
import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.service import Service


class StockChangeType(str, enum.Enum):
    IMPORT = "IMPORT"
    EXPORT = "EXPORT"
    ADJUSTMENT = "ADJUSTMENT"


class ServiceStockLog(Base):
    __tablename__ = "service_stock_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False, index=True)
    change_type = Column(Enum(StockChangeType), nullable=False)
    quantity = Column(Integer, nullable=False)
    current_stock = Column(Integer, nullable=False)
    note = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    service = relationship("Service", back_populates="stock_logs")
    