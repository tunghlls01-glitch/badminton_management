"""Seed 15 dịch vụ mẫu và ghi nhận tồn kho ban đầu."""
from decimal import Decimal

from sqlalchemy import func, select

from app.db.session import Base, SessionLocal, engine
from app.models.service import Service, ServiceCategory, ServiceStatus
from app.models.service_stock_log import ServiceStockLog, StockChangeType

SAMPLE_SERVICES = [
    # 1. NƯỚC (6 món)
    {
        "name": "Nước khoáng Lavie 500ml",
        "category": ServiceCategory.NUOC.value,
        "description": "Nước khoáng thiên nhiên ướp lạnh",
        "unit": "Chai",
        "price": Decimal("10000.00"),
        "stock_quantity": 120,
        "status": ServiceStatus.ACTIVE.value,
    },
    {
        "name": "Nước tinh khiết Aquafina 500ml",
        "category": ServiceCategory.NUOC.value,
        "description": "Nước tinh khiết đóng chai ướp lạnh",
        "unit": "Chai",
        "price": Decimal("10000.00"),
        "stock_quantity": 100,
        "status": ServiceStatus.ACTIVE.value,
    },
    {
        "name": "Nước tăng lực Red Bull 250ml",
        "category": ServiceCategory.NUOC.value,
        "description": "Bò húc Thái Lan bổ sung năng lượng",
        "unit": "Lon",
        "price": Decimal("20000.00"),
        "stock_quantity": 80,
        "status": ServiceStatus.ACTIVE.value,
    },
    {
        "name": "Nước điện giải Pocari Sweat 500ml",
        "category": ServiceCategory.NUOC.value,
        "description": "Nước bù điện giải thể thao chuyên dụng",
        "unit": "Chai",
        "price": Decimal("20000.00"),
        "stock_quantity": 90,
        "status": ServiceStatus.ACTIVE.value,
    },
    {
        "name": "Nước chanh muối Revive 500ml",
        "category": ServiceCategory.NUOC.value,
        "description": "Nước bù khoáng vị chanh muối giải khát",
        "unit": "Chai",
        "price": Decimal("15000.00"),
        "stock_quantity": 85,
        "status": ServiceStatus.ACTIVE.value,
    },
    {
        "name": "Trà xanh Không Độ 500ml",
        "category": ServiceCategory.NUOC.value,
        "description": "Trà xanh đóng chai giải nhiệt thanh mát",
        "unit": "Chai",
        "price": Decimal("15000.00"),
        "stock_quantity": 60,
        "status": ServiceStatus.ACTIVE.value,
    },

    # 2. ỐNG CẦU (4 món)
    {
        "name": "Ống cầu lông Yonex Aerosensa 50",
        "category": ServiceCategory.ONG_CAU.value,
        "description": "Ống 12 quả cầu lông tiêu chuẩn thi đấu",
        "unit": "Ống",
        "price": Decimal("520000.00"),
        "stock_quantity": 20,
        "status": ServiceStatus.ACTIVE.value,
    },
    {
        "name": "Ống cầu lông Victor Master No.1",
        "category": ServiceCategory.ONG_CAU.value,
        "description": "Ống 12 quả lông vũ độ bền cao, bay đầm",
        "unit": "Ống",
        "price": Decimal("450000.00"),
        "stock_quantity": 25,
        "status": ServiceStatus.ACTIVE.value,
    },
    {
        "name": "Ống cầu lông Ba Sao Pro",
        "category": ServiceCategory.ONG_CAU.value,
        "description": "Ống 12 quả cầu lông Ba Sao tập luyện và thi đấu",
        "unit": "Ống",
        "price": Decimal("220000.00"),
        "stock_quantity": 40,
        "status": ServiceStatus.ACTIVE.value,
    },
    {
        "name": "Quả cầu lông lẻ Ba Sao Pro",
        "category": ServiceCategory.ONG_CAU.value,
        "description": "Bán lẻ từng quả cầu lông Ba Sao Pro",
        "unit": "Quả",
        "price": Decimal("20000.00"),
        "stock_quantity": 100,
        "status": ServiceStatus.ACTIVE.value,
    },

    # 3. THUÊ VỢT (2 món)
    {
        "name": "Thuê vợt Yonex Astrox",
        "category": ServiceCategory.THUE_VOT.value,
        "description": "Cho thuê vợt Yonex thân dẻo trợ lực tốt",
        "unit": "Cây/Lượt",
        "price": Decimal("50000.00"),
        "stock_quantity": 15,
        "status": ServiceStatus.ACTIVE.value,
    },
    {
        "name": "Thuê vợt Lining Windstorm",
        "category": ServiceCategory.THUE_VOT.value,
        "description": "Cho thuê vợt Lining siêu nhẹ, dễ thủ",
        "unit": "Cây/Lượt",
        "price": Decimal("40000.00"),
        "stock_quantity": 12,
        "status": ServiceStatus.ACTIVE.value,
    },

    # 4. KHÁC (3 món)
    {
        "name": "Quấn cán vợt Yonex AC102EX",
        "category": ServiceCategory.KHAC.value,
        "description": "Quấn cán cao su non bám tay, thấm mồ hôi",
        "unit": "Cái",
        "price": Decimal("35000.00"),
        "stock_quantity": 60,
        "status": ServiceStatus.ACTIVE.value,
    },
    {
        "name": "Tất thi đấu Victor chống trượt",
        "category": ServiceCategory.KHAC.value,
        "description": "Tất sợi cotton có hạt silicon chống trượt",
        "unit": "Đôi",
        "price": Decimal("45000.00"),
        "stock_quantity": 30,
        "status": ServiceStatus.ACTIVE.value,
    },
    {
        "name": "Băng cổ tay thấm mồ hôi Yonex",
        "category": ServiceCategory.KHAC.value,
        "description": "Băng bảo vệ cổ tay thể thao co giãn êm",
        "unit": "Cái",
        "price": Decimal("30000.00"),
        "stock_quantity": 25,
        "status": ServiceStatus.ACTIVE.value,
    },
]


def seed_initial_services():
    """Tự động chèn 15 dịch vụ mẫu và ghi nhận log nhập kho nếu bảng trống."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        count = db.scalar(select(func.count()).select_from(Service)) or 0
        if count == 0:
            print("[SEED] Bắt đầu chèn 15 dịch vụ mẫu...")
            for item in SAMPLE_SERVICES:
                svc = Service(**item)
                db.add(svc)
                db.flush()

                # Ghi nhận log nhập hàng ban đầu
                log = ServiceStockLog(
                    service_id=svc.id,
                    change_type=StockChangeType.IMPORT.value,
                    quantity_change=svc.stock_quantity,
                    quantity_before=0,
                    quantity_after=svc.stock_quantity,
                    note="Khởi tạo tồn kho ban đầu",
                )
                db.add(log)

            db.commit()
            print(f"[SEED] Đã chèn thành công {len(SAMPLE_SERVICES)} dịch vụ.")
        else:
            print(f"[SEED] Bảng services đã có {count} bản ghi, bỏ qua.")
    except Exception as e:
        db.rollback()
        print(f"[SEED] Lỗi: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_initial_services()
