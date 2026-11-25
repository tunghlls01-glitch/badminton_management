"""API CRUD cho Dịch vụ và Quản lý Tồn kho / Thuê Vợt. Đường dẫn đầy đủ: /api/services

    GET    /api/services                     Lấy danh sách dịch vụ (Công khai xem menu)
    GET    /api/services/low-stock           Danh sách dịch vụ sắp hết hàng (Yêu cầu ADMIN / STAFF)
    GET    /api/services/{id}                Lấy chi tiết 1 dịch vụ (Công khai)
    POST   /api/services                     Thêm mới dịch vụ (Yêu cầu ADMIN / STAFF)
    PUT    /api/services/{id}                Cập nhật thông tin dịch vụ (Yêu cầu ADMIN / STAFF)
    DELETE /api/services/{id}                Ngừng cung cấp dịch vụ (Yêu cầu ADMIN / STAFF)
    PATCH  /api/services/{id}/deactivate     Ngừng cung cấp dịch vụ (Yêu cầu ADMIN / STAFF)
    POST   /api/services/{id}/rent           Thuê vợt theo lượt tại quầy (Yêu cầu ADMIN / STAFF)
    POST   /api/services/{id}/return         Trả vợt sau khi kết thúc lượt thuê (Yêu cầu ADMIN / STAFF)
    POST   /api/services/{id}/import         Nhập thêm hàng vào kho (Yêu cầu ADMIN / STAFF)
    POST   /api/services/{id}/adjust         Điều chỉnh tồn kho kiểm kê có lý do (Yêu cầu ADMIN / STAFF)
    GET    /api/services/{id}/stock-logs     Xem lịch sử biến động kho của dịch vụ (Yêu cầu ADMIN / STAFF)
"""
from datetime import date, datetime
from typing import Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status, File, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.config import BASE_DIR
from app.core.security import get_current_user, require_roles
from app.crud import service as service_crud
from app.db.session import get_db
from app.models.service import ServiceCategory, ServiceStatus
from app.models.user import User, UserRole
from app.schemas.service import ServiceCreate, ServiceOut, ServiceUpdate
from app.schemas.service_stock_log import (
    ServiceStockLogOut,
    StockAdjustRequest,
    StockImportRequest,
)

SERVICE_IMAGE_URL = "/static/uploads/services"
SERVICE_UPLOAD_DIR = BASE_DIR / "static" / "uploads" / "services"
IMAGE_EXTENSIONS = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
IMAGE_TYPES = {extension: mime for mime, extension in IMAGE_EXTENSIONS.items()}
IMAGE_TYPES[".jpeg"] = "image/jpeg"

router = APIRouter(prefix="/services", tags=["Services"])

@router.post("/upload-image")
async def upload_service_image(
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.STAFF)),
):
    """Upload ảnh dịch vụ thực tế. Hỗ trợ PNG, JPG, WebP (tối đa 5MB). Yêu cầu quyền ADMIN hoặc STAFF."""
    extension = IMAGE_EXTENSIONS.get(file.content_type)
    if extension is None:
        raise HTTPException(status_code=400, detail="Ảnh dịch vụ phải có định dạng PNG, JPEG hoặc WebP.")
    max_size = 5 * 1024 * 1024
    content = await file.read(max_size + 1)
    if not content or len(content) > max_size:
        raise HTTPException(status_code=400, detail="Dung lượng ảnh không được vượt quá 5 MB.")

    SERVICE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    unique_filename = f"service_{uuid.uuid4().hex[:12]}{extension}"
    file_path = SERVICE_UPLOAD_DIR / unique_filename
    file_path.write_bytes(content)

    return {"image_url": f"{SERVICE_IMAGE_URL}/{unique_filename}"}


def get_service_or_404(service_id: int, db: Session = Depends(get_db)):
    """Hàm phụ trợ tìm dịch vụ hoặc trả về lỗi 404."""
    service = service_crud.get_service(db, service_id)
    if service is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy dịch vụ có id={service_id}",
        )
    return service


# ====================================================================
# 1. CÁC API CÔNG KHAI (KHÁCH HÀNG & NHÂN VIÊN ĐỀU XEM ĐƯỢC MENU)
# ====================================================================

@router.get("", response_model=list[ServiceOut])
def list_services(
    q: Optional[str] = Query(None, description="Tìm kiếm theo tên dịch vụ"),
    category: Optional[ServiceCategory] = Query(None, description="Lọc theo loại dịch vụ"),
    status: Optional[ServiceStatus] = Query(None, description="Lọc theo trạng thái"),
    db: Session = Depends(get_db),
):
    """Lấy danh sách dịch vụ (Menu đồ uống, cầu, vợt). Công khai cho khách và nhân viên."""
    category_val = category.value if category else None
    status_val = status.value if status else None
    return service_crud.get_services(db, keyword=q, category=category_val, status=status_val)


