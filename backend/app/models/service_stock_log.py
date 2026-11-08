"""Model Quản lý Lịch sử tồn kho (bảng service_stock_logs).

Ghi lại biến động kho khi: Nhập hàng, Bán lẻ, Hoàn trả, Kiểm kê cân bằng kho.
"""
import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.service import Service


class StockChangeType(str, enum.Enum):
    IMPORT = "Import"        # Nhập hàng vào kho
    SALE = "Sale"            # Bán lẻ / xuất phục vụ đơn dịch vụ
    RETURN = "Return"        # Khách trả lại / hoàn trả kho
    ADJUSTMENT = "Adjustment"  # Điều chỉnh khi kiểm kê lệch kho


class ServiceStockLog(Base):
    __tablename__ = "service_stock_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    service_id: Mapped[int] = mapped_column(
        ForeignKey("services.id", ondelete="CASCADE"), index=True
    )
    created_by: Mapped[int | None] = mapped_column(nullable=True, index=True)
    change_type: Mapped[StockChangeType] = mapped_column(Enum(StockChangeType), index=True)
    quantity_change: Mapped[int] = mapped_column()     # Số dương (nhập/hoàn trả) hoặc số âm (xuất/bán)
    quantity_before: Mapped[int] = mapped_column()     # Tồn trước khi thay đổi
    quantity_after: Mapped[int] = mapped_column()      # Tồn sau khi thay đổi
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Quan hệ
    service: Mapped["Service"] = relationship("Service", back_populates="stock_logs")
