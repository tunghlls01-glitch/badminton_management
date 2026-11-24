"""Unit tests cho module Hóa đơn & Chốt ca lễ tân (Invoice & Shift Closing API).
Chạy: python -m unittest discover -s tests -v (từ thư mục backend)
"""
import asyncio
import json
import os
import sys
import unittest
from urllib.parse import urlsplit

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from fastapi import FastAPI
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token, get_password_hash
from app.db.session import Base, get_db
from app.models.booking import Booking, BookingChannel, BookingStatus
from app.models.booking_slot import BookingSlot, BookingSlotStatus
from app.models.court import Court, CourtStatus
from app.models.invoice import Invoice
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.models.service import Service
from app.models.service_order import ServiceOrder, ServiceOrderStatus
from app.models.service_order_item import ServiceOrderItem
from app.models.user import User, UserRole, UserStatus
from app.routers import auth, invoice


class InvoiceAPITest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(bind=self.engine)

        with self.sessions() as db:
            # User 1: ADMIN
            admin_user = User(
                id=1,
                full_name="Quản lý Nguyễn",
                email="admin@badminton.com",
                phone="0900000001",
                hashed_password=get_password_hash("password123"),
                role=UserRole.ADMIN,
                status=UserStatus.ACTIVE,
            )
            # User 2: CUSTOMER
            customer_user = User(
                id=2,
                full_name="Khách hàng Minh",
                email="minh@gmail.com",
                phone="0901234567",
                hashed_password=get_password_hash("password123"),
                role=UserRole.CUSTOMER,
                status=UserStatus.ACTIVE,
            )
            # User 3: STAFF 1 (Lễ tân Lan)
            staff1 = User(
                id=3,
                full_name="Lễ tân Lan",
                email="lan@badminton.com",
                phone="0911111111",
                hashed_password=get_password_hash("password123"),
                role=UserRole.STAFF,
                status=UserStatus.ACTIVE,
            )
            # User 4: STAFF 2 (Lễ tân Hùng)
            staff2 = User(
                id=4,
                full_name="Lễ tân Hùng",
                email="hung@badminton.com",
                phone="0922222222",
                hashed_password=get_password_hash("password123"),
                role=UserRole.STAFF,
                status=UserStatus.ACTIVE,
            )
            db.add_all([admin_user, customer_user, staff1, staff2])

            # Tạo Sân
            c1 = Court(id=1, name="Sân số 1", status=CourtStatus.Active)
            c2 = Court(id=2, name="Sân số 2", status=CourtStatus.Active)
            db.add_all([c1, c2])

            # Tạo Dịch vụ
            svc1 = Service(id=1, name="Nước Pocari", category="NƯỚC", unit="Chai", price=Decimal("20000"), stock_quantity=100)
            svc2 = Service(id=2, name="Ống cầu Yonex", category="ỐNG CẦU", unit="Ống", price=Decimal("220000"), stock_quantity=50)
            db.add_all([svc1, svc2])

            # Booking 1: Ca sáng ngày 2026-11-20 (Lễ tân Lan - ID 3 xử lý), thanh toán TIỀN MẶT
            b1 = Booking(
                id=1,
                booking_code="BK261120-0001",
                user_id=2,
                created_by=3,
                booking_channel=BookingChannel.Counter,
                total_price=Decimal("150000"),
                status=BookingStatus.Completed,
                created_at=datetime(2026, 11, 20, 8, 30),
            )
            db.add(b1)
            db.flush()

            bs1 = BookingSlot(
                booking_id=1,
                court_id=1,
                start_at=datetime(2026, 11, 20, 9, 0),
                end_at=datetime(2026, 11, 20, 10, 0),
                duration_minutes=60,
                price_per_hour=Decimal("150000"),
                amount=Decimal("150000"),
            )
            db.add(bs1)

            # Đơn dịch vụ kèm Booking 1
            so1 = ServiceOrder(
                id=1,
                booking_id=1,
                total_price=Decimal("40000"),
                status=ServiceOrderStatus.COMPLETED,
                created_at=datetime(2026, 11, 20, 9, 15),
            )
            db.add(so1)
            db.flush()

            soi1 = ServiceOrderItem(
                service_order_id=1,
                service_id=1,
                quantity=2,
                unit_price=Decimal("20000"),
                amount=Decimal("40000"),
            )
            db.add(soi1)

            # Hóa đơn 1 (Tiền sân 150k + dịch vụ 40k = 190k, CASH, do Lan lập)
            inv1 = Invoice(
                id=1,
                invoice_code="INV-20261120-0001",
                booking_id=1,
                customer_id=2,
                staff_id=3,
                total_court_amount=Decimal("150000"),
                total_service_amount=Decimal("40000"),
                discount_amount=Decimal("0"),
                grand_total=Decimal("190000"),
                created_at=datetime(2026, 11, 20, 10, 0),
            )
            db.add(inv1)
            db.flush()

            pm1 = Payment(
                id=1,
                booking_id=1,
                invoice_id=1,
                amount=Decimal("190000"),
                payment_method=PaymentMethod.CASH,
                payment_status=PaymentStatus.SUCCESS,
                created_at=datetime(2026, 11, 20, 10, 0),
            )
            db.add(pm1)

            # Booking 2: Ca sáng ngày 2026-11-20 (Lễ tân Lan - ID 3 xử lý), thanh toán CHUYỂN KHOẢN
            b2 = Booking(
                id=2,
                booking_code="BK261120-0002",
                user_id=2,
                created_by=3,
                booking_channel=BookingChannel.Counter,
                total_price=Decimal("200000"),
                status=BookingStatus.Completed,
                created_at=datetime(2026, 11, 20, 10, 30),
            )
            db.add(b2)
            db.flush()

            bs2 = BookingSlot(
                booking_id=2,
                court_id=2,
                start_at=datetime(2026, 11, 20, 11, 0),
                end_at=datetime(2026, 11, 20, 12, 0),
                duration_minutes=60,
                price_per_hour=Decimal("200000"),
                amount=Decimal("200000"),
            )
            db.add(bs2)

            inv2 = Invoice(
                id=2,
                invoice_code="INV-20261120-0002",
                booking_id=2,
                customer_id=2,
                staff_id=3,
                total_court_amount=Decimal("200000"),
                total_service_amount=Decimal("0"),
                discount_amount=Decimal("20000"),
                discount_reason="Khuyến mãi trưa",
                grand_total=Decimal("180000"),
                created_at=datetime(2026, 11, 20, 12, 0),
            )
            db.add(inv2)
            db.flush()

            pm2 = Payment(
                id=2,
                booking_id=2,
                invoice_id=2,
                amount=Decimal("180000"),
                payment_method=PaymentMethod.BANK_TRANSFER,
                payment_status=PaymentStatus.SUCCESS,
                transaction_code="TXMB9999",
                created_at=datetime(2026, 11, 20, 12, 0),
            )
            db.add(pm2)

            # Booking 3: Ca chiều ngày 2026-11-20 (Lễ tân Hùng - ID 4 xử lý), thanh toán TIỀN MẶT
            b3 = Booking(
                id=3,
                booking_code="BK261120-0003",
                user_id=2,
                created_by=4,
                booking_channel=BookingChannel.Counter,
                total_price=Decimal("300000"),
                status=BookingStatus.Completed,
                created_at=datetime(2026, 11, 20, 15, 0),
            )
            db.add(b3)
            db.flush()

            inv3 = Invoice(
                id=3,
                invoice_code="INV-20261120-0003",
                booking_id=3,
                customer_id=2,
                staff_id=4,
                total_court_amount=Decimal("300000"),
                total_service_amount=Decimal("0"),
                discount_amount=Decimal("0"),
                grand_total=Decimal("300000"),
                created_at=datetime(2026, 11, 20, 16, 0),
            )
            db.add(inv3)
            db.flush()

            pm3 = Payment(
                id=3,
                booking_id=3,
                invoice_id=3,
                amount=Decimal("300000"),
                payment_method=PaymentMethod.CASH,
                payment_status=PaymentStatus.SUCCESS,
                created_at=datetime(2026, 11, 20, 16, 0),
            )
            db.add(pm3)

            # Booking 4: Ngày hôm trước 2026-11-19 (Lễ tân Lan), TIỀN MẶT
            b4 = Booking(
                id=4,
                booking_code="BK261119-0001",
                user_id=2,
                created_by=3,
                booking_channel=BookingChannel.Counter,
                total_price=Decimal("100000"),
                status=BookingStatus.Completed,
                created_at=datetime(2026, 11, 19, 14, 0),
            )
            db.add(b4)
            db.flush()

            inv4 = Invoice(
                id=4,
                invoice_code="INV-20261119-0001",
                booking_id=4,
                customer_id=2,
                staff_id=3,
                total_court_amount=Decimal("100000"),
                total_service_amount=Decimal("0"),
                discount_amount=Decimal("0"),
                grand_total=Decimal("100000"),
                created_at=datetime(2026, 11, 19, 15, 0),
            )
            db.add(inv4)
            db.flush()

            pm4 = Payment(
                id=4,
                booking_id=4,
                invoice_id=4,
                amount=Decimal("100000"),
                payment_method=PaymentMethod.CASH,
                payment_status=PaymentStatus.SUCCESS,
                created_at=datetime(2026, 11, 19, 15, 0),
            )
            db.add(pm4)

            db.commit()

        self.app = FastAPI()
        self.app.include_router(auth.router)
        self.app.include_router(invoice.router, prefix="/api")

        def override_db():
            with self.sessions() as db:
                yield db

        self.app.dependency_overrides[get_db] = override_db

    def tearDown(self):
        self.engine.dispose()

    def request(self, method, path, payload=None, user_id=1):
        url = urlsplit(path)

        async def run():
            body = json.dumps(payload).encode() if payload is not None else b""
            headers = [(b"content-type", b"application/json")]
            if user_id is not None:
                token = create_access_token({"sub": str(user_id)})
                headers.append((b"authorization", f"Bearer {token}".encode()))
            scope = {
                "type": "http",
                "method": method,
                "scheme": "http",
                "path": url.path,
                "raw_path": url.path.encode(),
                "query_string": url.query.encode(),
                "headers": headers,
            }
            received = {}

            async def receive():
                return {"type": "http.request", "body": body, "more_body": False}

            async def send(message):
                if message["type"] == "http.response.start":
                    received["status"] = message["status"]
                elif message["type"] == "http.response.body":
                    received["body"] = message.get("body", b"")

            await self.app(scope, receive, send)
            raw = received.get("body", b"")
            try:
                data = json.loads(raw)
            except Exception:
                data = raw.decode("utf-8", "ignore")
            return received.get("status", 500), data

        return asyncio.run(run())

    def test_permissions(self):
        """ADMIN và STAFF được phép truy cập; CUSTOMER và chưa đăng nhập bị chặn."""
        # 1. ADMIN (user_id=1) -> 200
        status, data = self.request("GET", "/api/invoices", user_id=1)
        self.assertEqual(status, 200)

        # 2. STAFF (user_id=3) -> 200
        status, data = self.request("GET", "/api/invoices", user_id=3)
        self.assertEqual(status, 200)

        # 3. CUSTOMER (user_id=2) -> 403 Forbidden
        status, data = self.request("GET", "/api/invoices", user_id=2)
        self.assertEqual(status, 403)

        # 4. Chưa đăng nhập -> 401 Unauthorized
        status, data = self.request("GET", "/api/invoices", user_id=None)
        self.assertEqual(status, 401)

    def test_list_invoices_filters(self):
        """Kiểm tra lọc danh sách hóa đơn theo ngày, lễ tân, PTTT, từ khóa."""
        # Lấy tất cả hóa đơn
        status, data = self.request("GET", "/api/invoices", user_id=1)
        self.assertEqual(status, 200)
        self.assertEqual(data["total"], 4)
        self.assertEqual(data["summary"]["total_revenue"], 190000 + 180000 + 300000 + 100000)

        # 1. Lọc theo ngày 2026-11-20
        status, data = self.request("GET", "/api/invoices?date=2026-11-20", user_id=1)
        self.assertEqual(status, 200)
        self.assertEqual(data["total"], 3)
        codes = [item["invoice_code"] for item in data["items"]]
        self.assertIn("INV-20261120-0001", codes)
        self.assertIn("INV-20261120-0002", codes)
        self.assertIn("INV-20261120-0003", codes)
        self.assertNotIn("INV-20261119-0001", codes)

        # 2. Lọc theo lễ tân Lan (staff_id=3) ngày 2026-11-20
        status, data = self.request("GET", "/api/invoices?date=2026-11-20&staff_id=3", user_id=1)
        self.assertEqual(status, 200)
        self.assertEqual(data["total"], 2)
        for item in data["items"]:
            self.assertEqual(item["staff_id"], 3)
            self.assertEqual(item["staff_name"], "Lễ tân Lan")

        # 3. Lọc theo lễ tân Hùng (staff_id=4)
        status, data = self.request("GET", "/api/invoices?staff_id=4", user_id=1)
        self.assertEqual(status, 200)
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["items"][0]["invoice_code"], "INV-20261120-0003")

        # 4. Lọc theo phương thức thanh toán BANK_TRANSFER
        status, data = self.request("GET", "/api/invoices?payment_method=BANK_TRANSFER", user_id=1)
        self.assertEqual(status, 200)
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["items"][0]["payment_method"], "BANK_TRANSFER")
        self.assertEqual(data["items"][0]["grand_total"], 180000)

        # 5. Tìm kiếm từ khóa q
        status, data = self.request("GET", "/api/invoices?q=BK261120-0002", user_id=1)
        self.assertEqual(status, 200)
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["items"][0]["invoice_code"], "INV-20261120-0002")

    def test_receptionists_list(self):
        """API lấy danh sách lễ tân trả về danh sách STAFF và ADMIN."""
        status, data = self.request("GET", "/api/invoices/receptionists", user_id=1)
        self.assertEqual(status, 200)
        self.assertIsInstance(data, list)
        staff_ids = [u["id"] for u in data]
        self.assertIn(1, staff_ids)  # Admin
        self.assertIn(3, staff_ids)  # Lễ tân Lan
        self.assertIn(4, staff_ids)  # Lễ tân Hùng
        self.assertNotIn(2, staff_ids)  # Khách hàng không nằm trong danh sách lễ tân

    def test_invoice_detail_and_reprint(self):
        """Kiểm tra chi tiết hóa đơn (xem/in lại)."""
        # Xem hóa đơn ID 1
        status, data = self.request("GET", "/api/invoices/1", user_id=1)
        self.assertEqual(status, 200)
        self.assertEqual(data["invoice_code"], "INV-20261120-0001")
        self.assertEqual(data["customer_name"], "Khách hàng Minh")
        self.assertEqual(data["staff_name"], "Lễ tân Lan")
        self.assertEqual(data["total_court_amount"], 150000)
        self.assertEqual(data["total_service_amount"], 40000)
        self.assertEqual(data["grand_total"], 190000)
        self.assertEqual(data["payment_method"], "CASH")
        self.assertEqual(data["is_reprint"], False)
        # Kiểm tra chi tiết sân và dịch vụ
        self.assertEqual(len(data["court_slots"]), 1)
        self.assertEqual(data["court_slots"][0]["court_name"], "Sân số 1")
        self.assertEqual(len(data["services"]), 1)
        self.assertEqual(data["services"][0]["service_name"], "Nước Pocari")
        self.assertEqual(data["services"][0]["quantity"], 2)

        # Xem hóa đơn với cờ reprint=true
        status, data = self.request("GET", "/api/invoices/INV-20261120-0001?reprint=true", user_id=1)
        self.assertEqual(status, 200)
        self.assertEqual(data["is_reprint"], True)

        # Xem hóa đơn không tồn tại -> 404
        status, data = self.request("GET", "/api/invoices/99999", user_id=1)
        self.assertEqual(status, 404)

    def test_shift_closing_summary(self):
        """Kiểm tra chức năng Chốt ca: tính chính xác tổng tiền mặt / chuyển khoản của lễ tân trong ca."""
        # 1. Chốt ca ngày 2026-11-20 cho Lễ tân Lan (staff_id=3) ca sáng MORNING (06:00 - 14:00)
        # Trong ca này Lan có:
        # - Hóa đơn 1 (10:00): 190.000đ TIỀN MẶT
        # - Hóa đơn 2 (12:00): 180.000đ CHUYỂN KHOẢN
        # Tổng tiền mặt = 190.000đ, Tổng chuyển khoản = 180.000đ, Tổng doanh thu = 370.000đ
        status, data = self.request(
            "GET",
            "/api/invoices/shift/summary?staff_id=3&date=2026-11-20&shift_type=MORNING",
            user_id=1,
        )
        self.assertEqual(status, 200)
        self.assertEqual(data["staff_id"], 3)
        self.assertEqual(data["staff_name"], "Lễ tân Lan")
        self.assertEqual(data["total_invoices"], 2)
        self.assertEqual(data["total_cash"], 190000.0)
        self.assertEqual(data["total_bank_transfer"], 180000.0)
        self.assertEqual(data["total_revenue"], 370000.0)
        self.assertEqual(len(data["invoices"]), 2)

        # 2. Chốt ca ngày 2026-11-20 cho Lễ tân Hùng (staff_id=4) ca chiều AFTERNOON (14:00 - 22:00)
        # Trong ca này Hùng có:
        # - Hóa đơn 3 (16:00): 300.000đ TIỀN MẶT
        status, data = self.request(
            "GET",
            "/api/invoices/shift/summary?staff_id=4&date=2026-11-20&shift_type=AFTERNOON",
            user_id=1,
        )
        self.assertEqual(status, 200)
        self.assertEqual(data["staff_id"], 4)
        self.assertEqual(data["staff_name"], "Lễ tân Hùng")
        self.assertEqual(data["total_invoices"], 1)
        self.assertEqual(data["total_cash"], 300000.0)
        self.assertEqual(data["total_bank_transfer"], 0.0)
        self.assertEqual(data["total_revenue"], 300000.0)

        # 3. Lễ tân Lan kiểm tra ca chiều của mình (không có hóa đơn nào -> 0đ)
        status, data = self.request(
            "GET",
            "/api/invoices/shift/summary?staff_id=3&date=2026-11-20&shift_type=AFTERNOON",
            user_id=3,
        )
        self.assertEqual(status, 200)
        self.assertEqual(data["total_invoices"], 0)
        self.assertEqual(data["total_cash"], 0.0)
        self.assertEqual(data["total_bank_transfer"], 0.0)
        self.assertEqual(data["total_revenue"], 0.0)

    def test_confirm_shift_closing(self):
        """Test POST /api/invoices/shift/close: xác nhận chốt ca đối soát két tiền mặt."""
        payload = {
            "staff_id": 3,
            "date": "2026-11-20",
            "shift_type": "MORNING",
            "actual_cash": 190000.0,
            "note": "Đã kiểm đếm đủ tiền mặt, bàn giao quỹ ca sáng.",
        }
        status, data = self.request(
            "POST",
            "/api/invoices/shift/close",
            payload=payload,
            user_id=3,
        )
        self.assertEqual(status, 200)
        self.assertTrue(data["success"])
        self.assertEqual(data["summary"]["staff_id"], 3)
        self.assertEqual(data["summary"]["total_cash"], 190000.0)
        self.assertEqual(data["actual_cash"], 190000.0)
        self.assertEqual(data["difference"], 0.0)
        self.assertIn("Đã kiểm đếm đủ tiền mặt", data["note"])

