import enum
from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.session import Base

class StockChangeType(str, enum.Enum):
    IMPORT = "IMPORT"
    EXPORT = "EXPORT"
    SALE = "SALE"
    ADJUSTMENT = "ADJUSTMENT"

class ServiceStockLog(Base):
    __tablename__ = "service_stock_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False, index=True)
    change_type = Column(Enum(StockChangeType), nullable=False)
    quantity_change = Column(Integer, nullable=False, default=0)
    quantity_before = Column(Integer, nullable=False, default=0)
    quantity_after = Column(Integer, nullable=False, default=0)
    note = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    @property
    def quantity(self):
        return self.quantity_change

    @property
    def current_stock(self):
        return self.quantity_after

    # Relationships
    service = relationship("Service", back_populates="stock_logs")
