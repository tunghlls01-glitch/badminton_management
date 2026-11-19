"""Unit tests cho module Báo cáo doanh thu & Thống kê (Analytics API).
Chạy: python -m unittest discover -s tests -v (từ thư mục backend)
"""
import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from datetime import date, datetime, time, timedelta
from decimal import Decimal
import test_profile

from app.models.booking import Booking, BookingChannel, BookingStatus
from app.models.booking_slot import BookingSlot, BookingSlotStatus
from app.models.court import Court, CourtStatus
from app.models.invoice import Invoice
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.models.service import Service
from app.models.service_order import ServiceOrder, ServiceOrderStatus
from app.models.service_order_item import ServiceOrderItem
from app.models.user import User, UserRole
from app.routers import analytics


class AnalyticsAPITest(test_profile.ProfileAPITest):
    def setUp(self):
        super().setUp()
        self.app.include_router(analytics.router, prefix="/api")

        with self.sessions() as db:
            # User 1 là ADMIN, User 2 là CUSTOMER
            admin_user = db.get(User, 1)
            admin_user.role = UserRole.ADMIN

            # Tạo sân
            court1 = Court(id=1, name="Sân số 1", status=CourtStatus.Active)
            court2 = Court(id=2, name="Sân VIP 2", status=CourtStatus.Active)
            db.add_all([court1, court2])

            # Tạo dịch vụ
            svc1 = Service(id=1, name="Nước suối", category="NƯỚC", unit="Chai", price=Decimal("10000"), stock_quantity=100)
            svc2 = Service(id=2, name="Ống cầu", category="ỐNG CẦU", unit="Ống", price=Decimal("200000"), stock_quantity=50)
            db.add_all([svc1, svc2])

            # Tạo Booking 1 (Completed, có invoice và service)
            b1 = Booking(
                id=1,
                booking_code="BK261101-0001",
                user_id=2,
                booking_channel=BookingChannel.Online,
                total_price=Decimal("100000"),
                status=BookingStatus.Completed,
                created_at=datetime(2026, 11, 1, 10, 0),
            )
            db.add(b1)
            db.flush()

            # Slot cho Booking 1
            bs1 = BookingSlot(
                booking_id=b1.id,
                court_id=1,
                start_at=datetime(2026, 11, 1, 17, 0),
                end_at=datetime(2026, 11, 1, 18, 0),
                duration_minutes=60,
                price_per_hour=Decimal("100000"),
                amount=Decimal("100000"),
                status=BookingSlotStatus.Active,
            )
            db.add(bs1)

            # Service Order cho Booking 1
            so1 = ServiceOrder(
                id=1,
                booking_id=b1.id,
                total_price=Decimal("20000"),
                status=ServiceOrderStatus.COMPLETED,
                created_at=datetime(2026, 11, 1, 17, 10),
            )
            db.add(so1)
            db.flush()

            soi1 = ServiceOrderItem(
                service_order_id=so1.id,
                service_id=1,
                quantity=2,
                unit_price=Decimal("10000"),
                amount=Decimal("20000"),
            )
            db.add(soi1)

            # Invoice cho Booking 1
            inv1 = Invoice(
                invoice_code="INV-20261101-0001",
                booking_id=b1.id,
                customer_id=2,
                total_court_amount=Decimal("100000"),
                total_service_amount=Decimal("20000"),
                discount_amount=Decimal("10000"),
                grand_total=Decimal("110000"),
                created_at=datetime(2026, 11, 1, 18, 5),
            )
            db.add(inv1)

            # Booking 2 (Cancelled)
            b2 = Booking(
                id=2,
                booking_code="BK261102-0002",
                user_id=2,
                booking_channel=BookingChannel.Counter,
                total_price=Decimal("80000"),
                status=BookingStatus.Cancelled,
                note="Khách bận đột xuất",
                created_at=datetime(2026, 11, 2, 8, 0),
            )
            db.add(b2)
            db.flush()

            bs2 = BookingSlot(
                booking_id=b2.id,
                court_id=2,
                start_at=datetime(2026, 11, 2, 9, 0),
                end_at=datetime(2026, 11, 2, 10, 0),
                duration_minutes=60,
                price_per_hour=Decimal("80000"),
                amount=Decimal("80000"),
                status=BookingSlotStatus.Cancelled,
            )
            db.add(bs2)

            # Booking 3 (NO_SHOW)
            b3 = Booking(
                id=3,
                booking_code="BK261103-0003",
                user_id=2,
                booking_channel=BookingChannel.Counter,
                total_price=Decimal("120000"),
                status=BookingStatus.NO_SHOW,
                note="Khách không đến",
                created_at=datetime(2026, 11, 3, 14, 0),
            )
            db.add(b3)
            db.flush()

            bs3 = BookingSlot(
                booking_id=b3.id,
                court_id=1,
                start_at=datetime(2026, 11, 3, 18, 0),
                end_at=datetime(2026, 11, 3, 19, 0),
                duration_minutes=60,
                price_per_hour=Decimal("120000"),
                amount=Decimal("120000"),
                status=BookingSlotStatus.Active,
            )
            db.add(bs3)

            # Retail Service Order (Khách vãng lai mua hàng không gắn booking)
            so_retail = ServiceOrder(
                id=2,
                booking_id=None,
                total_price=Decimal("200000"),
                status=ServiceOrderStatus.COMPLETED,
                created_at=datetime(2026, 11, 1, 12, 0),
            )
            db.add(so_retail)
            db.flush()

            soi_retail = ServiceOrderItem(
                service_order_id=so_retail.id,
                service_id=2,
                quantity=1,
                unit_price=Decimal("200000"),
                amount=Decimal("200000"),
            )
            db.add(soi_retail)

            db.commit()

    def test_analytics_permissions(self):
        # 1. Chưa đăng nhập -> 401
        status, _ = self.request("GET", "/api/analytics/overview", user_id=None)
        self.assertEqual(status, 401)

        # 2. Đăng nhập quyền Customer (user_id=2) -> 403 Forbidden
        status, _ = self.request("GET", "/api/analytics/overview", user_id=2)
        self.assertEqual(status, 403)

        # 3. Đăng nhập quyền Admin (user_id=1) -> 200 OK
        status, data = self.request("GET", "/api/analytics/overview?from_date=2026-11-01&to_date=2026-11-05", user_id=1)
        self.assertEqual(status, 200)
        self.assertIn("revenue", data)
        self.assertIn("occupancy", data)
        self.assertIn("cancellations", data)
        self.assertIn("top_services", data)

    def test_revenue_report(self):
        status, data = self.request("GET", "/api/analytics/revenue?from_date=2026-11-01&to_date=2026-11-05&group_by=day", user_id=1)
        self.assertEqual(status, 200)

        summary = data["summary"]
        self.assertEqual(summary["court_revenue"], 100000.0)
        # Service revenue = 20,000 (từ invoice) + 200,000 (từ bán lẻ) = 220,000
        self.assertEqual(summary["service_revenue"], 220000.0)
        self.assertEqual(summary["total_discount"], 10000.0)
        # Net revenue = 100,000 + 220,000 - 10,000 = 310,000
        self.assertEqual(summary["total_revenue"], 310000.0)
        self.assertEqual(summary["total_invoices"], 1)

        # Kiểm tra timeline có đầy đủ các ngày trong khoảng
        timeline = data["timeline"]
        self.assertEqual(len(timeline), 5)
        day1 = timeline[0]
        self.assertEqual(day1["period"], "2026-11-01")
        self.assertEqual(day1["court_revenue"], 100000.0)
        self.assertEqual(day1["service_revenue"], 220000.0)

    def test_occupancy_report(self):
        status, data = self.request("GET", "/api/analytics/occupancy?from_date=2026-11-01&to_date=2026-11-05", user_id=1)
        self.assertEqual(status, 200)

        self.assertEqual(data["total_courts"], 2)
        self.assertEqual(data["total_days"], 5)
        # 2 sân * 16 ca/ngày * 5 ngày = 160 ca khả dụng
        self.assertEqual(data["total_available_slots"], 160)
        # 2 slot đã được đặt (bs1 và bs3; bs2 bị hủy nên không tính)
        self.assertEqual(data["total_booked_slots"], 2)

        # Kiểm tra theo sân
        courts = data["courts"]
        self.assertEqual(len(courts), 2)
        court1 = next(c for c in courts if c["court_id"] == 1)
        self.assertEqual(court1["booked_slots"], 2)

        # Kiểm tra theo khung giờ
        time_slots = data["time_slots"]
        self.assertEqual(len(time_slots), 16)
        slot_17 = next(s for s in time_slots if s["start_hour"] == 17)
        self.assertEqual(slot_17["booked_slots"], 1)
        slot_18 = next(s for s in time_slots if s["start_hour"] == 18)
        self.assertEqual(slot_18["booked_slots"], 1)

    def test_cancellations_report(self):
        status, data = self.request("GET", "/api/analytics/cancellations?from_date=2026-11-01&to_date=2026-11-05", user_id=1)
        self.assertEqual(status, 200)

        self.assertEqual(data["total_bookings"], 3)
        self.assertEqual(data["completed_count"], 1)
        self.assertEqual(data["cancelled_count"], 1)
        self.assertEqual(data["no_show_count"], 1)
        self.assertEqual(data["lost_revenue"], 200000.0)  # 80k + 120k

        records = data["recent_records"]
        self.assertEqual(len(records), 2)
        codes = [r["booking_code"] for r in records]
        self.assertIn("BK261102-0002", codes)
        self.assertIn("BK261103-0003", codes)

    def test_top_services_report(self):
        status, data = self.request("GET", "/api/analytics/top-services?from_date=2026-11-01&to_date=2026-11-05&limit=10", user_id=1)
        self.assertEqual(status, 200)

        services = data["services"]
        self.assertEqual(len(services), 2)
        # Nước suối bán 2 chai, Ống cầu bán 1 ống
        self.assertEqual(services[0]["service_name"], "Nước suối")
        self.assertEqual(services[0]["quantity_sold"], 2)
        self.assertEqual(services[0]["total_revenue"], 20000.0)

        self.assertEqual(services[1]["service_name"], "Ống cầu")
        self.assertEqual(services[1]["quantity_sold"], 1)
        self.assertEqual(services[1]["total_revenue"], 200000.0)


if __name__ == "__main__":
    import unittest
    unittest.main()
