"""Model Invoice: Module 12 - Hóa đơn tổng kết."""
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.booking import Booking


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    invoice_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    booking_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True, index=True
    )
    customer_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    total_court_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    total_service_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    grand_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    @property
    def invoice_number(self) -> str:
        return self.invoice_code

    @property
    def total_amount(self) -> Decimal:
        return self.grand_total

    # Relationship
    booking: Mapped[Optional["Booking"]] = relationship(
        "Booking", foreign_keys=[booking_id], back_populates="invoices"
    )
