"""Unit tests cho tính năng Xuất báo cáo kho dịch vụ ra CSV (T3D32A7)."""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from datetime import date, datetime, timedelta
from decimal import Decimal
import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token
from app.db.session import Base, get_db
from app.main import app
from app.models.service import Service, ServiceCategory, ServiceStatus
from app.models.service_stock_log import ServiceStockLog, StockChangeType
from app.models.user import User, UserRole, UserStatus


class ExportServicesCSVTestCase(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        def override_get_db():
            try:
                yield self.db
            finally:
                pass

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

        # 1. Seed users: Admin, Staff, Customer
        self.admin = User(
            full_name="Quản Trị Viên",
            email="admin_csv@example.com",
            phone="0901234567",
            hashed_password="hashed_pw",
            role=UserRole.ADMIN,
            status=UserStatus.ACTIVE,
        )
        self.staff = User(
            full_name="Nhân Viên Kho",
            email="staff_csv@example.com",
            phone="0901234568",
            hashed_password="hashed_pw",
            role=UserRole.STAFF,
            status=UserStatus.ACTIVE,
        )
        self.customer = User(
            full_name="Khách Hàng",
            email="customer_csv@example.com",
            phone="0901234569",
            hashed_password="hashed_pw",
            role=UserRole.CUSTOMER,
            status=UserStatus.ACTIVE,
        )
        self.db.add_all([self.admin, self.staff, self.customer])
        self.db.commit()

        # Tạo JWT Tokens
        self.admin_token = create_access_token({"sub": str(self.admin.id)})
        self.staff_token = create_access_token({"sub": str(self.staff.id)})
        self.customer_token = create_access_token({"sub": str(self.customer.id)})

        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        self.staff_headers = {"Authorization": f"Bearer {self.staff_token}"}
        self.customer_headers = {"Authorization": f"Bearer {self.customer_token}"}

        # 2. Seed Services
        self.svc1 = Service(
            name="Nước tăng lực Redbull",
            category=ServiceCategory.NUOC,
            price=Decimal("15000"),
            stock_quantity=50,
            unit="lon",
            status=ServiceStatus.ACTIVE,
        )
        self.svc2 = Service(
            name="Ống cầu Yonex AS40",
            category=ServiceCategory.ONG_CAU,
            price=Decimal("420000"),
            stock_quantity=5,  # <= 10: sắp hết hàng
            unit="ong",
            status=ServiceStatus.ACTIVE,
        )
        self.svc3 = Service(
            name="Thuê vợt Yonex Astrox",
            category=ServiceCategory.THUE_VOT,
            price=Decimal("30000"),
            stock_quantity=0,  # 0: hết hàng
            unit="cay",
            status=ServiceStatus.ACTIVE,
        )
        self.db.add_all([self.svc1, self.svc2, self.svc3])
        self.db.commit()

        # 3. Seed Stock Logs
        today = datetime.now()
        yesterday = today - timedelta(days=1)
        last_week = today - timedelta(days=7)

        self.log1 = ServiceStockLog(
            service_id=self.svc1.id,
            change_type=StockChangeType.IMPORT.value,
            quantity_change=50,
            quantity_before=0,
            quantity_after=50,
            note="Nhập hàng lô đầu",
            created_at=last_week,
        )
        self.log2 = ServiceStockLog(
            service_id=self.svc1.id,
            change_type=StockChangeType.SALE.value,
            quantity_change=-2,
            quantity_before=50,
            quantity_after=48,
            note="Bán lẻ tại quầy POS",
            created_at=yesterday,
        )
        self.log3 = ServiceStockLog(
            service_id=self.svc2.id,
            change_type=StockChangeType.ADJUSTMENT.value,
            quantity_change=-1,
            quantity_before=6,
            quantity_after=5,
            note="Kiểm kê định kỳ bị rách hộp",
            created_at=today,
        )
        self.db.add_all([self.log1, self.log2, self.log3])
        self.db.commit()

    def tearDown(self):
        app.dependency_overrides.clear()
        self.db.close()
        Base.metadata.drop_all(self.engine)

    def test_export_inventory_csv_auth_rules(self):
        """Kiểm tra xác thực 401 & 403 khi xuất CSV tồn kho."""
        # 1. Chưa đăng nhập -> 401
        res = self.client.get("/api/services/export/inventory-csv")
        self.assertEqual(res.status_code, 401)

        # 2. Quyền khách hàng (CUSTOMER) -> 403
        res = self.client.get("/api/services/export/inventory-csv", headers=self.customer_headers)
        self.assertEqual(res.status_code, 403)

    def test_export_inventory_csv_success(self):
        """Kiểm tra xuất file CSV tồn kho thành công với quyền ADMIN và STAFF."""
        res = self.client.get("/api/services/export/inventory-csv", headers=self.admin_headers)
        self.assertEqual(res.status_code, 200)
        self.assertIn("text/csv", res.headers.get("content-type", ""))
        self.assertIn("attachment; filename=", res.headers.get("content-disposition", ""))

        # Kiểm tra nội dung CSV có UTF-8 BOM và các dòng dữ liệu
        content = res.content.decode("utf-8-sig")
        lines = [line.strip() for line in content.strip().split("\n") if line.strip()]

        # Kiểm tra tiêu đề
        header = lines[0]
        self.assertIn("Mã dịch vụ", header)
        self.assertIn("Tên dịch vụ", header)
        self.assertIn("Số lượng tồn", header)
        self.assertIn("Cảnh báo tồn kho", header)

        # Kiểm tra dữ liệu dịch vụ có mặt đầy đủ
        self.assertTrue(any("Nước tăng lực Redbull" in line for line in lines))
        self.assertTrue(any("Ống cầu Yonex AS40" in line for line in lines))
        self.assertTrue(any("Thuê vợt Yonex Astrox" in line for line in lines))
        self.assertTrue(any("Sắp hết hàng" in line for line in lines))
        self.assertTrue(any("Hết hàng" in line for line in lines))

    def test_export_stock_logs_csv_filter_date_and_service(self):
        """Kiểm tra xuất file CSV lịch sử nhập/xuất lọc theo khoảng thời gian và dịch vụ."""
        today_str = date.today().isoformat()
        two_days_ago_str = (date.today() - timedelta(days=2)).isoformat()

        # Lọc trong vòng 2 ngày gần nhất (sẽ chỉ có log2 và log3, không có log1 tuần trước)
        res = self.client.get(
            f"/api/services/export/stock-logs-csv?from_date={two_days_ago_str}&to_date={today_str}",
            headers=self.staff_headers,
        )
        self.assertEqual(res.status_code, 200)
        content = res.content.decode("utf-8-sig")
        lines = [line.strip() for line in content.strip().split("\n") if line.strip()]

        # Tiêu đề + 2 dòng dữ liệu
        self.assertIn("Mã log", lines[0])
        self.assertIn("Bán hàng POS", content)
        self.assertIn("Điều chỉnh kiểm kê", content)
        self.assertNotIn("Nhập hàng lô đầu", content)  # Log1 bị loại do nằm ngoài khoảng thời gian

    def test_export_stock_logs_csv_by_service_id(self):
        """Kiểm tra lọc lịch sử xuất CSV theo service_id."""
        res = self.client.get(
            f"/api/services/export/stock-logs-csv?service_id={self.svc1.id}",
            headers=self.admin_headers,
        )
        self.assertEqual(res.status_code, 200)
        content = res.content.decode("utf-8-sig")
        self.assertIn("Nước tăng lực Redbull", content)
        self.assertNotIn("Ống cầu Yonex AS40", content)

    def test_export_csv_unified_endpoint(self):
        """Kiểm tra endpoint tổng hợp /api/services/export-csv."""
        # 1. Xuất tồn kho
        res1 = self.client.get("/api/services/export-csv?report_type=inventory", headers=self.admin_headers)
        self.assertEqual(res1.status_code, 200)
        self.assertIn("Cảnh báo tồn kho", res1.content.decode("utf-8-sig"))

        # 2. Xuất lịch sử
        res2 = self.client.get("/api/services/export-csv?report_type=stock_logs", headers=self.admin_headers)
        self.assertEqual(res2.status_code, 200)
        self.assertIn("Mã log", res2.content.decode("utf-8-sig"))

    def test_list_all_stock_logs_json_api(self):
        """Kiểm tra API JSON lấy danh sách biến động kho có lọc thời gian."""
        today_str = date.today().isoformat()
        res = self.client.get(
            f"/api/services/stock-logs?from_date={today_str}",
            headers=self.admin_headers,
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 1)  # Chỉ có log3 hôm nay
        self.assertEqual(data[0]["note"], "Kiểm kê định kỳ bị rách hộp")


if __name__ == "__main__":
    unittest.main()
