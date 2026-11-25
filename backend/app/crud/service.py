"""CRUD cho bảng services (Quản lý dịch vụ và tồn kho)."""
import csv
import io
from datetime import date, datetime, time
from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.service import Service, ServiceCategory, ServiceStatus
from app.models.service_stock_log import ServiceStockLog, StockChangeType
from app.schemas.service import ServiceCreate, ServiceUpdate


def get_services(
    db: Session,
    keyword: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
) -> list[Service]:
    """Lấy danh sách dịch vụ, có thể lọc theo từ khoá, loại hoặc trạng thái. Loại trừ DELETED khỏi web."""
    query = select(Service).order_by(Service.id.asc())

    # Luôn loại trừ các dịch vụ đã xóa (Soft Delete) khỏi danh sách web
    query = query.where(Service.status.notin_(["DELETED", "Deleted"]), ~Service.name.like("[DELETED]%"))

    if keyword:
        query = query.where(Service.name.contains(keyword))
    if category:
        query = query.where(Service.category == category)
    if status:
        query = query.where(Service.status == status)

    return list(db.scalars(query))


def get_service(db: Session, service_id: int) -> Optional[Service]:
    """Tìm 1 dịch vụ theo ID."""
    return db.get(Service, service_id)


def map_category(cat: Optional[str]) -> str:
    """Chuyển đổi category về chuẩn MySQL: NUOC, ONG_CAU, THUE_VOT, KHAC."""
    if not cat:
        return "KHAC"
    val = str(cat.value if hasattr(cat, "value") else cat).upper()
    if val in ["DRINK", "NƯỚC", "NUOC"]:
        return "NUOC"
    if val in ["SHUTTLECOCK", "ỐNG CẦU", "ONG_CAU", "ONG CAU"]:
        return "ONG_CAU"
    if val in ["RACKET_RENTAL", "THUÊ VỢT", "THUE_VOT", "THUE VOT"]:
        return "THUE_VOT"
    return "KHAC"


def map_status(st: Optional[str]) -> str:
    """Chuyển đổi status về chuẩn MySQL: ACTIVE, INACTIVE."""
    if not st:
        return "ACTIVE"
    val = str(st.value if hasattr(st, "value") else st).upper()
    if val in ["ACTIVE", "HOẠT ĐỘNG"]:
        return "ACTIVE"
    return "INACTIVE"


def create_service(db: Session, data: ServiceCreate) -> Service:
    """Tạo mới một dịch vụ. Nếu có tồn kho ban đầu thì ghi nhận log nhập hàng."""
    service_dict = data.model_dump()
    if "unit_price" in service_dict:
        service_dict["price"] = service_dict.pop("unit_price")

    if "category" in service_dict:
        service_dict["category"] = map_category(service_dict["category"])
    if "status" in service_dict:
        service_dict["status"] = map_status(service_dict["status"])

    service = Service(**service_dict)
    db.add(service)
    db.commit()
    db.refresh(service)

    # Nếu có tồn kho ban đầu > 0, tự động ghi 1 log nhập kho
    if service.stock_quantity > 0:
        log = ServiceStockLog(
            service_id=service.id,
            change_type=StockChangeType.IMPORT,
            quantity_change=service.stock_quantity,
            quantity_before=0,
            quantity_after=service.stock_quantity,
            note="Khởi tạo số lượng tồn kho ban đầu khi tạo dịch vụ",
        )
        db.add(log)
        db.commit()

    return service


def update_service(db: Session, service: Service, data: ServiceUpdate) -> Service:
    """Cập nhật thông tin dịch vụ."""
    update_data = data.model_dump(exclude_unset=True)
    if "unit_price" in update_data:
        update_data["price"] = update_data.pop("unit_price")

    if "category" in update_data:
        update_data["category"] = map_category(update_data["category"])
    if "status" in update_data:
        update_data["status"] = map_status(update_data["status"])

    for field, value in update_data.items():
        setattr(service, field, value)

    db.commit()
    db.refresh(service)
    return service


def deactivate_service(db: Session, service: Service) -> Service:
    """Tạm ngừng cung cấp dịch vụ (chuyển trạng thái sang Inactive, có thể mở bán lại)."""
    service.status = ServiceStatus.INACTIVE
    db.commit()
    db.refresh(service)
    return service


