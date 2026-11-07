"""Model Quản lý Đơn đặt dịch vụ (bảng service_orders).

Bao gồm:
- Đơn bán tại quầy cho khách vãng lai (booking_id = None).
- Đơn đặt kèm lịch đặt sân (booking_id != None).
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


class ServiceOrderStatus(str, enum.Enum):
    PENDING = "Pending"      # Chờ xác nhận / chờ giao
    CONFIRMED = "Confirmed"  # Đã xác nhận
    COMPLETED = "Completed"  # Hoàn thành & đã thanh toán
    CANCELLED = "Cancelled"  # Đã hủy đơn


class ServiceOrder(Base):
    __tablename__ = "service_orders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # booking_id: NULL nghĩa là khách vãng lai mua tại quầy; NOT NULL là đi kèm lịch đặt sân
    booking_id: Mapped[int | None] = mapped_column(nullable=True, index=True)

    # created_by: Nhân viên hoặc khách hàng tạo đơn
    created_by: Mapped[int | None] = mapped_column(nullable=True, index=True)

    total_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    status: Mapped[ServiceOrderStatus] = mapped_column(
        Enum(ServiceOrderStatus), default=ServiceOrderStatus.PENDING, index=True
    )
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # Quan hệ
    items: Mapped[list["ServiceOrderItem"]] = relationship(
        "ServiceOrderItem", back_populates="order", cascade="all, delete-orphan"
    )
