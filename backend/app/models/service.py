import enum
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, List

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.service_order_item import ServiceOrderItem
    from app.models.service_stock_log import ServiceStockLog


class ServiceCategory(str, enum.Enum):
    DRINK = "DRINK"
    SHUTTLECOCK = "SHUTTLECOCK"
    RACKET_RENTAL = "RACKET_RENTAL"
    ACCESSORY = "ACCESSORY"
    OTHER = "OTHER"


class ServiceStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    OUT_OF_STOCK = "OUT_OF_STOCK"


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(150), nullable=False, index=True)
    category = Column(Enum(ServiceCategory), nullable=False, default=ServiceCategory.OTHER, index=True)
    unit_price = Column(Numeric(12, 2), nullable=False)
    stock_quantity = Column(Integer, nullable=False, default=0)
    unit = Column(String(30), nullable=False, default="cai")
    image_url = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    status = Column(Enum(ServiceStatus), nullable=False, default=ServiceStatus.ACTIVE, index=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    order_items = relationship("ServiceOrderItem", back_populates="service")
    stock_logs = relationship("ServiceStockLog", back_populates="service")
