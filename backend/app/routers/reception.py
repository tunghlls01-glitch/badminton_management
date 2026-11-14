"""
Đường dẫn đầy đủ: /api/reception
Phân quyền toàn bộ router: chỉ ADMIN và STAFF.
    GET  /api/reception/bookings                    → Tìm booking trong ngày (mã / SĐT / sân)
    POST /api/reception/bookings/{id}/check-in      → Check-in (chuyển CHECKED_IN)
    POST /api/reception/bookings/{id}/no-show       → Đánh dấu NO_SHOW
    POST /api/reception/bookings/{id}/checkout      → Thanh toán tổng kết (tiền sân + dịch vụ, giảm giá, tạo hóa đơn, chuyển Completed)
"""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.crud import reception as reception_crud
from app.crud.reception import NotFoundError
from app.db.session import get_db
from app.models.user import UserRole
from app.routers.booking import _to_booking_out
from app.schemas.booking import (
    BookingCheckoutRequest,
    BookingCheckoutResponse,
    BookingOut,
)

router = APIRouter(
    prefix="/reception",
    tags=["Reception"],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.STAFF))],
)


def _handle_reception_action(action_fn, db: Session, booking_id: int) -> BookingOut:
    try:
        booking = action_fn(db, booking_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _to_booking_out(booking)


@router.get("/bookings", response_model=list[BookingOut])
def search_reception_bookings(
    booking_code: Optional[str] = Query(None, description="Lọc theo mã booking"),
    phone: Optional[str] = Query(None, description="Lọc theo SĐT khách hàng"),
    court_id: Optional[int] = Query(None, description="Lọc theo sân"),
    booking_date: Optional[date] = Query(None, description="Ngày cần xem (mặc định hôm nay)"),
    db: Session = Depends(get_db),
):
    """Lễ tân tìm booking trong ngày theo mã / SĐT / sân."""
    bookings = reception_crud.search_reception_bookings(
        db,
        booking_date=booking_date,
        booking_code=booking_code,
        phone=phone,
        court_id=court_id,
    )
    return [_to_booking_out(b) for b in bookings]


@router.post("/bookings/{booking_id}/check-in", response_model=BookingOut)
def check_in_booking(booking_id: int, db: Session = Depends(get_db)):
    """Check-in khi khách đến (trong khoảng 30 phút trước giờ bắt đầu) → CHECKED_IN."""
    return _handle_reception_action(reception_crud.check_in_booking, db, booking_id)


@router.post("/bookings/{booking_id}/no-show", response_model=BookingOut)
def mark_no_show_booking(booking_id: int, db: Session = Depends(get_db)):
    """Đánh dấu NO_SHOW khi quá 15 phút sau giờ bắt đầu mà khách chưa đến."""
    return _handle_reception_action(reception_crud.mark_no_show_booking, db, booking_id)


@router.post("/bookings/{booking_id}/checkout", response_model=BookingCheckoutResponse)
def checkout_booking(
    booking_id: int,
    data: BookingCheckoutRequest,
    db: Session = Depends(get_db),
):
    """Thanh toán tổng kết (tiền sân + dịch vụ, giảm giá, tạo hóa đơn, chuyển Completed trong 1 transaction)."""
    try:
        return reception_crud.checkout_booking(db, booking_id, data)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
