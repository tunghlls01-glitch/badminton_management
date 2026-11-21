import enum
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class RacketRentalStatus(str, enum.Enum):
    RENTING = "RENTING"      # Đang thuê (chưa trả)
    RETURNED = "RETURNED"    # Đã hoàn trả vợt


class RacketRental(Base):
    __tablename__ = "racket_rentals"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False, index=True)
    service_order_id = Column(Integer, ForeignKey("service_orders.id", ondelete="SET NULL"), nullable=True, index=True)
    quantity = Column(Integer, nullable=False, default=1)
    status = Column(String(20), nullable=False, default=RacketRentalStatus.RENTING.value, index=True)
    rented_at = Column(DateTime, server_default=func.now(), nullable=False)
    returned_at = Column(DateTime, nullable=True)
    note = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    # Relationships
    booking = relationship("Booking")
    service = relationship("Service")
    service_order = relationship("ServiceOrder")
