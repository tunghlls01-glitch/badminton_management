from sqlalchemy import Column, Integer, Date, Time, Numeric, ForeignKey
from sqlalchemy.orm import relationship

from app.db.session import Base


class BookingSlot(Base):
    __tablename__ = "booking_slots"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    court_id = Column(Integer, ForeignKey("courts.id", ondelete="CASCADE"), nullable=False)
    play_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    price = Column(Numeric(12, 2), nullable=False)

    booking = relationship("Booking", back_populates="slots")
    court = relationship("Court", back_populates="booking_slots")
