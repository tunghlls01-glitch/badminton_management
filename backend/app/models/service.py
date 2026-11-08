import enum
from sqlalchemy import Column, Integer, String, Numeric, Enum, DateTime, func
from app.db.session import Base

class ServiceCategory(str, enum.Enum):
    NUOC = "NƯỚC"
    ONG_CAU = "ỐNG CẦU"
    THUE_VOT = "THUÊ VỢT"
    KHAC = "KHÁC"

class ServiceStatus(str, enum.Enum):
    ACTIVE = "Active"
    INACTIVE = "Inactive"

class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False, index=True)
    category = Column(Enum(ServiceCategory), default=ServiceCategory.KHAC, nullable=False)
    description = Column(String(255), nullable=True)
    unit = Column(String(30), nullable=False)  # Chai, Lon, Ống, Quả, Cái, Đôi, Lượt...
    price = Column(Numeric(12, 2), default=0, nullable=False)
    stock_quantity = Column(Integer, default=0, nullable=False)
    status = Column(Enum(ServiceStatus), default=ServiceStatus.ACTIVE, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
