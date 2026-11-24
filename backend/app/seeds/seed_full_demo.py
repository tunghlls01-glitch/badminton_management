# -*- coding: utf-8 -*-
"""
Script Seed toàn bộ dữ liệu mẫu phục vụ Live Demo và Bảo vệ:
- Users: Admin, Staff, Khách hàng
- Courts: 6 Sân cầu lông
- Services: Đầy đủ menu nước, cầu, thuê vợt, phụ kiện
- Service Stock Logs: Lịch sử biến động kho cho module Bảo
- Bookings & Booking Slots: Các đơn đặt sân phong phú cho trang Quản lý đặt sân
- Service Orders & Invoices & Payments: Dữ liệu doanh thu & bán lẻ POS
"""
import os
import sys
from datetime import datetime, date, time, timedelta
from decimal import Decimal

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from sqlalchemy import text, inspect
from app.db.session import engine, SessionLocal, Base
from app.core.security import get_password_hash
from app.models.user import User, UserRole, UserStatus
from app.models.court import Court, CourtStatus
from app.models.service import Service, ServiceCategory, ServiceStatus
from app.models.service_stock_log import ServiceStockLog, StockChangeType
from app.models.booking import Booking, BookingChannel, BookingStatus
from app.models.booking_slot import BookingSlot, BookingSlotStatus
from app.models.service_order import ServiceOrder, ServiceOrderStatus
from app.models.service_order_item import ServiceOrderItem
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.models.invoice import Invoice


def migrate_columns_if_needed():
    """Tự động đồng bộ các cột còn thiếu trong database."""
    with engine.begin() as conn:
        insp = inspect(conn)
        
        # 1. booking_slots
        if "booking_slots" in insp.get_table_names():
            cols = {c["name"] for c in insp.get_columns("booking_slots")}
            if "start_time" in cols and "start_at" not in cols:
                conn.execute(text("ALTER TABLE booking_slots CHANGE COLUMN start_time start_at DATETIME NOT NULL"))
            if "end_time" in cols and "end_at" not in cols:
                conn.execute(text("ALTER TABLE booking_slots CHANGE COLUMN end_time end_at DATETIME NOT NULL"))
            if "start_at" not in cols and "start_time" not in cols:
                conn.execute(text("ALTER TABLE booking_slots ADD COLUMN start_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"))
            if "end_at" not in cols and "end_time" not in cols:
                conn.execute(text("ALTER TABLE booking_slots ADD COLUMN end_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"))
            if "duration_minutes" not in cols:
                conn.execute(text("ALTER TABLE booking_slots ADD COLUMN duration_minutes INT NOT NULL DEFAULT 60"))
            if "price_per_hour" not in cols:
                conn.execute(text("ALTER TABLE booking_slots ADD COLUMN price_per_hour DECIMAL(10, 2) NOT NULL DEFAULT 50000"))
            if "amount" not in cols:
                conn.execute(text("ALTER TABLE booking_slots ADD COLUMN amount DECIMAL(10, 2) NOT NULL DEFAULT 50000"))
            try:
                conn.execute(text("ALTER TABLE booking_slots MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Active'"))
            except Exception:
                pass

        # 2. courts
        if "courts" in insp.get_table_names():
            cols = {c["name"] for c in insp.get_columns("courts")}
            if "image_url" not in cols:
                conn.execute(text("ALTER TABLE courts ADD COLUMN image_url VARCHAR(500) NULL"))
            try:
                conn.execute(text("ALTER TABLE courts MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Active'"))
            except Exception:
                pass

        # 3. services
        if "services" in insp.get_table_names():
            try:
                conn.execute(text("ALTER TABLE services MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Active'"))
            except Exception:
                pass

        # 4. bookings
        if "bookings" in insp.get_table_names():
            cols = {c["name"] for c in insp.get_columns("bookings")}
            if "hold_expires_at" not in cols:
                conn.execute(text("ALTER TABLE bookings ADD COLUMN hold_expires_at DATETIME NULL"))
            try:
                conn.execute(text("ALTER TABLE bookings MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Confirmed'"))
            except Exception:
                pass

        # 5. invoices
        if "invoices" in insp.get_table_names():
            cols = {c["name"] for c in insp.get_columns("invoices")}
            if "discount_amount" not in cols:
                conn.execute(text("ALTER TABLE invoices ADD COLUMN discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00"))
            if "discount_reason" not in cols:
                conn.execute(text("ALTER TABLE invoices ADD COLUMN discount_reason VARCHAR(255) NULL"))
            if "total_court_amount" not in cols:
                conn.execute(text("ALTER TABLE invoices ADD COLUMN total_court_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00"))
            if "total_service_amount" not in cols:
                conn.execute(text("ALTER TABLE invoices ADD COLUMN total_service_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00"))

        # 6. payments
        if "payments" in insp.get_table_names():
            cols = {c["name"] for c in insp.get_columns("payments")}
            if "invoice_id" not in cols:
                conn.execute(text("ALTER TABLE payments ADD COLUMN invoice_id INT NULL"))
            if "service_order_id" not in cols:
                conn.execute(text("ALTER TABLE payments ADD COLUMN service_order_id INT NULL"))
            if "receipt_path" not in cols:
                conn.execute(text("ALTER TABLE payments ADD COLUMN receipt_path VARCHAR(255) NULL"))


