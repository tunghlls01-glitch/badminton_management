from datetime import datetime
import test_profile
from app.routers import admin_users
from app.models.user import User, UserRole
from app.models.booking import Booking, BookingStatus
from app.models.booking_slot import BookingSlot
from app.models.court import Court
from app.models.payment import Payment, PaymentStatus


class AdminUsersTest(test_profile.ProfileAPITest):
    def setUp(self):
        super().setUp()
        self.app.include_router(admin_users.router, prefix="/api")
        with self.sessions() as db:
            db.get(User, 1).role = UserRole.ADMIN
            db.commit()

    def staff(self):
        status, data = self.request("POST", "/api/admin/staff", {
            "full_name": "Staff Name", "email": "staff@example.com",
            "phone": "0901234563", "password": "staff-pass"})
        self.assertEqual(status, 201, data)
        self.assertEqual(data["role"], "STAFF")
        self.assertNotIn("password", data)
        self.assertNotIn("hashed_password", data)
        return data["id"]

    def test_admin_authorization_and_lock(self):
        for path in ["/api/admin/staff", "/api/admin/staff/1",
                     "/api/admin/customers", "/api/admin/customers/2",
                     "/api/admin/customers/2/bookings"]:
            self.assertEqual(self.request("GET", path, user_id=None)[0], 401)
            self.assertEqual(self.request("GET", path, user_id=2)[0], 403)
        staff_id = self.staff()
        self.assertEqual(self.request("GET", "/api/admin/staff", user_id=staff_id)[0], 403)
        login = {"account": "staff@example.com", "password": "staff-pass"}
        self.assertEqual(self.request("POST", "/auth/login", login)[0], 200)
        for state, expected in [("LOCKED", 403), ("ACTIVE", 200)]:
            self.assertEqual(self.request("PATCH", f"/api/admin/staff/{staff_id}/status", {"status": state})[0], 200)
            self.assertEqual(self.request("POST", "/auth/login", login)[0], expected)
            self.assertEqual(self.request("GET", "/auth/me", user_id=staff_id)[0], expected)
        self.assertEqual(self.request("PATCH", "/api/admin/staff/1/status", {"status": "LOCKED"})[0], 404)
        self.assertEqual(self.request("PUT", "/api/admin/staff/1", {"full_name": "Bad", "email": "bad@example.com", "phone": "0901234564"})[0], 404)

    def test_staff_validation_and_search(self):
        staff_id = self.staff()
        payload = {"full_name": "Changed", "phone": "0901234564", "email": "changed@example.com"}
        self.assertEqual(self.request("PUT", f"/api/admin/staff/{staff_id}", payload)[0], 200)
        for invalid in [{"role": "ADMIN"}, {"full_name": " "}, {"phone": "123"}, {"email": "bad"}]:
            self.assertEqual(self.request("PUT", f"/api/admin/staff/{staff_id}", {**payload, **invalid})[0], 422)
        self.assertEqual(self.request("PUT", f"/api/admin/staff/{staff_id}", {**payload, "email": "user2@example.com"})[0], 409)
        self.assertEqual(self.request("GET", "/api/admin/staff?q=changed")[1]["total"], 1)
        self.assertEqual(self.request("GET", "/api/admin/staff?q=%25")[1]["total"], 0)
        for query in ["page=0", "limit=101", "status=BAD"]:
            self.assertEqual(self.request("GET", "/api/admin/staff?" + query)[0], 422)

    def test_customer_history_and_filters(self):
        with self.sessions() as db:
            db.add(Court(id=1, name="Court 1"))
            db.add_all([Booking(id=1, booking_code="BK1", user_id=2, total_price=100,
                                status=BookingStatus.Confirmed),
                        Booking(id=2, booking_code="BK2", user_id=1, total_price=200)])
            db.flush()
            db.add(BookingSlot(booking_id=1, court_id=1, start_at=datetime(2026,11,20,10),
                               end_at=datetime(2026,11,20,11), amount=100))
            db.add(Payment(booking_id=1, amount=100, payment_status=PaymentStatus.SUCCESS))
            db.commit()
        for query in ["q=User", "q=0901234562", "page=1&limit=1"]:
            data = self.request("GET", "/api/admin/customers?" + query)[1]
            self.assertEqual(data["total"], 1)
            self.assertEqual(data["items"][0]["total_bookings"], 1)
        self.assertEqual(self.request("GET", "/api/admin/customers?page=2&limit=1")[1]["items"], [])
        path = "/api/admin/customers/2/bookings"
        data = self.request("GET", path + "?date_from=2026-11-20&date_to=2026-11-20&status=Confirmed")[1]
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["items"][0]["booking_code"], "BK1")
        self.assertEqual(data["items"][0]["payments"][0]["payment_status"], "SUCCESS")
        self.assertEqual(data["items"][0]["slots"][0]["court_name"], "Court 1")
        self.assertEqual(self.request("GET", path + "?date_from=2026-11-21")[1]["items"], [])
        self.assertEqual(self.request("GET", path + "?status=Cancelled")[1]["total"], 0)
        self.assertEqual(self.request("GET", path + "?date_from=2026-11-21&date_to=2026-11-20")[0], 422)
        self.assertEqual(self.request("GET", "/api/admin/customers/999/bookings")[0], 404)

    def test_empty_history(self):
        self.assertEqual(self.request("GET", "/api/admin/customers/2/bookings")[1]["items"], [])
        self.assertEqual(self.request("GET", "/api/admin/customers/2")[1]["total_bookings"], 0)

    def test_public_registration_cannot_grant_admin(self):
        status, data = self.request("POST", "/auth/register", {
            "full_name": "Public", "email": "public@example.com", "phone": "0901234569",
            "password": "secret", "role": "ADMIN", "status": "LOCKED"}, user_id=None)
        self.assertEqual(status, 201)
        self.assertEqual(data["role"], "CUSTOMER")
        self.assertEqual(data["status"], "ACTIVE")

    def test_mutations_require_admin(self):
        payload = {"full_name": "Staff", "email": "staff@example.com",
                   "phone": "0901234563", "password": "secret"}
        for method, path, body in [
            ("POST", "/api/admin/staff", payload),
            ("PUT", "/api/admin/staff/1", {k: v for k, v in payload.items() if k != "password"}),
            ("PATCH", "/api/admin/staff/1/status", {"status": "LOCKED"}),
        ]:
            for actor, expected in [(None, 401), (2, 403)]:
                self.assertEqual(self.request(method, path, body, user_id=actor)[0], expected)
        self.assertEqual(self.request("POST", "/api/admin/staff", {**payload, "role": "ADMIN"})[0], 422)
        self.staff()
        self.assertEqual(self.request("POST", "/api/admin/staff", payload)[0], 409)