def activate_service(db: Session, service: Service) -> Service:
    """Mở bán lại dịch vụ (chuyển trạng thái sang Active)."""
    service.status = ServiceStatus.ACTIVE
    db.commit()
    db.refresh(service)
    return service


def delete_service(db: Session, service: Service) -> Service:
    """Xóa dịch vụ (Soft Delete: chuyển sang DELETED để ẩn vĩnh viễn khỏi web nhưng giữ trong DB)."""
    try:
        service.status = ServiceStatus.DELETED
        db.commit()
        db.refresh(service)
    except Exception:
        db.rollback()
        try:
            from sqlalchemy import text
            db.execute(text("ALTER TABLE services MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Active'"))
            db.commit()
            service.status = ServiceStatus.DELETED
            db.commit()
            db.refresh(service)
        except Exception:
            db.rollback()
            service.status = ServiceStatus.INACTIVE
            if not service.name.startswith("[DELETED]"):
                service.name = f"[DELETED] {service.name}"
            db.commit()
            db.refresh(service)
    return service


# ====================================================================
# CÁC HÀM QUẢN LÝ KHO, NHẬP HÀNG, ĐIỀU CHỈNH & TRỪ/HOÀN KHO DÙNG CHUNG
# ====================================================================

def import_stock(db: Session, service: Service, quantity: int, note: Optional[str] = "Nhập thêm hàng") -> ServiceStockLog:
    """Nhập thêm hàng vào kho và ghi nhận ServiceStockLog."""
    if quantity <= 0:
        raise ValueError("Số lượng nhập hàng phải lớn hơn 0.")

    qty_before = service.stock_quantity
    service.stock_quantity += quantity
    qty_after = service.stock_quantity

    log = ServiceStockLog(
        service_id=service.id,
        change_type=StockChangeType.IMPORT,
        quantity_change=quantity,
        quantity_before=qty_before,
        quantity_after=qty_after,
        note=note or "Nhập thêm hàng",
    )
    db.add(log)
    db.commit()
    db.refresh(service)
    db.refresh(log)
    return log


def adjust_stock(db: Session, service: Service, actual_quantity: int, note: str) -> ServiceStockLog:
    """Điều chỉnh tồn kho khi kiểm kê (bắt buộc phải có lý do note)."""
    if actual_quantity < 0:
        raise ValueError("Số lượng tồn kho thực tế không được nhỏ hơn 0.")
    if not note or not note.strip():
        raise ValueError("Lý do điều chỉnh tồn kho là bắt buộc.")

    qty_before = service.stock_quantity
    change = actual_quantity - qty_before
    service.stock_quantity = actual_quantity

    log = ServiceStockLog(
        service_id=service.id,
        change_type=StockChangeType.ADJUSTMENT,
        quantity_change=change,
        quantity_before=qty_before,
        quantity_after=actual_quantity,
        note=note.strip(),
    )
    db.add(log)
    db.commit()
    db.refresh(service)
    db.refresh(log)
    return log


def deduct_stock(
    db: Session,
    service_id: int,
    quantity: int,
    note: str = "Xuất kho bán hàng",
    change_type: StockChangeType = StockChangeType.EXPORT,
    commit: bool = True,
) -> Service:
    """Hàm dùng chung để trừ kho trong transaction.

    Bắt buộc không cho phép tồn âm (raise ValueError nếu không đủ hàng).
    """
    if quantity <= 0:
        raise ValueError("Số lượng cần trừ phải lớn hơn 0.")

    service = db.get(Service, service_id)
    if not service:
        raise ValueError(f"Không tìm thấy dịch vụ id={service_id}")

    # Chặn không cho tồn âm
    if service.stock_quantity < quantity:
        raise ValueError(
            f"Không đủ hàng trong kho. '{service.name}' hiện chỉ còn {service.stock_quantity}, không đủ để xuất {quantity}."
        )

    qty_before = service.stock_quantity
    service.stock_quantity -= quantity
    qty_after = service.stock_quantity

    log = ServiceStockLog(
        service_id=service.id,
        change_type=change_type,
        quantity_change=-quantity,
        quantity_before=qty_before,
        quantity_after=qty_after,
        note=note,
    )
    db.add(log)

    if commit:
        db.commit()
        db.refresh(service)

    return service


