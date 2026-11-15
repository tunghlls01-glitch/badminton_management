"""
Đường dẫn đầy đủ: /api/bookings
    POST   /api/bookings                → Tạo booking (chống trùng slot)
    POST   /api/bookings/{id}/confirm   → Khách xác nhận đặt
    GET    /api/bookings                → Danh sách booking
    GET    /api/bookings/{id}           → Chi tiết
    PATCH  /api/bookings/{id}/status    → Đổi trạng thái
    DELETE /api/bookings/{id}           → Xoá
"""
from datetime import date
from typing import Optional


from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session


from app.crud import booking as booking_crud
from app.crud.booking import ConflictError
from app.db.session import get_db
from app.models.booking import BookingStatus
from app.schemas.booking import (
    BookingCreate,
    BookingOut,
    BookingUpdate,
    CancellationPreviewOut,
    CancelBookingOut,
    RecurringCheckRequest,
    RecurringCheckResponse,
    RecurringBookingCreate,
    RecurringBookingResponse,
)


router = APIRouter(prefix="/bookings", tags=["Bookings"])


def _to_booking_out(booking) -> dict:
    """Map Booking model → BookingOut schema (trích slot đầu tiên)."""
    first_slot = None
    if booking.booking_slots:
        first_slot = booking.booking_slots[0]


    return BookingOut(
        id=booking.id,
        booking_code=booking.booking_code,
        user_id=booking.user_id,
        user_name=getattr(booking.user, "full_name", None) if booking.user else None,
        user_phone=getattr(booking.user, "phone", None) if booking.user else None,
        court_id=first_slot.court_id if first_slot else None,
        court_name=(
            getattr(first_slot.court, "name", None)
            or getattr(first_slot.court, "court_name", None)
            if first_slot and first_slot.court
            else None
        ),
        booking_date=first_slot.start_at.date() if first_slot else None,
        start_time=first_slot.start_at.strftime("%H:%M") if first_slot else None,
        end_time=first_slot.end_at.strftime("%H:%M") if first_slot else None,
        booking_channel=booking.booking_channel,
        total_price=float(booking.total_price),
        status=booking.status,
        note=booking.note,
        created_at=booking.created_at,
        slots=[],
    )




def _get_or_404(booking_id: int, db: Session = Depends(get_db)):
    booking = booking_crud.get_booking(db, booking_id)
    if booking is None:
        raise HTTPException(status_code=404, detail=f"Booking id={booking_id} không tồn tại")
    return booking




# ─────────────── endpoints ───────────────




@router.post("", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(data: BookingCreate, db: Session = Depends(get_db)):
    """Tạo booking mới. Nếu slot đã bị đặt → HTTP 409."""
    try:
        booking = booking_crud.create_booking(db, data)
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _to_booking_out(booking)


@router.post("/recurring/check", response_model=RecurringCheckResponse)
def check_recurring(data: RecurringCheckRequest, db: Session = Depends(get_db)):
    """Kiểm tra tính khả dụng từng tuần cho chuỗi 4–8 tuần."""
    try:
        return booking_crud.check_recurring_availability(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/recurring", response_model=RecurringBookingResponse, status_code=status.HTTP_201_CREATED)
def create_recurring(data: RecurringBookingCreate, db: Session = Depends(get_db)):
    """Tạo đặt sân cố định hàng tuần trong 1 TRANSACTION duy nhất.
    Nếu có tuần trùng và chưa nằm trong skip_conflict_dates -> HTTP 409 Conflict.
    Nếu người dùng đồng ý bỏ qua tuần trùng (được đưa vào skip_conflict_dates),
    tạo booking với các tuần còn lại.
    """
    try:
        booking, booked_dates, skipped_dates = booking_crud.create_recurring_booking(db, data)
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    court_name = None
    if booking.booking_slots and booking.booking_slots[0].court:
        court_name = getattr(booking.booking_slots[0].court, "name", None) or getattr(booking.booking_slots[0].court, "court_name", None)

    msg = f"Đặt sân cố định thành công {len(booked_dates)}/{data.weeks_count} tuần."
    if skipped_dates:
        msg += f" Đã bỏ qua {len(skipped_dates)} tuần bị trùng."

    return RecurringBookingResponse(
        booking_id=booking.id,
        booking_code=booking.booking_code,
        court_id=data.court_id,
        court_name=court_name,
        total_weeks_requested=data.weeks_count,
        booked_weeks_count=len(booked_dates),
        skipped_weeks_count=len(skipped_dates),
        total_price=float(booking.total_price),
        status=booking.status,
        booked_dates=booked_dates,
        skipped_dates=skipped_dates,
        message=msg,
    )




@router.post("/{booking_id}/confirm", response_model=BookingOut)
def confirm_booking(booking_id: int, db: Session = Depends(get_db)):
    """Khách xác nhận đặt (Pending → Confirmed). Tính lại tiền theo bảng giá hiện tại."""
    try:
        booking = booking_crud.confirm_booking(db, booking_id)
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _to_booking_out(booking)




@router.get("", response_model=list[BookingOut])
def list_bookings(
    booking_date: Optional[date] = Query(None),
    court_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
):
    bookings = booking_crud.get_bookings(
        db, booking_date=booking_date, court_id=court_id, status=status_filter
    )
    return [_to_booking_out(b) for b in bookings]




@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(booking=Depends(_get_or_404)):
    return _to_booking_out(booking)




@router.patch("/{booking_id}/status", response_model=BookingOut)
def update_status(
    new_status: BookingStatus = Query(..., alias="status"),
    booking=Depends(_get_or_404),
    db: Session = Depends(get_db),
):
    booking = booking_crud.update_booking_status(db, booking, new_status)
    return _to_booking_out(booking)




@router.get("/{booking_id}/cancellation-preview", response_model=CancellationPreviewOut)
def cancellation_preview(booking=Depends(_get_or_404), db: Session = Depends(get_db)):
    """Xem trước chính sách hoàn tiền và số tiền được hoàn trước khi hủy."""
    try:
        return booking_crud.get_cancellation_preview(db, booking)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{booking_id}/cancel", response_model=CancelBookingOut)
def cancel_booking(
    booking_id: int,
    reason: Optional[str] = Query(None, description="Lý do hủy lịch đặt"),
    booking=Depends(_get_or_404),
    db: Session = Depends(get_db),
):
    """Hủy lịch đặt sân theo chính sách:
    - Trước >= 24 giờ: hoàn 100%
    - Trước >= 6 giờ (6h – 24h): hoàn 50%
    - Dưới 6 giờ: không hoàn tiền (0%)
    - Đã tới/qua giờ vào sân: không được hủy.
    """
    try:
        return booking_crud.cancel_booking(db, booking, reason=reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_booking(booking=Depends(_get_or_404), db: Session = Depends(get_db)):
    booking_crud.delete_booking(db, booking)
