from datetime import datetime
from decimal import Decimal
import enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.booking import Booking
    from app.models.user import User


class ServiceStatus(str, enum.Enum):
    Active = "Active"
    Inactive = "Inactive"


class ServiceOrderStatus(str, enum.Enum):
    Pending = "Pending"
    Confirmed = "Confirmed"
    Completed = "Completed"
    Cancelled = "Cancelled"


class StockChangeType(str, enum.Enum):
    Import = "Import"
    Sale = "Sale"
    Return = "Return"
    Adjustment = "Adjustment"


class Service(Base):
    __tablename__ = "services"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    unit: Mapped[str] = mapped_column(String(30), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    stock_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[ServiceStatus] = mapped_column(
        Enum(ServiceStatus), default=ServiceStatus.Active, server_default="Active", nullable=False
    )

    # Relationships
    order_items: Mapped[List["ServiceOrderItem"]] = relationship(
        "ServiceOrderItem", back_populates="service"
    )
    stock_logs: Mapped[List["ServiceStockLog"]] = relationship(
        "ServiceStockLog", back_populates="service", cascade="all, delete-orphan"
    )


class ServiceOrder(Base):
    __tablename__ = "service_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    booking_id: Mapped[int] = mapped_column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    total_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    status: Mapped[ServiceOrderStatus] = mapped_column(
        Enum(ServiceOrderStatus), default=ServiceOrderStatus.Pending, server_default="Pending", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    booking: Mapped["Booking"] = relationship("Booking", back_populates="service_orders")
    creator: Mapped["User"] = relationship("User")
    items: Mapped[List["ServiceOrderItem"]] = relationship(
        "ServiceOrderItem", back_populates="service_order", cascade="all, delete-orphan"
    )


class ServiceOrderItem(Base):
    __tablename__ = "service_order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    service_order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("service_orders.id", ondelete="CASCADE"), nullable=False
    )
    service_id: Mapped[int] = mapped_column(Integer, ForeignKey("services.id", ondelete="CASCADE"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    # Relationships
    service_order: Mapped["ServiceOrder"] = relationship("ServiceOrder", back_populates="items")
    service: Mapped["Service"] = relationship("Service", back_populates="order_items")


class ServiceStockLog(Base):
    __tablename__ = "service_stock_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    service_id: Mapped[int] = mapped_column(Integer, ForeignKey("services.id", ondelete="CASCADE"), nullable=False)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    change_type: Mapped[StockChangeType] = mapped_column(Enum(StockChangeType), nullable=False)
    quantity_change: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_before: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_after: Mapped[int] = mapped_column(Integer, nullable=False)
    note: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    service: Mapped["Service"] = relationship("Service", back_populates="stock_logs")
    creator: Mapped["User"] = relationship("User")