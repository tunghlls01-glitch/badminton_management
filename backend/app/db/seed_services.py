"""Dữ liệu mẫu 15 dịch vụ cho sân cầu lông và hàm seed tự động."""
from decimal import Decimal
from sqlalchemy import func, select
from app.db.session import Base, engine, SessionLocal
from app.models import (
    Service,
    ServiceCategory,
    ServiceStatus,
    ServiceStockLog,
    StockChangeType,
)

SAMPLE_SERVICES = [
    # ---- 1. NƯỚC (6 món) ----
    {
        "name": "Nước khoáng Lavie 500ml",
        "category": ServiceCategory.NUOC,
        "description": "Nước khoáng thiên nhiên đóng chai ướp lạnh",
        "unit": "Chai",
        "price": Decimal("10000.00"),
        "stock_quantity": 120,
        "status": ServiceStatus.ACTIVE,
    },
    {
        "name": "Nước tinh khiết Aquafina 500ml",
        "category": ServiceCategory.NUOC,
        "description": "Nước tinh khiết đóng chai ướp lạnh",
        "unit": "Chai",
        "price": Decimal("10000.00"),
        "stock_quantity": 100,
        "status": ServiceStatus.ACTIVE,
    },
    {
        "name": "Nước tăng lực Red Bull 250ml",
        "category": ServiceCategory.NUOC,
        "description": "Nước tăng lực bò húc Thái Lan bổ sung năng lượng",
        "unit": "Lon",
        "price": Decimal("20000.00"),
        "stock_quantity": 80,
        "status": ServiceStatus.ACTIVE,
    },
    {
        "name": "Nước điện giải Pocari Sweat 500ml",
        "category": ServiceCategory.NUOC,
        "description": "Thức uống bù nước và ion khoáng thể thao chuyên dụng",
        "unit": "Chai",
        "price": Decimal("20000.00"),
        "stock_quantity": 90,
        "status": ServiceStatus.ACTIVE,
    },
    {
        "name": "Nước chanh muối Revive 500ml",
        "category": ServiceCategory.NUOC,
        "description": "Nước bù khoáng Isotonic vị chanh muối giải khát",
        "unit": "Chai",
        "price": Decimal("15000.00"),
        "stock_quantity": 85,
        "status": ServiceStatus.ACTIVE,
    },
    {
        "name": "Trà xanh Không Độ 500ml",
        "category": ServiceCategory.NUOC,
        "description": "Trà xanh đóng chai giải nhiệt thanh mát",
        "unit": "Chai",
        "price": Decimal("15000.00"),
        "stock_quantity": 60,
        "status": ServiceStatus.ACTIVE,
    },

    # ---- 2. ỐNG CẦU (4 món) ----
    {
        "name": "Ống cầu lông Yonex Aerosensa 50",
        "category": ServiceCategory.ONG_CAU,
        "description": "Ống 12 quả cầu lông cao cấp tiêu chuẩn thi đấu quốc tế",
        "unit": "Ống",
        "price": Decimal("520000.00"),
        "stock_quantity": 20,
        "status": ServiceStatus.ACTIVE,
    },
    {
        "name": "Ống cầu lông Victor Master No.1",
        "category": ServiceCategory.ONG_CAU,
        "description": "Ống 12 quả lông vũ độ bền cao, bay đầm và chuẩn xác",
        "unit": "Ống",
        "price": Decimal("450000.00"),
        "stock_quantity": 25,
        "status": ServiceStatus.ACTIVE,
    },
    {
        "name": "Ống cầu lông Ba Sao Pro",
        "category": ServiceCategory.ONG_CAU,
        "description": "Ống 12 quả cầu lông Ba Sao chất lượng cao tập luyện và thi đấu",
        "unit": "Ống",
        "price": Decimal("220000.00"),
        "stock_quantity": 40,
        "status": ServiceStatus.ACTIVE,
    },
    {
        "name": "Quả cầu lông lẻ Ba Sao Pro",
        "category": ServiceCategory.ONG_CAU,
        "description": "Bán lẻ từng quả cầu lông Ba Sao Pro sử dụng ngay trên sân",
        "unit": "Quả",
        "price": Decimal("20000.00"),
        "stock_quantity": 100,
        "status": ServiceStatus.ACTIVE,
    },

    # ---- 3. THUÊ VỢT (2 món) ----
    {
        "name": "Thuê vợt Yonex Astrox",
        "category": ServiceCategory.THUE_VOT,
        "description": "Cho thuê vợt cầu lông Yonex thân dẻo, đầm đầu trợ lực tốt",
        "unit": "Cây/Lượt",
        "price": Decimal("50000.00"),
        "stock_quantity": 15,
        "status": ServiceStatus.ACTIVE,
    },
    {
        "name": "Thuê vợt Lining Windstorm",
        "category": ServiceCategory.THUE_VOT,
        "description": "Cho thuê vợt cầu lông Lining trọng lượng siêu nhẹ, dễ vung thủ",
        "unit": "Cây/Lượt",
        "price": Decimal("40000.00"),
        "stock_quantity": 12,
        "status": ServiceStatus.ACTIVE,
    },

    # ---- 4. KHÁC / PHỤ KIỆN (3 món) ----
    {
        "name": "Quấn cán vợt Yonex AC102EX",
        "category": ServiceCategory.KHAC,
        "description": "Quấn cán cao su non bám tay, thấm hút mồ hôi tối đa",
        "unit": "Cái",
        "price": Decimal("35000.00"),
        "stock_quantity": 60,
        "status": ServiceStatus.ACTIVE,
    },
    {
        "name": "Tất thi đấu Victor chống trượt",
        "category": ServiceCategory.KHAC,
        "description": "Tất dệt sợi cotton dày dặn có hạt silicon chống trượt chân",
        "unit": "Đôi",
        "price": Decimal("45000.00"),
        "stock_quantity": 30,
        "status": ServiceStatus.ACTIVE,
    },
    {
        "name": "Băng cổ tay thấm mồ hôi Yonex",
        "category": ServiceCategory.KHAC,
        "description": "Băng bảo vệ cổ tay thể thao co giãn êm ái",
        "unit": "Cái",
        "price": Decimal("30000.00"),
        "stock_quantity": 25,
        "status": ServiceStatus.ACTIVE,
    },
]


def seed_initial_services():
    """Hàm tự động chèn 15 dịch vụ mẫu và ghi nhận log nhập kho nếu bảng trống."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        count = db.scalar(select(func.count()).select_from(Service)) or 0
        if count == 0:
            print("[SEED] Bảng services đang trống, bắt đầu seed 15 dịch vụ mẫu...")
            for item_data in SAMPLE_SERVICES:
                svc = Service(**item_data)
                db.add(svc)
                db.flush()  # để lấy svc.id

                # Ghi nhận log nhập hàng ban đầu vào ServiceStockLog
                log = ServiceStockLog(
                    service_id=svc.id,
                    created_by=None,
                    change_type=StockChangeType.IMPORT,
                    quantity_change=svc.stock_quantity,
                    quantity_before=0,
                    quantity_after=svc.stock_quantity,
                    note="Khởi tạo tồn kho ban đầu (Initial Seed)",
                )
                db.add(log)

            db.commit()
            print(f"[SEED] Đã seed thành công {len(SAMPLE_SERVICES)} dịch vụ vào cơ sở dữ liệu.")
        else:
            print(f"[SEED] Bảng services đã có sẵn {count} bản ghi, bỏ qua seed.")
    except Exception as e:
        db.rollback()
        print(f"[SEED] Lỗi khi seed services: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_initial_services()
