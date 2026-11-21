"""HTTP integration checks with direct verification of disposable MySQL rows."""
from datetime import datetime, timedelta
from urllib.parse import urlencode

from sqlalchemy import select, func

from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.session import SessionLocal
from app.models.booking import Booking, BookingStatus
from app.models.booking_slot import BookingSlot
from app.models.court import Court
from app.models.payment import Payment, PaymentStatus
from app.models.user import User, UserRole, UserStatus
from run import NOW

PASSWORD = "Qa-fixture-53!"
ME = "/api/profile"
STAFF = "/api/admin/staff"
CUSTOMERS = "/api/admin/customers"


def run_api(request):
    records = []

    def check(case, module, steps, expected, test, bug=""):
        status, actual = "Pass", expected
        try:
            result = test()
            if result:
                actual = result
        except AssertionError as exc:
            status, actual = "Fail", str(exc) or "Giá trị phản hồi hoặc trạng thái MySQL không khớp."
        except (KeyError, TypeError, AttributeError, IndexError):
            status, actual = "Fail", "Thiếu dữ liệu cần thiết trong phản hồi hoặc MySQL."
        records.append(dict(id=case, module=module, layer="API", steps=steps, expected=expected,
                            status=status, actual=actual, bug=bug, time=NOW()))

    def expect(method, path, code, data=None, token=None):
        status, body = request(method, path, data, token)
        assert status == code, f"HTTP {status}, mong đợi {code}."
        assert isinstance(body, dict)
        if code >= 400:
            assert "detail" in body and "access_token" not in body
        assert not ({"password", "hashed_password"} & body.keys())
        return body

    def login(account, password=PASSWORD, code=200):
        body = expect("POST", "/auth/login", code, dict(account=account, password=password))
        if code == 200:
            assert body["token_type"] == "bearer" and body["access_token"]
            return body["access_token"]
        return body["detail"]

    def snapshot(email):
        with SessionLocal() as db:
            row = db.scalar(select(User).where(User.email == email))
            if row:
                return (row.id, row.full_name, row.phone, row.role, row.status, row.hashed_password, row.avatar)

    def count():
        with SessionLocal() as db:
            return db.scalar(select(func.count()).select_from(User))

    def list_items(path, token, total=None):
        body = expect("GET", path, 200, token=token)
        assert isinstance(body["items"], list)
        if total is not None:
            assert body["total"] == total, f"Tổng kết quả {body['total']}, mong đợi {total}."
        assert all(not ({"password", "hashed_password"} & item.keys()) for item in body["items"])
        return body["items"]

    with SessionLocal() as db:
        h = get_password_hash(PASSWORD)
        db.add(User(full_name="QA Admin", email="admin53@example.com", phone="0905300001",
                    hashed_password=h, role=UserRole.ADMIN, status=UserStatus.ACTIVE))
        db.commit()
    admin = login("admin53@example.com")
    def empty_customers():
        assert list_items(CUSTOMERS, admin, 0) == []
    check("CUS-08", "Khách hàng", "Admin gọi GET danh sách trước khi tạo khách hàng giả.",
          "HTTP 200; total bằng 0 và items rỗng.", empty_customers)

    with SessionLocal() as db:
        db.add_all([
            User(full_name=name, email=email, phone=phone, hashed_password=h, role=role, status=state)
            for name, email, phone, role, state in [
                ("QA Nhân viên", "staff53@example.com", "0905300002", UserRole.STAFF, UserStatus.ACTIVE),
                ("QA Nguyễn Văn Ánh", "booking53@example.com", "0905300003", UserRole.CUSTOMER, UserStatus.ACTIVE),
                ("QA Không Có Lịch", "empty53@example.com", "0905300004", UserRole.CUSTOMER, UserStatus.ACTIVE),
                ("QA Đã Khóa", "locked53@example.com", "0905300005", UserRole.STAFF, UserStatus.LOCKED),
            ]
        ])
        db.commit()

    staff = login("staff53@example.com")
    customer = login("booking53@example.com")
    booked_id = snapshot("booking53@example.com")[0]
    empty_id = snapshot("empty53@example.com")[0]
    with SessionLocal() as db:
        court = Court(name="Sân QA 53")
        db.add(court)
        db.flush()
        for index, owner in enumerate((booked_id, booked_id, snapshot("admin53@example.com")[0]), 1):
            booking = Booking(booking_code=f"QA53-{index}", user_id=owner,
                              total_price=100000, status=BookingStatus.Confirmed)
            db.add(booking)
            db.flush()
            db.add(BookingSlot(booking_id=booking.id, court_id=court.id, amount=100000,
                               start_at=datetime(2026, 11, 20, 10), end_at=datetime(2026, 11, 20, 11)))
            db.add(Payment(booking_id=booking.id, amount=100000, payment_status=PaymentStatus.SUCCESS))
        db.commit()

    registration = dict(full_name="QA Đăng ký", email="register53@example.com",
                        phone="0905300010", password=PASSWORD)

    def register():
        before = count()
        data = expect("POST", "/auth/register", 201, registration)
        row = snapshot(registration["email"])
        assert count() == before + 1 and row[:5] == (
            data["id"], registration["full_name"], registration["phone"], "CUSTOMER", "ACTIVE")
        assert data["email"] == registration["email"] and data["role"] == "CUSTOMER" and data["status"] == "ACTIVE"
        assert row[5] != PASSWORD and verify_password(PASSWORD, row[5])
    check("REG-01", "Đăng ký", "POST /auth/register với họ tên tiếng Việt và dữ liệu hợp lệ, đối chiếu MySQL.",
          "HTTP 201; đúng hồ sơ; CUSTOMER/ACTIVE; bcrypt xác minh được và không lưu rõ.", register)

    def rejected_registration(changes, code, omit=None):
        payload = {**registration, "email": "invalid53@example.com", "phone": "0905300011", **changes}
        if omit:
            del payload[omit]
        before = count()
        result, body = request("POST", "/auth/register", payload)
        after = count()
        # Remove an unexpected insert to preserve independent fixtures.
        if after > before:
            with SessionLocal() as db:
                row = db.scalar(select(User).where(User.email == payload.get("email")))
                if row:
                    db.delete(row)
                    db.commit()
        assert result == code and isinstance(body.get("detail"), (str, list)) and after == before, (
            f"HTTP {result}; số bản ghi mới {after-before}; mong đợi HTTP {code}, không tạo tài khoản.")

    for suffix, scenario, changes, code, omit, bug in [
        ("02", "Thiếu họ tên", {}, 422, "full_name", ""),
        ("03", "Họ tên chỉ có khoảng trắng", {"full_name": "   "}, 422, None, "BUG-01"),
        ("04", "Email sai định dạng", {"email": "invalid"}, 422, None, ""),
        ("05", "Số điện thoại sai định dạng", {"phone": "123"}, 422, None, "BUG-01"),
        ("06", "Mật khẩu ngắn", {"password": "qa"}, 422, None, "BUG-01"),
        ("07", "Email trùng", {"email": registration["email"]}, 409, None, ""),
        ("08", "Số điện thoại trùng", {"phone": registration["phone"]}, 409, None, ""),
        ("09", "Số điện thoại sai kiểu JSON", {"phone": 123}, 422, None, ""),
        ("10", "Họ tên dài hơn 100 ký tự", {"full_name": "A"*101}, 422, None, "BUG-01"),
        ("11", "Gửi lại nguyên bộ dữ liệu đã đăng ký", registration, 409, None, ""),
        ("12", "Mật khẩu dài hơn 72 byte UTF-8", {"password": "á"*37}, 422, None, "BUG-01"),
        ("13", "Email hợp lệ nhưng vượt độ dài cột DB", {"email": "a"*60 + "@" + "b"*44 + ".com"}, 422, None, "BUG-01"),
    ]:
        check("REG-"+suffix, "Đăng ký", f"POST /auth/register · {scenario}",
              f"HTTP {code}; có phản hồi lỗi; không tạo tài khoản.",
              lambda: rejected_registration(changes, code, omit), bug)

    def customer_journey():
        token = login(registration["email"])
        profile = expect("GET", ME, 200, token=token)
        assert profile == dict(full_name=registration["full_name"], email=registration["email"],
                               phone=registration["phone"], avatar=None)
        payload = dict(full_name="QA Đã cập nhật", phone="0905300012")
        saved = expect("PUT", ME, 200, payload, token)
        assert saved == {**profile, **payload}
        persisted = snapshot(registration["email"])
        assert persisted[1:5] == (payload["full_name"], payload["phone"], "CUSTOMER", "ACTIVE")
        assert verify_password(PASSWORD, persisted[5])
        assert expect("GET", ME, 200, token=login(payload["phone"])) == saved
    check("PRO-01", "Hồ sơ", "Đăng ký REG-01 → đăng nhập → GET/PUT /api/profile → đăng nhập lại bằng SĐT mới → đọc lại.",
          "Thông tin đúng theo chủ phiên, lưu vào MySQL và giữ email, role, trạng thái, mật khẩu.", customer_journey)

    for suffix, scenario, payload, code in [
        ("02", "Thiếu tên", {"phone":"0905300099"}, 422),
        ("03", "Tên rỗng", {"full_name":" ", "phone":"0905300099"}, 422),
        ("04", "Điện thoại sai định dạng", {"full_name":"QA", "phone":"abc"}, 422),
        ("05", "Tên quá dài", {"full_name":"A"*101, "phone":"0905300099"}, 422),
        ("06", "Điện thoại trùng", {"full_name":"QA", "phone":"0905300004"}, 409),
        ("07", "Email chỉ đọc", {"full_name":"QA", "phone":"0905300099", "email":"other53@example.com"}, 422),
    ]:
        def rejected_profile():
            before = snapshot("booking53@example.com")
            other = snapshot("empty53@example.com")
            expect("PUT", ME, code, payload, customer)
            assert snapshot("booking53@example.com") == before and snapshot("empty53@example.com") == other
        check("PRO-"+suffix, "Hồ sơ", "PUT /api/profile · " + scenario, f"HTTP {code}; giữ dữ liệu MySQL.", rejected_profile)

    def change_password():
        payload = dict(old_password=PASSWORD, new_password="New-qa-fixture-53!", confirm_password="khác")
        before = snapshot("register53@example.com")
        token = login("register53@example.com")
        expect("POST", "/auth/change-password", 422, payload, token)
        assert snapshot("register53@example.com") == before
        expect("POST", "/auth/change-password", 400, {**payload, "old_password": "sai",
               "confirm_password": payload["new_password"]}, token)
        assert snapshot("register53@example.com") == before
        expect("POST", "/auth/change-password", 200, {**payload, "confirm_password": payload["new_password"]}, token)
        assert verify_password(payload["new_password"], snapshot("register53@example.com")[5])
        login("register53@example.com", payload["new_password"])
        login("register53@example.com", code=401)
    check("PRO-08", "Hồ sơ", "POST /auth/change-password với xác nhận sai, mật khẩu cũ sai và bộ hợp lệ.",
          "422/400 không đổi hash; 200 lưu hash mới; mật khẩu cũ không còn đăng nhập được.", change_password)

    def avatar_profile():
        image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII="
        fields = dict(full_name="QA Không Có Lịch", phone="0905300004")
        token = login("empty53@example.com")
        expect("PUT", ME, 422, {**fields, "avatar":"data:image/png;base64,YWJj"}, token)
        assert snapshot("empty53@example.com")[6] is None
        assert expect("PUT", ME, 200, {**fields, "avatar": image}, token)["avatar"] == image
        assert expect("PUT", ME, 200, fields, token)["avatar"] == image
        assert snapshot("empty53@example.com")[6] == image
    check("PRO-09", "Hồ sơ", "Lưu ảnh PNG hợp lệ và ảnh hỏng; lưu lại tên/SĐT mà không gửi ảnh.",
          "Ảnh hỏng bị từ chối 422; ảnh PNG hợp lệ được lưu và vẫn còn khi không gửi lại.", avatar_profile)

    def bearer_login():
        token = login("0905300003")
        body = expect("GET", "/auth/me", 200, token=token)
        assert body["id"] == booked_id and body["role"] == "CUSTOMER"
    check("LOG-01", "Đăng nhập", "POST /auth/login bằng SĐT; mang Bearer token sang GET /auth/me.",
          "HTTP 200; JWT bearer cho đúng tài khoản CUSTOMER; không lộ mật khẩu.", bearer_login)

    def wrong_credentials():
        assert login("booking53@example.com", "sai", 401) == login("nobody53@example.com", code=401)
    check("LOG-02", "Đăng nhập", "Đăng nhập với mật khẩu sai và tài khoản không tồn tại.",
          "HTTP 401; cùng thông báo; không trả token.", wrong_credentials)

    for i, payload, code in [(3, {}, 422), (4, {"account":"","password":""}, 401),
                             (5, {"account":123,"password":[]}, 422),
                             (6, {"account":"a"*300,"password":PASSWORD}, 401),
                             (7, {"account":"locked53@example.com","password":PASSWORD}, 403)]:
        check(f"LOG-{i:02}", "Đăng nhập", f"POST /auth/login · {['thiếu trường', 'hai trường rỗng', 'sai kiểu', 'định danh dài', 'tài khoản đã khóa'][i-3]}",
              f"HTTP {code}; có thông báo lỗi và không trả token.",
              lambda: expect("POST", "/auth/login", code, payload) and None)

    for i, token, description in [(1, None, "Không gửi Bearer"), (2, "qa-invalid", "Bearer sai định dạng"),
                                   (3, create_access_token({"sub": str(booked_id)}, timedelta(minutes=-2)), "Bearer test đã hết hạn")]:
        def denied_session():
            expect("GET", ME, 401, token=token)
            expect("PUT", ME, 401, {"full_name":"QA", "phone":"0905300098"}, token)
        check(f"RB-{i:02}", "Phân quyền", description + " khi GET và PUT /api/profile.",
              "HTTP 401 cho cả hai thao tác; lỗi có detail.", denied_session)

    for i, (role, token, code) in enumerate([("Khách vãng lai", None, 401), ("STAFF", staff, 403),
                                             ("CUSTOMER", customer, 403)], 4):
        def denied_admin():
            before = count()
            for path in [STAFF, CUSTOMERS, f"{CUSTOMERS}/{booked_id}", f"{CUSTOMERS}/{booked_id}/bookings"]:
                expect("GET", path, code, token=token)
            payload = dict(full_name="QA Denied Staff", email="denied53@example.com", phone="0905300097", password=PASSWORD)
            staff_before = snapshot("staff53@example.com")
            staff_path = f"{STAFF}/{staff_before[0]}"
            expect("POST", STAFF, code, payload, token)
            expect("PUT", staff_path, code, {k:v for k,v in payload.items() if k != "password"}, token)
            expect("PATCH", staff_path+"/status", code, {"status":"LOCKED"}, token)
            assert count() == before
            assert snapshot("staff53@example.com") == staff_before
        check(f"RB-{i:02}", "Phân quyền", f"{role} gọi trực tiếp các API quản lý nhân viên và khách hàng.",
              f"HTTP {code} cho danh sách, chi tiết, lịch sử, tạo, sửa và khóa nhân viên; MySQL không đổi.", denied_admin)

    staff_data = dict(full_name="QA Staff Created", email="newstaff53@example.com",
                      phone="0905300020", password=PASSWORD)

    def staff_lifecycle():
        body = expect("POST", STAFF, 201, staff_data, admin)
        path = f"{STAFF}/{body['id']}"
        assert body["role"] == "STAFF" and body["status"] == "ACTIVE"
        assert verify_password(PASSWORD, snapshot(staff_data["email"])[5])
        token = login(staff_data["email"])
        expect("GET", ME, 200, token=token)
        expect("GET", STAFF, 403, token=token)
        update = dict(full_name="QA Staff Updated", email=staff_data["email"], phone="0905300021")
        assert expect("PUT", path, 200, update, admin)["full_name"] == update["full_name"]
        for _ in range(2):
            assert expect("PATCH", path+"/status", 200, {"status":"LOCKED"}, admin)["status"] == "LOCKED"
        assert snapshot(staff_data["email"])[1:5] == (update["full_name"], update["phone"], "STAFF", "LOCKED")
        login(staff_data["email"], code=403)
        expect("GET", ME, 403, token=token)
        assert expect("PATCH", path+"/status", 200, {"status":"ACTIVE"}, admin)["status"] == "ACTIVE"
        login(staff_data["email"])
    check("STA-01", "Nhân viên", "Admin tạo → STAFF đăng nhập/kiểm tra quyền → Admin sửa, khóa hai lần → thử phiên mới/cũ → mở khóa.",
          "201/200 và MySQL đúng; 403 khi khóa; đăng nhập lại được sau mở khóa.", staff_lifecycle)

    for i, scenario, payload, code in [
        (2, "thiếu trường", {}, 422),
        (3, "SĐT sai định dạng", {**staff_data, "phone":"abc"}, 422),
        (4, "trùng email", {**staff_data, "phone":"0905300099"}, 409),
        (5, "trùng SĐT", {**staff_data, "email":"staff-other53@example.com", "phone":"0905300021"}, 409),
    ]:
        def rejected_staff():
            before = count()
            expect("POST", STAFF, code, payload, admin)
            assert count() == before
        check(f"STA-{i:02}", "Nhân viên", f"POST {STAFF} · {scenario}", f"HTTP {code}; không tạo bản ghi.", rejected_staff)

    def invalid_staff():
        for key, code in [("abc", 422), ("999999", 404)]:
            expect("PUT", f"{STAFF}/{key}", code, {k:v for k,v in staff_data.items() if k != "password"}, admin)
    check("STA-06", "Nhân viên", "PUT /api/admin/staff/{id} với ID chữ và ID không tồn tại.",
          "HTTP 422 và 404 tương ứng.", invalid_staff)

    def rejected_staff_update():
        before = snapshot(staff_data["email"])
        path = f"{STAFF}/{before[0]}"
        payload = dict(full_name="QA Staff", phone="0905300021", email=staff_data["email"])
        expect("PUT", path, 422, {**payload, "phone":"abc"}, admin)
        expect("PUT", path, 409, {**payload, "email":"staff53@example.com"}, admin)
        assert snapshot(staff_data["email"]) == before
    check("STA-07", "Nhân viên", "Admin sửa SĐT sai định dạng và sửa email trùng, sau đó đọc MySQL.",
          "HTTP 422 và 409; dữ liệu trước và sau giống nhau.", rejected_staff_update)

    for i, (query, total) in enumerate([("QA Nguyễn Văn Ánh",1), ("Nguyễn",1), ("0905300003",1),
                                         ("  Nguyễn  ",1), ("QA 53 Không tồn tại",0), ("%",0)], 1):
        def search():
            items = list_items(CUSTOMERS + "?" + urlencode({"q":query}), admin, total)
            assert [item["id"] for item in items] == ([booked_id] if total else [])
        check(f"CUS-{i:02}", "Khách hàng", f"Tìm khách hàng theo q = {query!r}.",
              f"HTTP 200; {total} kết quả; đúng ID và không có mật khẩu.", search)

    def page_customers():
        first = list_items(CUSTOMERS+"?page=1&limit=1", admin)
        second = list_items(CUSTOMERS+"?page=2&limit=1", admin)
        assert len(first) == len(second) == 1 and first[0]["id"] < second[0]["id"]
        assert expect("GET", f"{CUSTOMERS}/{booked_id}", 200, token=admin)["total_bookings"] == 2
    check("CUS-07", "Khách hàng", "GET danh sách trang 1, 2; xem chi tiết khách có lịch.",
          "ID tăng dần, không trùng trang; đối chiếu tổng 2 lượt đặt.", page_customers)

    def history():
        path = f"{CUSTOMERS}/{booked_id}/bookings"
        items = list_items(path, admin, 2)
        assert [item["booking_code"] for item in items] == ["QA53-2", "QA53-1"]
        for item in items:
            assert float(item["total_price"]) == 100000 and item["booking_status"] == "Confirmed"
            slot = item["slots"][0]
            assert slot["court_name"] == "Sân QA 53"
            assert slot["start_at"].startswith("2026-11-20T10:00") and slot["end_at"].startswith("2026-11-20T11:00")
            assert item["payments"][0]["payment_status"] == "SUCCESS"
        assert list_items(path+"?limit=1&page=2", admin, 2)[0]["booking_code"] == "QA53-1"
        assert list_items(path+"?status=Cancelled", admin, 0) == []
    check("HIS-01", "Lịch sử đặt sân", "GET lịch sử khách có 2 lượt; so với booking, slot và payment; thử lọc và phân trang.",
          "Chỉ QA53-2 và QA53-1, mới trước; sân, ngày/giờ, tiền, trạng thái đúng; lọc/trang đúng.", history)

    def empty_history():
        assert list_items(f"{CUSTOMERS}/{empty_id}/bookings", admin, 0) == []
        for identifier, code in [("abc",422), ("999999",404)]:
            expect("GET", f"{CUSTOMERS}/{identifier}/bookings", code, token=admin)
    check("HIS-02", "Lịch sử đặt sân", "GET lịch sử khách chưa đặt, ID không hợp lệ và ID không tồn tại.",
          "Danh sách rỗng HTTP 200; ID chữ 422; không tìm thấy 404.", empty_history)
    def date_filter():
        path = f"{CUSTOMERS}/{booked_id}/bookings"
        assert len(list_items(path+"?date_from=2026-11-20&date_to=2026-11-20", admin, 2)) == 2
        assert list_items(path+"?date_from=2026-11-21", admin, 0) == []
        expect("GET", path+"?date_from=2026-11-21&date_to=2026-11-20", 422, token=admin)
    check("HIS-03", "Lịch sử đặt sân", "Thử khoảng ngày trùng lịch, không trùng và khoảng đảo ngược.",
          "Hai lượt đúng ngày, danh sách rỗng khi lệch ngày và HTTP 422 cho khoảng đảo ngược.", date_filter)
    return records
