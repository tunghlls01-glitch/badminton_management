"""API CRUD cho Dịch vụ và Quản lý Tồn kho / Thuê Vợt. Đường dẫn đầy đủ: /api/services

    GET    /api/services                     Lấy danh sách dịch vụ (?q=..., ?category=..., ?status=...)
    GET    /api/services/low-stock           Danh sách dịch vụ sắp hết hàng (?threshold=10)
    GET    /api/services/{id}                Lấy chi tiết 1 dịch vụ
    POST   /api/services                     Thêm mới dịch vụ (giá > 0)
    PUT    /api/services/{id}                Cập nhật thông tin dịch vụ
    DELETE /api/services/{id}                Ngừng cung cấp dịch vụ (chuyển trạng thái Inactive)
    PATCH  /api/services/{id}/deactivate     Ngừng cung cấp dịch vụ
    POST   /api/services/{id}/rent           Thuê vợt theo lượt (tạm giữ kho, không trừ vĩnh viễn)
    POST   /api/services/{id}/return         Trả vợt sau khi kết thúc lượt thuê (hoàn lại kho)
    POST   /api/services/{id}/import         Nhập thêm hàng vào kho (ghi ServiceStockLog)
    POST   /api/services/{id}/adjust         Điều chỉnh tồn kho kiểm kê có lý do (ghi ServiceStockLog)
    GET    /api/services/{id}/stock-logs     Xem lịch sử biến động kho của dịch vụ
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.crud import service as service_crud
from app.db.session import get_db
from app.models.service import ServiceCategory, ServiceStatus
from app.schemas.service import ServiceCreate, ServiceOut, ServiceUpdate
from app.schemas.service_stock_log import (
    ServiceStockLogOut,
    StockAdjustRequest,
    StockImportRequest,
)

router = APIRouter(prefix="/services", tags=["Services"])


def get_service_or_404(service_id: int, db: Session = Depends(get_db)):
    """Hàm phụ trợ tìm dịch vụ hoặc trả về lỗi 404."""
    service = service_crud.get_service(db, service_id)
    if service is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy dịch vụ có id={service_id}",
        )
    return service


@router.get("", response_model=list[ServiceOut])
def list_services(
    q: Optional[str] = Query(None, description="Tìm kiếm theo tên dịch vụ"),
    category: Optional[ServiceCategory] = Query(None, description="Lọc theo loại dịch vụ"),
    status: Optional[ServiceStatus] = Query(None, description="Lọc theo trạng thái"),
    db: Session = Depends(get_db),
):
    """Lấy danh sách dịch vụ có lọc và tìm kiếm."""
    category_val = category.value if category else None
    status_val = status.value if status else None
    return service_crud.get_services(db, keyword=q, category=category_val, status=status_val)


@router.get("/low-stock", response_model=list[ServiceOut])
def list_low_stock_services(
    threshold: int = Query(10, ge=0, description="Ngưỡng cảnh báo tồn kho (mặc định <= 10)"),
    db: Session = Depends(get_db),
):
    """Lấy danh sách các dịch vụ sắp hết hàng (tồn kho <= threshold)."""
    return service_crud.get_low_stock_services(db, threshold=threshold)


@router.get("/{service_id}", response_model=ServiceOut)
def get_service_detail(service=Depends(get_service_or_404)):
    """Xem chi tiết một dịch vụ."""
    return service


@router.post("", response_model=ServiceOut, status_code=status.HTTP_201_CREATED)
def create_service(data: ServiceCreate, db: Session = Depends(get_db)):
    """Thêm mới dịch vụ. Bắt buộc giá bán phải > 0."""
    if data.price <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Giá dịch vụ phải lớn hơn 0.",
        )
    return service_crud.create_service(db, data)


@router.put("/{service_id}", response_model=ServiceOut)
def update_service(
    data: ServiceUpdate,
    service=Depends(get_service_or_404),
    db: Session = Depends(get_db),
):
    """Cập nhật thông tin dịch vụ. Nếu sửa giá thì giá mới cũng phải > 0."""
    if data.unit_price is not None and data.unit_price <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Giá dịch vụ phải lớn hơn 0.",
        )
    return service_crud.update_service(db, service, data)


@router.delete("/{service_id}", response_model=ServiceOut)
def delete_service(service=Depends(get_service_or_404), db: Session = Depends(get_db)):
    """Ngừng dịch vụ (chuyển status sang Inactive để giữ lịch sử hóa đơn)."""
    return service_crud.deactivate_service(db, service)


@router.patch("/{service_id}/deactivate", response_model=ServiceOut)
def deactivate_service(service=Depends(get_service_or_404), db: Session = Depends(get_db)):
    """Ngừng cung cấp dịch vụ."""
    return service_crud.deactivate_service(db, service)


@router.post("/{service_id}/rent", response_model=ServiceOut)
def rent_racket(
    quantity: int = Query(1, ge=1, description="Số lượng vợt thuê"),
    service=Depends(get_service_or_404),
    db: Session = Depends(get_db),
):
    """Thuê vợt theo lượt: tạm giữ số lượng trong kho, không trừ vĩnh viễn."""
    try:
        return service_crud.rent_racket(db, service, quantity=quantity)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err))


@router.post("/{service_id}/return", response_model=ServiceOut)
def return_racket(
    quantity: int = Query(1, ge=1, description="Số lượng vợt trả"),
    service=Depends(get_service_or_404),
    db: Session = Depends(get_db),
):
    """Khách trả vợt sau khi kết thúc lượt thuê: hoàn trả số lượng lại vào kho."""
    try:
        return service_crud.return_racket(db, service, quantity=quantity)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err))


# ====================================================================
# API QUẢN LÝ KHO (NHẬP HÀNG, ĐIỀU CHỈNH & LỊCH SỬ KHO)
# ====================================================================

@router.post("/{service_id}/import", response_model=ServiceStockLogOut)
def import_service_stock(
    data: StockImportRequest,
    service=Depends(get_service_or_404),
    db: Session = Depends(get_db),
):
    """Nhập thêm hàng vào kho và tự động ghi ServiceStockLog."""
    try:
        return service_crud.import_stock(db, service, quantity=data.quantity, note=data.note)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err))


@router.post("/{service_id}/adjust", response_model=ServiceStockLogOut)
def adjust_service_stock(
    data: StockAdjustRequest,
    service=Depends(get_service_or_404),
    db: Session = Depends(get_db),
):
    """Điều chỉnh tồn kho khi kiểm kê (bắt buộc phải có lý do note) và ghi ServiceStockLog."""
    try:
        return service_crud.adjust_stock(db, service, actual_quantity=data.actual_quantity, note=data.note)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err))


@router.get("/{service_id}/stock-logs", response_model=list[ServiceStockLogOut])
def get_service_stock_logs(
    service=Depends(get_service_or_404),
    db: Session = Depends(get_db),
):
    """Xem lịch sử biến động kho của dịch vụ."""
    return service_crud.get_stock_logs(db, service.id)
