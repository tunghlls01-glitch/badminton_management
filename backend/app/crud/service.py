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


def rent_racket(db: Session, service: Service, quantity: int = 1) -> Service:
    """Thuê vợt theo lượt: tạm giữ số lượng trong kho trong thời gian khách chơi.

    Lưu ý: Không trừ kho vĩnh viễn, khi kết thúc khách trả lại thì gọi return_racket().
    """
    if service.category != ServiceCategory.THUE_VOT:
        raise ValueError("Dịch vụ này không phải là dịch vụ thuê vợt.")

    if service.stock_quantity < quantity:
        raise ValueError(f"Không đủ vợt để cho thuê. Trong kho còn {service.stock_quantity} cây.")

    qty_before = service.stock_quantity
    service.stock_quantity -= quantity
    qty_after = service.stock_quantity

    # Ghi nhận log mượn vợt
    log = ServiceStockLog(
        service_id=service.id,
        change_type=StockChangeType.SALE,
        quantity_change=-quantity,
        quantity_before=qty_before,
        quantity_after=qty_after,
        note=f"Cho thuê {quantity} cây vợt theo lượt (tạm giữ kho)",
    )
    db.add(log)
    db.commit()
    db.refresh(service)
    return service


def return_racket(db: Session, service: Service, quantity: int = 1) -> Service:
    """Trả vợt sau khi kết thúc lượt thuê: hoàn lại số lượng khả dụng vào kho."""
    if service.category != ServiceCategory.THUE_VOT:
        raise ValueError("Dịch vụ này không phải là dịch vụ thuê vợt.")

    qty_before = service.stock_quantity
    service.stock_quantity += quantity
    qty_after = service.stock_quantity

    # Ghi nhận log trả vợt về kho
    log = ServiceStockLog(
        service_id=service.id,
        change_type=StockChangeType.ADJUSTMENT,
        quantity_change=quantity,
        quantity_before=qty_before,
        quantity_after=qty_after,
        note=f"Khách trả {quantity} cây vợt sau khi kết thúc lượt thuê (hoàn kho)",
    )
    db.add(log)
    db.commit()
    db.refresh(service)
    return service
