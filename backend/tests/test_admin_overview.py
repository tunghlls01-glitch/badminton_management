from datetime import date, datetime, timedelta
from decimal import Decimal
from unittest import TestCase
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app import models  # noqa: F401
from app.crud.admin_overview import get_overview, search_bookings
from app.crud.booking import is_slot_available
from app.db.session import Base
from app.models.booking import Booking, BookingStatus
from app.models.booking_slot import BookingSlot
from app.models.court import Court, CourtStatus
from app.models.court_block import CourtBlock
from app.models.invoice import Invoice
from app.models.payment import Payment, PaymentStatus
from app.models.user import User


class OverviewTest(TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.addCleanup(self.engine.dispose)
        self.addCleanup(self.db.close)
        self.day = date(2026, 11, 22)
        self.now = datetime(2026, 11, 22, 14, 15)

    def test_empty_day(self):
        result = get_overview(self.db, self.day, self.now)
        self.assertEqual(result["courts"], [])
        self.assertEqual(result["booking_count"], 0)
        self.assertEqual([item["amount"] for item in result["revenue"]], [Decimal(0)] * 7)

    def test_occupancy_revenue_recurring_and_expired_hold(self):
        self.db.add_all([
            User(id=1, full_name="Customer", email="demo@example.com", phone="0900000134", hashed_password=""),
            Court(id=1, name="Sân 1"),
            Court(id=2, name="Sân 2"),
            Court(id=3, name="Sân bảo trì", status=CourtStatus.Maintenance),
        ])
        self.db.flush()
        bookings = [
            Booking(id=1, user_id=1, booking_code="CHECKEDIN", status=BookingStatus.CHECKED_IN),
            Booking(id=2, user_id=1, booking_code="EXPIREDHOLD", hold_expires_at=self.now - timedelta(minutes=1)),
            Booking(id=3, user_id=1, booking_code="ACTIVEHOLD", hold_expires_at=self.now + timedelta(minutes=1)),
            Booking(id=4, user_id=1, booking_code="PENDING"),
            Booking(id=5, user_id=1, booking_code="CHECKIN-SOON", status=BookingStatus.Confirmed),
        ]
        self.db.add_all(bookings)
        self.db.flush()

        def slot(booking_id, court_id, hour, minute=0, days=0):
            start = self.now.replace(hour=hour, minute=minute) + timedelta(days=days)
            self.db.add(BookingSlot(booking_id=booking_id, court_id=court_id, start_at=start,
                                    end_at=start + timedelta(minutes=30)))

        slot(1, 1, 14)
        slot(1, 1, 15)
        slot(1, 1, 14, days=7)
        slot(2, 1, 14, 30)
        slot(3, 1, 15, 30)
        slot(4, 2, 18)
        slot(5, 2, 14, 30)
        self.db.add(CourtBlock(court_id=2, created_by=1, start_at=self.now.replace(hour=16, minute=0),
                               end_at=self.now.replace(hour=17, minute=0), reason="Bảo trì"))
        self.db.add(Invoice(id=1, booking_id=1, customer_id=1, invoice_code="INV-ONE",
                            grand_total=80, discount_amount=20, created_at=self.now))
        self.db.flush()
        self.db.add_all([
            Payment(booking_id=1, invoice_id=1, payment_status=PaymentStatus.SUCCESS,
                    amount=80, created_at=self.now - timedelta(days=1)),
            Payment(booking_id=4, payment_status=PaymentStatus.PENDING, amount=500, created_at=self.now),
            Payment(booking_id=2, payment_status=PaymentStatus.REFUNDED, amount=60, created_at=self.now),
        ])
        self.db.commit()

        result = get_overview(self.db, self.day, self.now)
        self.assertEqual(result["booking_count"], 3)
        self.assertEqual((result["pending_count"], result["checkin_count"]), (1, 1))
        self.assertEqual(result["next_checkin_id"], 5)
        self.assertEqual((result["courts_in_use"], result["courts_free"]), (1, 1))
        states = {cell["start"]: cell["state"] for cell in result["courts"][0]["cells"]}
        self.assertEqual(len(states), 34)
        self.assertEqual([states[t] for t in ("14:00", "14:30", "15:00", "15:30")],
                         ["booked", "free", "booked", "hold"])
        self.assertEqual(result["courts"][1]["cells"][20]["reason"], "Bảo trì")
        self.assertEqual([item["amount"] for item in result["revenue"]], [Decimal(0)] * 6 + [Decimal(80)])
        self.assertEqual(len(next(row["slots"] for row in result["recent"] if row["id"] == 1)), 2)
        self.assertEqual(get_overview(self.db, self.day + timedelta(days=7), self.now)["booking_count"], 1)
        expired_at = self.now.replace(hour=14, minute=30)
        with patch("app.crud.booking.vietnam_now", return_value=self.now):
            self.assertTrue(is_slot_available(self.db, 1, expired_at, expired_at + timedelta(minutes=30)))
        self.assertEqual([row["id"] for row in search_bookings(self.db, "expiredhold", self.now)], [])
        self.assertEqual(len(search_bookings(self.db, "0900000134", self.now)), 4)
