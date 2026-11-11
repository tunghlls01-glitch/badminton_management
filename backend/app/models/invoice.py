"""Model Invoice: Module 12 - Hóa đơn tổng kết."""
from datetime import datetime
from decimal import Decimal
from sqlalchemy.orm import relationship
from sqlalchemy import Column, DateTime, Integer, Numeric, String, func, ForeignKey
from app.db.session import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_code = Column(String(30), unique=True, nullable=False, index=True)
    booking_id = Column(Integer, nullable=True, index=True)
    customer_id = Column(Integer, nullable=False, index=True)
    total_court_amount = Column(Numeric(12, 2), default=0, nullable=False)
    total_service_amount = Column(Numeric(12, 2), default=0, nullable=False)
    grand_total = Column(Numeric(12, 2), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False)

    booking = relationship("Booking", back_populates="invoices")