@router.get("/low-stock", response_model=list[ServiceOut])
def list_low_stock_services(
    threshold: int = Query(10, ge=0, description="Ngưỡng cảnh báo tồn kho (mặc định <= 10)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.STAFF)),
):
    """Lấy danh sách các dịch vụ sắp hết hàng. Chỉ dành cho Quản trị viên (ADMIN) và Nhân viên (STAFF)."""
    return service_crud.get_low_stock_services(db, threshold=threshold)


# ====================================================================
# [T3D32A7] XUẤT BÁO CÁO KHO DỊCH VỤ RA CSV & TRUY VẤN LỊCH SỬ KHO
# ====================================================================

@router.get("/export/inventory-csv")
def export_inventory_csv(
    category: Optional[ServiceCategory] = Query(None, description="Lọc theo loại dịch vụ"),
    status: Optional[ServiceStatus] = Query(None, description="Lọc theo trạng thái"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.STAFF)),
):
    """[T3D32A7] Xuất báo cáo tồn kho dịch vụ ra file CSV (Mã hóa UTF-8 BOM hiển thị chuẩn tiếng Việt trên Excel)."""
    category_val = category.value if category else None
    status_val = status.value if status else None
    services = service_crud.get_services(db, category=category_val, status=status_val)
    csv_bytes = service_crud.generate_inventory_csv(services)

    filename = f"bao_cao_ton_kho_dich_vu_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.get("/export/stock-logs-csv")
def export_stock_logs_csv(
    from_date: Optional[date] = Query(None, description="Từ ngày (YYYY-MM-DD)"),
    to_date: Optional[date] = Query(None, description="Đến ngày (YYYY-MM-DD)"),
    service_id: Optional[int] = Query(None, description="Lọc theo ID dịch vụ"),
    change_type: Optional[str] = Query(None, description="Lọc theo loại giao dịch (IMPORT, SALE, ADJUSTMENT, EXPORT)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.STAFF)),
):
    """[T3D32A7] Xuất lịch sử biến động nhập/xuất dịch vụ theo khoảng thời gian ra file CSV."""
    logs = service_crud.get_filtered_stock_logs(
        db=db,
        from_date=from_date,
        to_date=to_date,
        service_id=service_id,
        change_type=change_type,
    )
    csv_bytes = service_crud.generate_stock_logs_csv(logs)

    date_range_str = ""
    if from_date and to_date:
        date_range_str = f"_{from_date}_{to_date}"
    elif from_date:
        date_range_str = f"_tu_{from_date}"
    elif to_date:
        date_range_str = f"_den_{to_date}"
    else:
        date_range_str = f"_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    filename = f"bao_cao_nhap_xuat_kho{date_range_str}.csv"
    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.get("/export-csv")
def export_csv_unified(
    report_type: str = Query("inventory", description="Loại báo cáo: 'inventory' (tồn kho) hoặc 'stock_logs' / 'history' (lịch sử nhập xuất)"),
    from_date: Optional[date] = Query(None, description="Từ ngày (YYYY-MM-DD)"),
    to_date: Optional[date] = Query(None, description="Đến ngày (YYYY-MM-DD)"),
    service_id: Optional[int] = Query(None, description="Lọc theo ID dịch vụ"),
    change_type: Optional[str] = Query(None, description="Lọc theo loại biến động"),
    category: Optional[ServiceCategory] = Query(None, description="Lọc theo loại dịch vụ"),
    status: Optional[ServiceStatus] = Query(None, description="Lọc theo trạng thái"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.STAFF)),
):
    """[T3D32A7] API xuất CSV linh hoạt hỗ trợ cả 2 loại báo cáo: tồn kho hiện tại hoặc lịch sử nhập/xuất."""
    if report_type.lower() in ["inventory", "ton_kho", "stock"]:
        return export_inventory_csv(category=category, status=status, db=db, current_user=current_user)
    else:
        return export_stock_logs_csv(
            from_date=from_date,
            to_date=to_date,
            service_id=service_id,
            change_type=change_type,
            db=db,
            current_user=current_user,
        )


@router.get("/stock-logs", response_model=list[ServiceStockLogOut])
def list_all_stock_logs(
    from_date: Optional[date] = Query(None, description="Từ ngày (YYYY-MM-DD)"),
    to_date: Optional[date] = Query(None, description="Đến ngày (YYYY-MM-DD)"),
    service_id: Optional[int] = Query(None, description="Lọc theo ID dịch vụ"),
    change_type: Optional[str] = Query(None, description="Lọc theo loại biến động"),
    limit: int = Query(200, ge=1, le=1000, description="Giới hạn số lượng bản ghi"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.STAFF)),
):
    """Lấy danh sách lịch sử biến động kho trên toàn bộ hệ thống hoặc theo bộ lọc thời gian."""
    return service_crud.get_filtered_stock_logs(
        db=db,
        from_date=from_date,
        to_date=to_date,
        service_id=service_id,
        change_type=change_type,
        limit=limit,
    )


