"""CRUD cho bảng services (Quản lý dịch vụ và tồn kho)."""
from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.service import Service, ServiceCategory, ServiceStatus
from app.models.service_stock_log import ServiceStockLog, StockChangeType
from app.schemas.service import ServiceCreate, ServiceUpdate


def get_services(
    db: Session,
    keyword: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
) -> list[Service]:
    """Lấy danh sách dịch vụ, có thể lọc theo từ khoá, loại hoặc trạng thái."""
    query = select(Service).order_by(Service.id.asc())

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


def create_service(db: Session, data: ServiceCreate) -> Service:
    """Tạo mới một dịch vụ. Nếu có tồn kho ban đầu thì ghi nhận log nhập hàng."""
    service_dict = data.model_dump()
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
    for field, value in update_data.items():
        setattr(service, field, value)

    db.commit()
    db.refresh(service)
    return service


def deactivate_service(db: Session, service: Service) -> Service:
    """Ngừng cung cấp dịch vụ (chuyển trạng thái sang Inactive, không xoá cứng khỏi DB)."""
    service.status = ServiceStatus.INACTIVE
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
        .where(Service.status == ServiceStatus.ACTIVE, Service.stock_quantity <= threshold)
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