def seed_all():
    print(">>> 1. Kiểm tra cấu trúc database & Đồng bộ cột...")
    Base.metadata.create_all(bind=engine)
    migrate_columns_if_needed()

    db = SessionLocal()
    try:
        # ==========================================
        # 1. SEED USERS
        # ==========================================
        print(">>> 2. Seed Users (Admin, Staff, Customers)...")
        users_data = [
            ("Quản Trị Viên", "admin@badminton.vn", "0901000001", UserRole.ADMIN, "admin"),
            ("Quản Trị Viên hqb", "admin@badminton.com", "0901000002", UserRole.ADMIN, "admin123"),
            ("Lễ Tân Nguyễn Văn A", "staff1@badminton.vn", "0902000001", UserRole.STAFF, "staff123"),
            ("Thu Ngân Trần Thị B", "staff2@badminton.vn", "0902000002", UserRole.STAFF, "staff123"),
            ("Nguyễn Văn Hùng", "hung.nguyen@gmail.com", "0988111222", UserRole.CUSTOMER, "123456"),
            ("Trần Quốc Tuấn", "tuan.tran@gmail.com", "0988222333", UserRole.CUSTOMER, "123456"),
            ("Lê Thị Mai", "mai.le@gmail.com", "0988333444", UserRole.CUSTOMER, "123456"),
            ("Phạm Đức Anh", "ducanh.pham@gmail.com", "0988444555", UserRole.CUSTOMER, "123456"),
            ("Hoàng Minh Trí", "tri.hoang@gmail.com", "0988555666", UserRole.CUSTOMER, "123456"),
        ]

        user_map = {}
        for full_name, email, phone, role, password in users_data:
            existing = db.query(User).filter((User.email == email) | (User.phone == phone)).first()
            if not existing:
                u = User(
                    full_name=full_name,
                    email=email,
                    phone=phone,
                    hashed_password=get_password_hash(password),
                    role=role,
                    status=UserStatus.ACTIVE,
                )
                db.add(u)
                db.commit()
                db.refresh(u)
                user_map[email] = u
            else:
                user_map[email] = existing

        # ==========================================
        # 2. SEED COURTS
        # ==========================================
        print(">>> 3. Seed Sân Cầu Lông (Courts)...")
        courts_data = [
            ("Sân số 1", "Sân thảm tiêu chuẩn thi đấu, ánh sáng chống chói.", "Active", "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea"),
            ("Sân số 2", "Sân thảm chất lượng cao, độ bám tốt, đánh đơn/đôi.", "Active", "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea"),
            ("Sân số 3", "Thảm PVC 5 lớp đàn hồi cao, giảm chấn thương.", "Active", "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea"),
            ("Sân số 4 (VIP)", "Sân phòng lạnh riêng biệt, khán đài mini, nước uống miễn phí.", "Active", "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea"),
            ("Sân số 5 (VIP)", "Sân thi đấu chuyên nghiệp, hệ thống camera VAR.", "Active", "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea"),
            ("Sân số 6", "Sân đang thay thảm mới và bảo trì dàn đèn.", "Maintenance", "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea"),
        ]

        court_map = {}
        for name, desc, status, img in courts_data:
            existing = db.query(Court).filter(Court.name == name).first()
            if not existing:
                c = Court(name=name, description=desc, status="Active", image_url=img)
                db.add(c)
                db.commit()
                db.refresh(c)
                court_map[name] = c
            else:
                existing.status = CourtStatus.Active
                db.commit()
                court_map[name] = existing

        # ==========================================
        # 3. SEED SERVICES & STOCK LOGS (MODULE HOÀNG QUỐC BẢO)
        # ==========================================
        print(">>> 4. Seed Danh mục Dịch vụ & Lịch sử Kho (Module Bảo HQ)...")
        services_data = [
            ("Nước khoáng Lavie 500ml", "NUOC", "Nước khoáng thiên nhiên ướp lạnh", "Chai", 10000, 120, "ACTIVE"),
            ("Nước tinh khiết Aquafina 500ml", "NUOC", "Nước tinh khiết đóng chai ướp lạnh", "Chai", 10000, 100, "ACTIVE"),
            ("Nước tăng lực Red Bull 250ml", "NUOC", "Bò húc Thái Lan bổ sung năng lượng", "Lon", 20000, 80, "ACTIVE"),
            ("Nước điện giải Pocari Sweat 500ml", "NUOC", "Nước bù điện giải thể thao chuyên dụng", "Chai", 20000, 8, "ACTIVE"), # Sắp hết
            ("Nước chanh muối Revive 500ml", "NUOC", "Nước bù khoáng vị chanh muối", "Chai", 15000, 5, "ACTIVE"), # Sắp hết
            ("Trà xanh Không Độ 500ml", "NUOC", "Trà xanh đóng chai giải nhiệt thanh mát", "Chai", 15000, 0, "ACTIVE"), # Hết hàng
            ("Nước ngọt Coca-Cola 320ml", "NUOC", "Nước ngọt có gas ướp lạnh", "Lon", 15000, 50, "ACTIVE"),
            ("Ống cầu lông Yonex Aerosensa 50", "ONG_CAU", "Ống 12 quả cầu lông tiêu chuẩn thi đấu", "Ống", 520000, 25, "ACTIVE"),
            ("Ống cầu lông Victor Master No.1", "ONG_CAU", "Ống 12 quả lông vũ độ bền cao, bay đầm", "Ống", 450000, 30, "ACTIVE"),
            ("Ống cầu lông Ba Sao Pro", "ONG_CAU", "Ống 12 quả cầu lông Ba Sao tập luyện", "Ống", 220000, 45, "ACTIVE"),
            ("Quả cầu lông lẻ Ba Sao Pro", "ONG_CAU", "Bán lẻ từng quả cầu lông Ba Sao Pro", "Quả", 20000, 150, "ACTIVE"),
            ("Thuê vợt Yonex Astrox", "THUE_VOT", "Cho thuê vợt Yonex thân dẻo trợ lực tốt", "Cây/Lượt", 50000, 15, "ACTIVE"),
            ("Thuê vợt Lining Windstorm", "THUE_VOT", "Cho thuê vợt Lining siêu nhẹ, dễ thủ", "Cây/Lượt", 40000, 12, "ACTIVE"),
            ("Quấn cán vợt Yonex AC102EX", "KHAC", "Quấn cán cao su non bám tay, thấm mồ hôi", "Cái", 35000, 60, "ACTIVE"),
            ("Tất thi đấu Victor chống trượt", "KHAC", "Tất sợi cotton có hạt silicon chống trượt", "Đôi", 45000, 30, "ACTIVE"),
            ("Băng cổ tay thấm mồ hôi Yonex", "KHAC", "Băng bảo vệ cổ tay thể thao co giãn êm", "Cái", 30000, 25, "ACTIVE"),
            ("Nước tăng lực Wake Up 247", "NUOC", "Tạm ngừng kinh doanh chờ mẫu mới", "Chai", 12000, 0, "INACTIVE"),
            ("Ống cầu Hải Yến đỏ", "ONG_CAU", "Tạm ngừng nhập hàng do nhà sản xuất đổi mẫu", "Ống", 210000, 0, "INACTIVE"),
        ]

        service_map = {}
        for name, cat, desc, unit, price, stock, st in services_data:
            existing = db.query(Service).filter(Service.name == name).first()
            if not existing:
                s = Service(name=name, category=cat, description=desc, unit=unit, price=Decimal(price), stock_quantity=stock, status=st)
                db.add(s)
                db.commit()
                db.refresh(s)
                service_map[name] = s

                # Tạo 1 log khởi tạo
                if stock > 0:
                    log = ServiceStockLog(
                        service_id=s.id,
                        change_type="Nhập hàng",
                        quantity_change=stock,
                        quantity_before=0,
                        quantity_after=stock,
                        note="Khởi tạo số lượng kho ban đầu",
                        created_at=datetime.now() - timedelta(days=5),
                    )
                    db.add(log)
                    db.commit()
            else:
                service_map[name] = existing

        # Thêm vài log biến động kho rải đều các ngày
        lavie = service_map.get("Nước khoáng Lavie 500ml")
        if lavie:
            db.add(ServiceStockLog(
                service_id=lavie.id,
                change_type="Nhập hàng",
                quantity_change=50,
                quantity_before=70,
                quantity_after=120,
                note="Nhập hàng thêm từ đại lý nước giải khát",
                created_at=datetime.now() - timedelta(days=2),
            ))
            db.add(ServiceStockLog(
                service_id=lavie.id,
                change_type="Bán lẻ",
                quantity_change=-6,
                quantity_before=126,
                quantity_after=120,
                note="Bán lẻ phục vụ khách đánh sân 1 và sân 2",
                created_at=datetime.now() - timedelta(hours=3),
            ))

        yonex = service_map.get("Ống cầu lông Yonex Aerosensa 50")
        if yonex:
            db.add(ServiceStockLog(
                service_id=yonex.id,
                change_type="Nhập hàng",
                quantity_change=20,
                quantity_before=5,
                quantity_after=25,
                note="Nhập kiện cầu lông Yonex AS50 chính hãng",
                created_at=datetime.now() - timedelta(days=1),
            ))
        db.commit()

        # ==========================================
        # 4. SEED BOOKINGS & BOOKING SLOTS (QUẢN LÝ ĐẶT SÂN)
        # ==========================================
        print(">>> 5. Seed Đơn Đặt Sân & Khung Giờ (Bookings & BookingSlots)...")
        customers = [u for u in user_map.values() if u.role == UserRole.CUSTOMER]
        admin_user = user_map.get("admin@badminton.vn") or db.query(User).filter(User.role == UserRole.ADMIN).first()
        active_courts = [c for c in court_map.values() if c.status == "Active" or c.status == CourtStatus.Active]

        if customers and active_courts:
            now = datetime.now()
            today = now.date()

            # Danh sách booking mẫu rải từ hôm qua, hôm nay đến ngày mai
            booking_samples = [
                # 1. Hôm nay - Sân 1 - Đã xác nhận (Confirmed)
                {
                    "code": f"BK-{today.strftime('%Y%m%d')}-001",
                    "customer": customers[0],
                    "court": active_courts[0],
                    "start": datetime.combine(today, time(8, 0)),
                    "end": datetime.combine(today, time(10, 0)),
                    "status": BookingStatus.Confirmed,
                    "price_per_hour": 80000,
                    "channel": BookingChannel.Online,
                    "note": "Khách đặt sân tập sáng cố định",
                },
                # 2. Hôm nay - Sân 2 - Đã Check-in (CHECKED_IN)
                {
                    "code": f"BK-{today.strftime('%Y%m%d')}-002",
                    "customer": customers[1],
                    "court": active_courts[1],
                    "start": datetime.combine(today, time(9, 0)),
                    "end": datetime.combine(today, time(11, 0)),
                    "status": BookingStatus.CHECKED_IN,
                    "price_per_hour": 80000,
                    "channel": BookingChannel.Counter,
                    "note": "Khách đến nhận sân tại quầy",
                },
                # 3. Hôm nay - Sân VIP 4 - Đã Hoàn thành (Completed)
                {
                    "code": f"BK-{today.strftime('%Y%m%d')}-003",
                    "customer": customers[2],
                    "court": active_courts[3] if len(active_courts) > 3 else active_courts[0],
                    "start": datetime.combine(today, time(14, 0)),
                    "end": datetime.combine(today, time(16, 0)),
                    "status": BookingStatus.Completed,
                    "price_per_hour": 150000,
                    "channel": BookingChannel.Online,
                    "note": "Khách VIP đặt sân giao hữu công ty",
                },
                # 4. Hôm nay - Sân 3 - Đang giữ chỗ (Pending)
                {
                    "code": f"BK-{today.strftime('%Y%m%d')}-004",
                    "customer": customers[3],
                    "court": active_courts[2] if len(active_courts) > 2 else active_courts[0],
                    "start": datetime.combine(today, time(17, 30)),
                    "end": datetime.combine(today, time(19, 30)),
                    "status": BookingStatus.Pending,
                    "price_per_hour": 120000,
                    "channel": BookingChannel.Online,
                    "note": "Khách giữ chỗ qua mạng",
                    "hold_expires_at": now + timedelta(minutes=10),
                },
                # 5. Hôm nay - Sân 5 (VIP) - Đang chơi (CHECKED_IN)
                {
                    "code": f"BK-{today.strftime('%Y%m%d')}-013",
                    "customer": customers[4] if len(customers) > 4 else customers[0],
                    "court": court_map.get("Sân số 5 (VIP)") or active_courts[0],
                    "start": datetime.combine(today, time(15, 0)),
                    "end": datetime.combine(today, time(17, 0)),
                    "status": BookingStatus.CHECKED_IN,
                    "price_per_hour": 150000,
                    "channel": BookingChannel.Counter,
                    "note": "Khách nhận sân VIP 5 đánh đơn",
                },
                # 6. Hôm nay - Sân 6 - Đang chơi (CHECKED_IN)
                {
                    "code": f"BK-{today.strftime('%Y%m%d')}-014",
                    "customer": customers[1] if len(customers) > 1 else customers[0],
                    "court": court_map.get("Sân số 6") or active_courts[0],
                    "start": datetime.combine(today, time(16, 0)),
                    "end": datetime.combine(today, time(18, 0)),
                    "status": BookingStatus.CHECKED_IN,
                    "price_per_hour": 100000,
                    "channel": BookingChannel.Counter,
                    "note": "Khách đặt sân 6 tại quầy",
                },
                # 7. Hôm nay - Sân 5 (VIP) - Tối nay (Confirmed)
                {
                    "code": f"BK-{today.strftime('%Y%m%d')}-015",
                    "customer": customers[0],
                    "court": court_map.get("Sân số 5 (VIP)") or active_courts[0],
                    "start": datetime.combine(today, time(19, 0)),
                    "end": datetime.combine(today, time(21, 0)),
                    "status": BookingStatus.Confirmed,
                    "price_per_hour": 150000,
                    "channel": BookingChannel.Online,
                    "note": "Đặt sân VIP 5 tối nay",
                },
                # 8. Hôm nay - Sân 6 - Tối nay (Confirmed)
                {
                    "code": f"BK-{today.strftime('%Y%m%d')}-016",
                    "customer": customers[2] if len(customers) > 2 else customers[0],
                    "court": court_map.get("Sân số 6") or active_courts[0],
                    "start": datetime.combine(today, time(20, 0)),
                    "end": datetime.combine(today, time(22, 0)),
                    "status": BookingStatus.Confirmed,
                    "price_per_hour": 100000,
                    "channel": BookingChannel.Online,
                    "note": "Đặt sân 6 ca tối",
                },
                # 9. Hôm nay - Sân 1 - Đã hủy (Cancelled)
                {
                    "code": f"BK-{today.strftime('%Y%m%d')}-005",
                    "customer": customers[3] if len(customers) > 3 else customers[0],
                    "court": active_courts[0],
                    "start": datetime.combine(today, time(19, 0)),
                    "end": datetime.combine(today, time(21, 0)),
                    "status": BookingStatus.Cancelled,
                    "price_per_hour": 120000,
                    "channel": BookingChannel.Online,
                    "note": "Khách báo bận họp đột xuất nên xin hủy",
                },
                # 6. Ngày mai - Sân 2 - Đã xác nhận (Confirmed)
                {
                    "code": f"BK-{(today + timedelta(days=1)).strftime('%Y%m%d')}-006",
                    "customer": customers[0],
                    "court": active_courts[1] if len(active_courts) > 1 else active_courts[0],
                    "start": datetime.combine(today + timedelta(days=1), time(18, 0)),
                    "end": datetime.combine(today + timedelta(days=1), time(20, 0)),
                    "status": BookingStatus.Confirmed,
                    "price_per_hour": 120000,
                    "channel": BookingChannel.Counter,
                    "note": "Đặt trước cho tối mai",
                },
                # 7. Ngày mai - Sân 1 - Sáng mai (Confirmed)
                {
                    "code": f"BK-{(today + timedelta(days=1)).strftime('%Y%m%d')}-008",
                    "customer": customers[1] if len(customers) > 1 else customers[0],
                    "court": active_courts[0],
                    "start": datetime.combine(today + timedelta(days=1), time(8, 0)),
                    "end": datetime.combine(today + timedelta(days=1), time(10, 0)),
                    "status": BookingStatus.Confirmed,
                    "price_per_hour": 80000,
                    "channel": BookingChannel.Online,
                    "note": "Tập sáng với bạn bè",
                },
                # 8. Ngày mai - Sân 4 VIP - Chiều tối (Confirmed)
                {
                    "code": f"BK-{(today + timedelta(days=1)).strftime('%Y%m%d')}-009",
                    "customer": customers[2] if len(customers) > 2 else customers[0],
                    "court": active_courts[3] if len(active_courts) > 3 else active_courts[0],
                    "start": datetime.combine(today + timedelta(days=1), time(17, 0)),
                    "end": datetime.combine(today + timedelta(days=1), time(19, 0)),
                    "status": BookingStatus.Confirmed,
                    "price_per_hour": 150000,
                    "channel": BookingChannel.Online,
                    "note": "Giao lưu CLB Cầu Lông Thủ Đô",
                },
                # 9. Ngày mai - Sân 3 - Tối mai (Confirmed)
                {
                    "code": f"BK-{(today + timedelta(days=1)).strftime('%Y%m%d')}-010",
                    "customer": customers[3] if len(customers) > 3 else customers[0],
                    "court": active_courts[2] if len(active_courts) > 2 else active_courts[0],
                    "start": datetime.combine(today + timedelta(days=1), time(19, 30)),
                    "end": datetime.combine(today + timedelta(days=1), time(21, 30)),
                    "status": BookingStatus.Confirmed,
                    "price_per_hour": 120000,
                    "channel": BookingChannel.Online,
                    "note": "Trận đấu đôi nam nữ",
                },
                # 10. Ngày kia (+2 ngày) - Sân 5 VIP (Confirmed)
                {
                    "code": f"BK-{(today + timedelta(days=2)).strftime('%Y%m%d')}-011",
                    "customer": customers[4] if len(customers) > 4 else customers[0],
                    "court": active_courts[4] if len(active_courts) > 4 else active_courts[0],
                    "start": datetime.combine(today + timedelta(days=2), time(18, 0)),
                    "end": datetime.combine(today + timedelta(days=2), time(20, 0)),
                    "status": BookingStatus.Confirmed,
                    "price_per_hour": 150000,
                    "channel": BookingChannel.Online,
                    "note": "Đặt sân VIP cuối tuần",
                },
                # 11. Ngày kia (+2 ngày) - Sân 2 (Confirmed)
                {
                    "code": f"BK-{(today + timedelta(days=2)).strftime('%Y%m%d')}-012",
                    "customer": customers[0],
                    "court": active_courts[1] if len(active_courts) > 1 else active_courts[0],
                    "start": datetime.combine(today + timedelta(days=2), time(14, 0)),
                    "end": datetime.combine(today + timedelta(days=2), time(16, 0)),
                    "status": BookingStatus.Confirmed,
                    "price_per_hour": 100000,
                    "channel": BookingChannel.Counter,
                    "note": "Hội đồng hương đánh giao hữu",
                },
                # 12. Hôm qua - Sân 2 - Hoàn thành (Completed)
                {
                    "code": f"BK-{(today - timedelta(days=1)).strftime('%Y%m%d')}-007",
                    "customer": customers[1],
                    "court": active_courts[1],
                    "start": datetime.combine(today - timedelta(days=1), time(16, 0)),
                    "end": datetime.combine(today - timedelta(days=1), time(18, 0)),
                    "status": BookingStatus.Completed,
                    "price_per_hour": 80000,
                    "channel": BookingChannel.Online,
                    "note": "Lượt chơi đã thanh toán đầy đủ hôm qua",
                },
            ]

            for item in booking_samples:
                existing_b = db.query(Booking).filter(Booking.booking_code == item["code"]).first()
                if not existing_b:
                    hours = (item["end"] - item["start"]).total_seconds() / 3600.0
                    total_amount = Decimal(hours * item["price_per_hour"])
                    
                    b = Booking(
                        booking_code=item["code"],
                        user_id=item["customer"].id,
                        created_by=admin_user.id if admin_user else None,
                        booking_channel=item["channel"],
                        total_price=total_amount,
                        status=item["status"],
                        note=item["note"],
                        hold_expires_at=item.get("hold_expires_at"),
                        created_at=item["start"] - timedelta(hours=2),
                    )
                    db.add(b)
                    db.commit()
                    db.refresh(b)

                    # Tạo Slot tương ứng
                    slot = BookingSlot(
                        booking_id=b.id,
                        court_id=item["court"].id,
                        start_at=item["start"],
                        end_at=item["end"],
                        duration_minutes=int(hours * 60),
                        price_per_hour=Decimal(item["price_per_hour"]),
                        amount=total_amount,
                        status=BookingSlotStatus.Active if item["status"] != BookingStatus.Cancelled else BookingSlotStatus.Cancelled,
                    )
                    db.add(slot)
                    db.commit()

                    # Nếu là booking Completed, tạo thêm Order dịch vụ (Nước + Thuê vợt)
                    if item["status"] == BookingStatus.Completed and lavie:
                        so = ServiceOrder(
                            booking_id=b.id,
                            total_price=Decimal(70000),
                            status=ServiceOrderStatus.COMPLETED,
                            note="Khách gọi 2 chai Lavie + 1 cây vợt Yonex",
                        )
                        db.add(so)
                        db.commit()
                        db.refresh(so)

                        soi1 = ServiceOrderItem(
                            service_order_id=so.id,
                            service_id=lavie.id,
                            quantity=2,
                            unit_price=lavie.price,
                            amount=Decimal(20000),
                        )
                        racket = service_map.get("Thuê vợt Yonex Astrox")
                        if racket:
                            soi2 = ServiceOrderItem(
                                service_order_id=so.id,
                                service_id=racket.id,
                                quantity=1,
                                unit_price=racket.price,
                                amount=Decimal(50000),
                            )
                            db.add(soi2)
                        db.add(soi1)
                        db.commit()

                        # Tạo Payment và Invoice hoàn chỉnh
                        inv = Invoice(
                            invoice_code=f"INV-{b.id:04d}",
                            booking_id=b.id,
                            customer_id=item["customer"].id,
                            total_court_amount=total_amount,
                            total_service_amount=Decimal(70000),
                            grand_total=total_amount + Decimal(70000),
                        )
                        db.add(inv)
                        db.commit()
                        db.refresh(inv)

                        pm = Payment(
                            invoice_id=inv.id,
                            booking_id=b.id,
                            amount=inv.grand_total,
                            payment_method="CASH",
                            payment_status=PaymentStatus.SUCCESS,
                            transaction_code=f"TXN-{inv.id:05d}",
                        )
                        db.add(pm)
                        db.commit()

        print(">>> HOÀN TẤT SEED DỮ LIỆU MẪU THÀNH CÔNG RỰC RỠ!")
        print(f"Tổng Users: {db.query(User).count()}")
        print(f"Tổng Courts: {db.query(Court).count()}")
        print(f"Tổng Services: {db.query(Service).count()}")
        print(f"Tổng Stock Logs: {db.query(ServiceStockLog).count()}")
        print(f"Tổng Bookings: {db.query(Booking).count()}")
        print(f"Tổng Booking Slots: {db.query(BookingSlot).count()}")

    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        print(f"Lỗi khi seed: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_all()