@router.get("/{service_id}", response_model=ServiceOut)
def get_service_detail(service=Depends(get_service_or_404)):
    """Xem chi tiết một dịch vụ. Công khai cho mọi người."""
    return service


# ====================================================================
# 2. CÁC API QUẢN TRỊ DỊCH VỤ (YÊU CẦU QUYỀN ADMIN HOẶC STAFF)
# ====================================================================

@router.post("", response_model=ServiceOut, status_code=status.HTTP_201_CREATED)
def create_service(
    data: ServiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.STAFF)),
):
    """Thêm mới dịch vụ. Bắt buộc giá bán phải > 0. Yêu cầu quyền ADMIN hoặc STAFF."""
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
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.STAFF)),
):
    """Cập nhật thông tin dịch vụ. Nếu sửa giá thì giá mới cũng phải > 0. Yêu cầu quyền ADMIN hoặc STAFF."""
    if data.unit_price is not None and data.unit_price <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Giá dịch vụ phải lớn hơn 0.",
        )
    return service_crud.update_service(db, service, data)


@router.delete("/{service_id}", response_model=ServiceOut)
def delete_service(
    service=Depends(get_service_or_404),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.STAFF)),
):
    """Xóa dịch vụ (Soft Delete sang DELETED để ẩn vĩnh viễn khỏi web). Yêu cầu quyền ADMIN hoặc STAFF."""
    return service_crud.delete_service(db, service)


@router.patch("/{service_id}/deactivate", response_model=ServiceOut)
def deactivate_service(
    service=Depends(get_service_or_404),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.STAFF)),
):
    """Tạm ngừng cung cấp dịch vụ (chuyển sang Inactive). Yêu cầu quyền ADMIN hoặc STAFF."""
    return service_crud.deactivate_service(db, service)


@router.patch("/{service_id}/activate", response_model=ServiceOut)
def activate_service(
    service=Depends(get_service_or_404),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.STAFF)),
):
    """Mở bán lại dịch vụ (chuyển sang Active). Yêu cầu quyền ADMIN hoặc STAFF."""
    return service_crud.activate_service(db, service)


@router.post("/{service_id}/rent", response_model=ServiceOut)
def rent_racket(
    quantity: int = Query(1, ge=1, description="Số lượng vợt thuê"),
    service=Depends(get_service_or_404),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.STAFF)),
):
    """Cho thuê vợt theo lượt tại quầy (tạm giữ kho). Yêu cầu quyền ADMIN hoặc STAFF."""
    try:
        return service_crud.rent_racket(db, service, quantity=quantity)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err))


@router.post("/{service_id}/return", response_model=ServiceOut)
def return_racket(
    quantity: int = Query(1, ge=1, description="Số lượng vợt trả"),
    service=Depends(get_service_or_404),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.STAFF)),
):
    """Khách trả vợt tại quầy sau khi kết thúc lượt thuê. Yêu cầu quyền ADMIN hoặc STAFF."""
    try:
        return service_crud.return_racket(db, service, quantity=quantity)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err))


# ====================================================================
# 3. CÁC API QUẢN LÝ KHO (YÊU CẦU QUYỀN ADMIN HOẶC STAFF)
# ====================================================================

@router.post("/{service_id}/import", response_model=ServiceStockLogOut)
def import_service_stock(
    data: StockImportRequest,
    service=Depends(get_service_or_404),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.STAFF)),
):
    """Nhập thêm hàng vào kho và tự động ghi ServiceStockLog. Yêu cầu quyền ADMIN hoặc STAFF."""
    try:
        return service_crud.import_stock(db, service, quantity=data.quantity, note=data.note)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err))


@router.post("/{service_id}/adjust", response_model=ServiceStockLogOut)
def adjust_service_stock(
    data: StockAdjustRequest,
    service=Depends(get_service_or_404),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.STAFF)),
):
    """Điều chỉnh tồn kho khi kiểm kê (bắt buộc có lý do note). Yêu cầu quyền ADMIN hoặc STAFF."""
    try:
        return service_crud.adjust_stock(db, service, actual_quantity=data.actual_quantity, note=data.note)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err))


@router.get("/{service_id}/stock-logs", response_model=list[ServiceStockLogOut])
def get_service_stock_logs(
    service=Depends(get_service_or_404),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.STAFF)),
):
    """Xem lịch sử biến động kho của dịch vụ. Yêu cầu quyền ADMIN hoặc STAFF."""
    return service_crud.get_stock_logs(db, service.id)
