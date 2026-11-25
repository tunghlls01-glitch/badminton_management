from datetime import datetime, timedelta
from unittest import TestCase
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app import models  # noqa: F401
from app.crud.booking import is_slot_available
from app.crud.slot import get_slot_grid_by_date, hold_slots
from app.db.session import Base
from app.models.booking import Booking, BookingStatus
from app.models.booking_slot import BookingSlot
from app.models.court import Court
from app.models.user import User
from app.schemas.slot import SlotDisplayStatus, SlotHoldRequest, SlotTimeRange


class SlotAvailabilityTest(TestCase):
    def test_paid_booking_blocks_only_its_occupied_half_hour(self):
        engine = create_engine("sqlite://")
        self.addCleanup(engine.dispose)
        Base.metadata.create_all(engine)
        now = datetime(2026, 11, 25, 14, 6)
        start = now.replace(minute=30)
        end = start + timedelta(minutes=30)
        next_end = end + timedelta(minutes=30)

        with Session(engine) as db:
            db.add_all([
                Court(id=1, name="Sân số 2"),
                User(id=1, full_name="Customer", email="demo@example.com",
                     phone="0900000134", hashed_password=""),
                Booking(id=1, user_id=1, booking_code="BK-PAID", status=BookingStatus.Completed),
                BookingSlot(booking_id=1, court_id=1, start_at=start, end_at=end),
            ])
            db.commit()

            with patch("app.crud.slot.vietnam_now", return_value=now), patch(
                "app.crud.booking.vietnam_now", return_value=now
            ):
                slots = {row.start_at: row for row in get_slot_grid_by_date(db, now.date(), 30)[0].slots}
                self.assertEqual(slots[start].status, SlotDisplayStatus.BOOKED)
                self.assertEqual(slots[end].status, SlotDisplayStatus.FREE)
                self.assertFalse(is_slot_available(db, 1, start, end))
                self.assertTrue(is_slot_available(db, 1, end, next_end))
                with self.assertRaises(HTTPException) as conflict:
                    hold_slots(db, SlotHoldRequest(
                        user_id=1, slots=[SlotTimeRange(court_id=1, start_at=start, end_at=end)]
                    ))
                self.assertEqual(conflict.exception.status_code, 409)
                hold = hold_slots(db, SlotHoldRequest(
                    user_id=1, slots=[SlotTimeRange(court_id=1, start_at=end, end_at=next_end)]
                ))
                self.assertEqual(hold.court_id, 1)
                self.assertFalse(is_slot_available(db, 1, end, next_end))