def restore_stock(
    db: Session,
    service_id: int,
    quantity: int,
    note: str = "Hoàn trả tồn kho",
    change_type: StockChangeType = StockChangeType.ADJUSTMENT,
    commit: bool = True,
) -> Service:
    """Hàm dùng chung để hoàn lại kho trong transaction (ví dụ: huỷ đơn hoặc trả hàng)."""
    if quantity <= 0:
        raise ValueError("Số lượng cần hoàn trả phải lớn hơn 0.")

    service = db.get(Service, service_id)
    if not service:
        raise ValueError(f"Không tìm thấy dịch vụ id={service_id}")

    qty_before = service.stock_quantity
    service.stock_quantity += quantity
    qty_after = service.stock_quantity

    log = ServiceStockLog(
        service_id=service.id,
        change_type=change_type,
        quantity_change=quantity,
        quantity_before=qty_before,
        quantity_after=qty_after,
        note=note,
    )
    db.add(log)

    if commit:
        db.commit()
        db.refresh(service)

    return service


def get_low_stock_services(db: Session, threshold: int = 10) -> list[Service]:
    """Lấy danh sách các dịch vụ đang hoạt động có số lượng tồn kho <= ngưỡng cảnh báo."""
    query = (
        select(Service)
        .where(Service.status.in_(["ACTIVE", "Active"]), Service.stock_quantity <= threshold)
        .order_by(Service.stock_quantity.asc())
    )
    return list(db.scalars(query))


def get_stock_logs(db: Session, service_id: int) -> list[ServiceStockLog]:
    """Lấy lịch sử biến động kho của 1 dịch vụ."""
    query = (
        select(ServiceStockLog)
        .where(ServiceStockLog.service_id == service_id)
        .order_by(ServiceStockLog.id.desc())
    )
    return list(db.scalars(query))


# ====================================================================
# NGHIỆP VỤ THUÊ VỢT (DÙNG DEDUCT & RESTORE STOCK)
# ====================================================================

def rent_racket(db: Session, service: Service, quantity: int = 1) -> Service:
    """Thuê vợt theo lượt: tạm giữ số lượng trong kho trong thời gian khách chơi."""
    if service.category not in [ServiceCategory.THUE_VOT, ServiceCategory.RACKET_RENTAL]:
        raise ValueError("Dịch vụ này không phải là dịch vụ thuê vợt.")

    return deduct_stock(
        db=db,
        service_id=service.id,
        quantity=quantity,
        note=f"Cho thuê {quantity} cây vợt theo lượt (tạm giữ kho)",
        change_type=StockChangeType.SALE,
        commit=True,
    )


def return_racket(db: Session, service: Service, quantity: int = 1) -> Service:
    """Trả vợt sau khi kết thúc lượt thuê: hoàn lại số lượng khả dụng vào kho."""
    if service.category not in [ServiceCategory.THUE_VOT, ServiceCategory.RACKET_RENTAL]:
        raise ValueError("Dịch vụ này không phải là dịch vụ thuê vợt.")

    return restore_stock(
        db=db,
        service_id=service.id,
        quantity=quantity,
        note=f"Khách trả {quantity} cây vợt sau khi kết thúc lượt thuê (hoàn kho)",
        change_type=StockChangeType.ADJUSTMENT,
        commit=True,
    )


# ====================================================================
# [T3D32A7] XUẤT BÁO CÁO KHO DỊCH VỤ RA CSV & TRUY VẤN LOG THEO THỜI GIAN
# ====================================================================

def get_filtered_stock_logs(
    db: Session,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    service_id: Optional[int] = None,
    change_type: Optional[str] = None,
    limit: Optional[int] = None,
) -> list[ServiceStockLog]:
    """Lấy danh sách biến động kho lọc theo khoảng thời gian, ID dịch vụ hoặc loại giao dịch."""
    query = select(ServiceStockLog).options(joinedload(ServiceStockLog.service))

    if service_id:
        query = query.where(ServiceStockLog.service_id == service_id)

    if change_type and change_type.strip():
        ct = change_type.strip()
        query = query.where(ServiceStockLog.change_type.ilike(f"%{ct}%"))

    if from_date:
        start_dt = datetime.combine(from_date, time.min)
        query = query.where(ServiceStockLog.created_at >= start_dt)

    if to_date:
        end_dt = datetime.combine(to_date, time.max)
        query = query.where(ServiceStockLog.created_at <= end_dt)

    query = query.order_by(ServiceStockLog.created_at.desc(), ServiceStockLog.id.desc())
    if limit:
        query = query.limit(limit)

    return list(db.scalars(query).unique())


