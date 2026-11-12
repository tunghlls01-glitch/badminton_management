import enum
from sqlalchemy import Column, Integer, String, Numeric, Enum, DateTime, Text, func
from sqlalchemy.orm import relationship
from app.db.session import Base

class ServiceCategory(str, enum.Enum):
    NUOC = "NUOC"
    ONG_CAU = "ONG_CAU"
    THUE_VOT = "THUE_VOT"
    KHAC = "KHAC"
    DRINK = "DRINK"
    SHUTTLECOCK = "SHUTTLECOCK"
    RACKET_RENTAL = "RACKET_RENTAL"
    ACCESSORY = "ACCESSORY"
    OTHER = "OTHER"

class ServiceStatus(str, enum.Enum):
    ACTIVE = "Active"
    INACTIVE = "Inactive"
    OUT_OF_STOCK = "OUT_OF_STOCK"

class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(150), nullable=False, index=True)
    category = Column(Enum(ServiceCategory), default=ServiceCategory.OTHER, nullable=False, index=True)
    description = Column(Text, nullable=True)
    unit = Column(String(30), nullable=False, default="cai")
    price = Column(Numeric(12, 2), default=0, nullable=False)
    stock_quantity = Column(Integer, default=0, nullable=False)
    image_url = Column(String(500), nullable=True)
    status = Column(Enum(ServiceStatus), default=ServiceStatus.ACTIVE, nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    @property
    def unit_price(self):
        return self.price

    @unit_price.setter
    def unit_price(self, val):
        self.price = val

    # Relationships
    order_items = relationship("ServiceOrderItem", back_populates="service")
    stock_logs = relationship("ServiceStockLog", back_populates="service")
