"""Router Quản lý Hóa đơn & Chốt ca làm việc lễ tân.

Đường dẫn đầy đủ: /api/invoices
Phân quyền: ADMIN và STAFF.
    GET  /api/invoices                     → Danh sách hóa đơn có bộ lọc ngày, lễ tân, PTTT, tìm kiếm, phân trang
    GET  /api/invoices/receptionists       → Danh sách lễ tân/nhân viên cho dropdown
    GET  /api/invoices/shift/summary       → Chốt ca: tổng tiền mặt/chuyển khoản của lễ tân trong ca
    GET  /api/invoices/{invoice_id_or_code}→ Chi tiết hóa đơn (xem trước / in lại)
"""
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import require_roles, get_current_user
from app.crud import invoice as invoice_crud
from app.crud.invoice import InvoiceNotFoundError
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.invoice import (
    InvoiceDetailResponse,
    InvoiceListResponse,
    ReceptionistOut,
    ShiftClosingResponse,
    ShiftCloseRequest,
    ShiftCloseResponse,
)

router = APIRouter(
    prefix="/invoices",
    tags=["Invoices & Shift Closing"],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.STAFF))],
)


@router.get("", response_model=InvoiceListResponse)
def get_invoices_list(
    date: Optional[date] = Query(None, description="Lọc theo ngày cụ thể (YYYY-MM-DD)"),
    date_from: Optional[date] = Query(None, description="Lọc từ ngày (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(None, description="Lọc đến ngày (YYYY-MM-DD)"),
    staff_id: Optional[int] = Query(None, description="Lọc theo lễ tân/nhân viên"),
    payment_method: Optional[str] = Query(None, description="Lọc theo phương thức CASH / BANK_TRANSFER"),
    q: Optional[str] = Query(None, description="Tìm kiếm theo mã HĐ, mã booking, tên khách, SĐT"),
    page: int = Query(1, ge=1, description="Số trang (bắt đầu từ 1)"),
    limit: int = Query(20, ge=1, le=100, description="Số bản ghi mỗi trang"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy danh sách hóa đơn lọc theo ngày, lễ tân, phương thức thanh toán, từ khóa và phân trang."""
    return invoice_crud.get_invoices(
        db=db,
        date_val=date,
        date_from=date_from,
        date_to=date_to,
        staff_id=staff_id,
        payment_method=payment_method,
        q=q,
        page=page,
        limit=limit,
    )


@router.get("/receptionists", response_model=List[ReceptionistOut])
def get_receptionists_list(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy danh sách nhân viên lễ tân và quản trị viên cho các dropdown bộ lọc."""
    return invoice_crud.get_receptionists_list(db)


@router.get("/shift/summary", response_model=ShiftClosingResponse)
def get_shift_closing_summary(
    staff_id: Optional[int] = Query(None, description="ID nhân viên lễ tân (mặc định lấy nhân viên hiện tại nếu không truyền)"),
    date: Optional[date] = Query(None, description="Ngày chốt ca (YYYY-MM-DD, mặc định hôm nay)"),
    shift_type: str = Query("ALL_DAY", description="Loại ca: MORNING, AFTERNOON, EVENING, ALL_DAY, CUSTOM"),
    start_time: Optional[str] = Query(None, description="Giờ bắt đầu nếu là CUSTOM (HH:MM)"),
    end_time: Optional[str] = Query(None, description="Giờ kết thúc nếu là CUSTOM (HH:MM)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Chốt ca làm việc: Thống kê tổng tiền mặt, tổng chuyển khoản, tổng doanh thu và danh sách hóa đơn của lễ tân trong ca."""
    target_staff_id = staff_id or current_user.id
    try:
        return invoice_crud.get_shift_closing_summary(
            db=db,
            staff_id=target_staff_id,
            date_val=date,
            shift_type=shift_type,
            start_time=start_time,
            end_time=end_time,
        )
    except InvoiceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/shift/close", response_model=ShiftCloseResponse)
def confirm_shift_closing_endpoint(
    payload: ShiftCloseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xác nhận chốt ca làm việc, đối soát két tiền mặt và lưu ghi chú bàn giao."""
    try:
        return invoice_crud.confirm_shift_closing(
            db=db,
            payload=payload,
            current_user_id=current_user.id,
        )
    except InvoiceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))



@router.get("/{invoice_id_or_code}", response_model=InvoiceDetailResponse)
def get_invoice_detail(
    invoice_id_or_code: str,
    reprint: bool = Query(False, description="True nếu xem để in lại hóa đơn"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy chi tiết đầy đủ của một hóa đơn theo ID hoặc mã hóa đơn (phục vụ xem chi tiết & in lại khổ nhiệt 80mm)."""
    try:
        return invoice_crud.get_invoice_detail(
            db=db,
            invoice_id_or_code=invoice_id_or_code,
            is_reprint=reprint,
        )
    except InvoiceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