def generate_inventory_csv(services: list[Service]) -> bytes:
    """Tạo nội dung file CSV báo cáo tồn kho hiện tại (UTF-8 BOM tương thích Excel)."""
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    # Tiêu đề các cột
    writer.writerow([
        "Mã dịch vụ",
        "Tên dịch vụ",
        "Danh mục",
        "Đơn vị tính",
        "Đơn giá (VNĐ)",
        "Số lượng tồn",
        "Trạng thái",
        "Cảnh báo tồn kho",
        "Giá trị tồn kho (VNĐ)",
    ])

    cat_map = {
        "NUOC": "Nước uống",
        "DRINK": "Nước uống",
        "ONG_CAU": "Ống cầu",
        "SHUTTLECOCK": "Ống cầu",
        "THUE_VOT": "Thuê vợt",
        "RACKET_RENTAL": "Thuê vợt",
        "KHAC": "Phụ kiện / Khác",
        "ACCESSORY": "Phụ kiện / Khác",
        "OTHER": "Phụ kiện / Khác",
    }

    for s in services:
        cat_label = cat_map.get(str(s.category).upper(), s.category or "Khác")
        price_val = float(s.price or 0)
        stock_val = int(s.stock_quantity or 0)
        total_val = price_val * stock_val

        # Cảnh báo tồn
        if stock_val == 0:
            warning = "Hết hàng"
        elif stock_val <= 10:
            warning = "Sắp hết hàng (<= 10)"
        else:
            warning = "Đủ hàng"

        status_label = "Đang hoạt động" if str(s.status).upper() in ["ACTIVE", "Active"] else "Ngừng hoạt động"

        writer.writerow([
            f"SVC-{s.id:03d}",
            s.name,
            cat_label,
            s.unit or "cái",
            f"{price_val:,.0f}",
            stock_val,
            status_label,
            warning,
            f"{total_val:,.0f}",
        ])

    return output.getvalue().encode("utf-8-sig")


def generate_stock_logs_csv(logs: list[ServiceStockLog]) -> bytes:
    """Tạo nội dung file CSV lịch sử nhập/xuất kho theo khoảng thời gian (UTF-8 BOM)."""
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    # Tiêu đề các cột
    writer.writerow([
        "Mã log",
        "Thời gian",
        "Mã dịch vụ",
        "Tên dịch vụ",
        "Danh mục",
        "Loại giao dịch",
        "Số lượng thay đổi",
        "Tồn trước",
        "Tồn sau",
        "Lý do / Ghi chú",
    ])

    type_map = {
        "IMPORT": "Nhập kho",
        "Nhập hàng": "Nhập kho",
        "EXPORT": "Xuất kho",
        "SALE": "Bán hàng POS",
        "Bán lẻ": "Bán hàng POS",
        "ADJUSTMENT": "Điều chỉnh kiểm kê",
        "Điều chỉnh": "Điều chỉnh kiểm kê",
    }

    cat_map = {
        "NUOC": "Nước uống",
        "DRINK": "Nước uống",
        "ONG_CAU": "Ống cầu",
        "SHUTTLECOCK": "Ống cầu",
        "THUE_VOT": "Thuê vợt",
        "RACKET_RENTAL": "Thuê vợt",
        "KHAC": "Phụ kiện / Khác",
        "ACCESSORY": "Phụ kiện / Khác",
        "OTHER": "Phụ kiện / Khác",
    }

    for log in logs:
        s = log.service
        s_code = f"SVC-{s.id:03d}" if s else f"SVC-{log.service_id:03d}"
        s_name = s.name if s else "Không rõ"
        s_cat = cat_map.get(str(s.category).upper(), s.category or "") if s else ""
        t_label = type_map.get(str(log.change_type), log.change_type)
        dt_str = log.created_at.strftime("%Y-%m-%d %H:%M:%S") if log.created_at else ""
        qty_change = f"+{log.quantity_change}" if log.quantity_change > 0 else str(log.quantity_change)

        writer.writerow([
            f"LOG-{log.id:04d}",
            dt_str,
            s_code,
            s_name,
            s_cat,
            t_label,
            qty_change,
            log.quantity_before,
            log.quantity_after,
            log.note or "",
        ])

    return output.getvalue().encode("utf-8-sig")
