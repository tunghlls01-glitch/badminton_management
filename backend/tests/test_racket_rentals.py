"""Unit tests cho tính năng Thuê và Trả vợt theo Booking (T3D2CB1)."""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from decimal import Decimal
import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base
from app.models.user import User, UserRole
from app.models.booking import Booking, BookingStatus, BookingChannel
from app.models.court import Court
from app.models.service import Service, ServiceCategory
from app.models.racket_rental import RacketRental, RacketRentalStatus
from app.crud import racket_rental as rental_crud
from app.schemas.racket_rental import RacketRentalCreate


class RacketRentalTestCase(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # Seed test user & court & booking
        self.user = User(
            full_name="Tester",
            email="tester@example.com",
            phone="0911222333",
            hashed_password="hash",
            role=UserRole.ADMIN,
        )
        self.db.add(self.user)
        self.db.commit()

        self.court = Court(name="Sân 1", status="Active")
        self.db.add(self.court)
        self.db.commit()

        self.booking = Booking(
            booking_code="BK-TEST-01",
            user_id=self.user.id,
            booking_channel=BookingChannel.Counter,
            total_price=Decimal("150000"),
            status=BookingStatus.Confirmed,
        )
        self.db.add(self.booking)

        # Seed racket service
        self.service = Service(
            name="Vợt Yonex Nanoflare",
            category="THUE_VOT",
            price=30000,
            unit="Cây",
            stock_quantity=10,
            status="ACTIVE",
        )
        self.db.add(self.service)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)

    def test_create_rental_and_stock_deduction(self):
        rental = rental_crud.create_rental(
            self.db,
            RacketRentalCreate(
                booking_id=self.booking.id,
                service_id=self.service.id,
                quantity=2,
                note="Khách thuê 2 cây",
            ),
        )
        self.assertEqual(rental.quantity, 2)
        self.assertEqual(rental.status, RacketRentalStatus.RENTING.value)

        # Kiểm tra tồn kho bị trừ 10 -> 8
        self.db.refresh(self.service)
        self.assertEqual(self.service.stock_quantity, 8)

    def test_warning_check_when_renting(self):
        # Chưa thuê -> không warning
        warning = rental_crud.get_booking_rental_warning(self.db, self.booking.id)
        self.assertFalse(warning["has_unreturned_rackets"])
        self.assertEqual(warning["unreturned_count"], 0)

        # Thuê vợt -> có warning
        rental_crud.create_rental(
            self.db,
            RacketRentalCreate(
                booking_id=self.booking.id,
                service_id=self.service.id,
                quantity=3,
            ),
        )
        warning2 = rental_crud.get_booking_rental_warning(self.db, self.booking.id)
        self.assertTrue(warning2["has_unreturned_rackets"])
        self.assertEqual(warning2["unreturned_count"], 3)

    def test_return_rental_and_stock_restoration(self):
        rental = rental_crud.create_rental(
            self.db,
            RacketRentalCreate(
                booking_id=self.booking.id,
                service_id=self.service.id,
                quantity=2,
            ),
        )
        self.db.refresh(self.service)
        self.assertEqual(self.service.stock_quantity, 8)

        # Trả vợt
        returned = rental_crud.return_rental(self.db, rental.id, note="Trả đầy đủ")
        self.assertEqual(returned.status, RacketRentalStatus.RETURNED.value)
        self.assertIsNotNone(returned.returned_at)

        # Tồn kho được hoàn lại 8 -> 10
        self.db.refresh(self.service)
        self.assertEqual(self.service.stock_quantity, 10)

        # Hết warning
        warning = rental_crud.get_booking_rental_warning(self.db, self.booking.id)
        self.assertFalse(warning["has_unreturned_rackets"])
        self.assertEqual(warning["unreturned_count"], 0)

    def test_return_all_rackets_for_booking(self):
        # Thuê 2 lượt khác nhau
        rental_crud.create_rental(
            self.db,
            RacketRentalCreate(
                booking_id=self.booking.id,
                service_id=self.service.id,
                quantity=2,
            ),
        )
        rental_crud.create_rental(
            self.db,
            RacketRentalCreate(
                booking_id=self.booking.id,
                service_id=self.service.id,
                quantity=1,
            ),
        )
        self.db.refresh(self.service)
        self.assertEqual(self.service.stock_quantity, 7)

        # Thu hồi toàn bộ tại quầy
        returned_list = rental_crud.return_all_rackets_for_booking(self.db, self.booking.id)
        self.assertEqual(len(returned_list), 2)
        for r in returned_list:
            self.assertEqual(r.status, RacketRentalStatus.RETURNED.value)

        # Tồn kho hoàn đủ 10
        self.db.refresh(self.service)
        self.assertEqual(self.service.stock_quantity, 10)


if __name__ == "__main__":
    unittest.main()
