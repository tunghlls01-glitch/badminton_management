"""Model Quản lý Dịch vụ / Sản phẩm (bảng services).

Bao gồm:
- Nước uống, ống cầu, thuê vợt, phụ kiện...
- Giá niêm yết và số lượng tồn kho hiện tại.
"""
import enum
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.service_order_item import ServiceOrderItem
    from app.models.service_stock_log import ServiceStockLog


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

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), index=True)
    category: Mapped[ServiceCategory] = mapped_column(
        Enum(ServiceCategory), default=ServiceCategory.KHAC, index=True
    )
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    unit: Mapped[str] = mapped_column(String(30))  # Chai, Lon, Ống, Quả, Cái, Đôi, Cây/Lượt...
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    stock_quantity: Mapped[int] = mapped_column(default=0)
    status: Mapped[ServiceStatus] = mapped_column(
        Enum(ServiceStatus), default=ServiceStatus.ACTIVE, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # Quan hệ
    order_items: Mapped[list["ServiceOrderItem"]] = relationship(
        "ServiceOrderItem", back_populates="service"
    )
    stock_logs: Mapped[list["ServiceStockLog"]] = relationship(
        "ServiceStockLog", back_populates="service", cascade="all, delete-orphan"
    )
