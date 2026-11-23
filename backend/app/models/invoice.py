"""Model Invoice: Module 12 - Hóa đơn tổng kết."""
from datetime import datetime
from decimal import Decimal
from sqlalchemy.orm import relationship, foreign
from sqlalchemy import Column, DateTime, Integer, Numeric, String, func, ForeignKey
from app.db.session import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_code = Column(String(30), unique=True, nullable=False, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False, unique=True, index=True)
    customer_id = Column(Integer, nullable=False, index=True)
    staff_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    total_court_amount = Column(Numeric(12, 2), default=0, nullable=False)
    total_service_amount = Column(Numeric(12, 2), default=0, nullable=False)
    discount_amount = Column(Numeric(12, 2), default=0, nullable=False)
    discount_reason = Column(String(255), nullable=True)
    grand_total = Column(Numeric(12, 2), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    booking = relationship("Booking", back_populates="invoices")
    customer = relationship("User", foreign_keys=[customer_id], primaryjoin="Invoice.customer_id == User.id")
    staff = relationship("User", foreign_keys=[staff_id], primaryjoin="Invoice.staff_id == User.id")
    payment = relationship("Payment", primaryjoin="Invoice.id == foreign(Payment.invoice_id)", uselist=False)
