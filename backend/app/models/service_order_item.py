"""Model Quản lý Chi tiết món trong đơn dịch vụ (bảng service_order_items).

Lưu từng món hàng, số lượng, đơn giá tại thời điểm mua và thành tiền.
"""
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.service import Service
    from app.models.service_order import ServiceOrder


class ServiceOrderItem(Base):
    __tablename__ = "service_order_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    service_order_id: Mapped[int] = mapped_column(
        ForeignKey("service_orders.id", ondelete="CASCADE"), index=True
    )
    service_id: Mapped[int] = mapped_column(
        ForeignKey("services.id"), index=True
    )
    quantity: Mapped[int] = mapped_column(default=1)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))  # Giá tại thời điểm tạo đơn
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))      # quantity * unit_price

    # Quan hệ
    order: Mapped["ServiceOrder"] = relationship("ServiceOrder", back_populates="items")
    service: Mapped["Service"] = relationship("Service", back_populates="order_items")
