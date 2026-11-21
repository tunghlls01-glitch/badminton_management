from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.crud.booking import vietnam_now
from app.db.session import get_db
from app.models.booking import Booking, BookingStatus
from app.models.booking_slot import BookingSlotStatus
from app.models.user import User
from app.schemas.slot import (
    SlotGridResponse,
    SlotHoldRequest,
    SlotHoldResponse,
    SlotReleaseRequest,
)
from app.crud.slot import (
    get_slot_grid_by_date,
    hold_slots,
    release_slots,
)

router = APIRouter(prefix="/slots", tags=["Slots"])


def _hold_session_payload(booking: Booking) -> dict:
    slots = sorted(
        (slot for slot in booking.booking_slots if slot.status == BookingSlotStatus.Active),
        key=lambda slot: slot.start_at,
    )
    if not slots:
        raise HTTPException(status_code=404, detail="Phiên giữ chỗ không còn khung giờ hoạt động.")

    return {
        "booking_id": booking.id,
        "user_id": booking.user_id,
        "hold_expires_at": booking.hold_expires_at,
        "total_price": booking.total_price,
        "date": slots[0].start_at.date().isoformat(),
        "slots": [
            {
                "court_id": slot.court_id,
                "court_name": slot.court.name,
                "start_at": slot.start_at,
                "end_at": slot.end_at,
                "price": slot.amount,
            }
            for slot in slots
        ],
    }


@router.get("/grid", response_model=SlotGridResponse)
def get_slot_grid(
    target_date: date = Query(..., alias="date", description="Ngày cần xem dạng YYYY-MM-DD"),
    db: Session = Depends(get_db)
):
    courts_data = get_slot_grid_by_date(db=db, query_date=target_date)

    return SlotGridResponse(
        date=str(target_date),
        operating_hours={
            "open": "06:00",
            "close": "23:00",
            "slot_duration_minutes": 60
        },
        courts=courts_data
    )


@router.post("/hold", response_model=SlotHoldResponse)
def create_slot_hold(
    payload: SlotHoldRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payload.user_id = current_user.id
    return hold_slots(db=db, payload=payload)


@router.get("/hold/current")
def get_current_slot_hold(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Khôi phục phiên giữ còn hạn của tài khoản khi trình duyệt mất sessionStorage."""
    now = vietnam_now()
    booking = (
        db.query(Booking)
        .filter(
            Booking.user_id == current_user.id,
            Booking.status == BookingStatus.Pending,
            Booking.hold_expires_at > now,
        )
        .order_by(Booking.created_at.desc())
        .first()
    )
    if booking is None:
        raise HTTPException(status_code=404, detail="Tài khoản không có phiên giữ chỗ còn hạn.")
    return _hold_session_payload(booking)


@router.get("/hold/{booking_id}")
def get_slot_hold(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Khôi phục một phiên giữ cụ thể sau khi mở lại trang xác nhận."""
    booking = (
        db.query(Booking)
        .filter(
            Booking.id == booking_id,
            Booking.user_id == current_user.id,
        )
        .first()
    )
    if booking is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên giữ chỗ của tài khoản.")
    if booking.status == BookingStatus.Confirmed:
        return {
            "state": "confirmed",
            "booking_id": booking.id,
            "booking_code": booking.booking_code,
        }
    if booking.status != BookingStatus.Pending:
        raise HTTPException(status_code=404, detail="Phiên giữ chỗ không còn ở trạng thái chờ xác nhận.")
    if not booking.hold_expires_at or booking.hold_expires_at <= vietnam_now():
        raise HTTPException(status_code=410, detail="Phiên giữ chỗ đã hết hạn.")
    return _hold_session_payload(booking)


@router.post("/release")
def release_slot_hold(
    payload: SlotReleaseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payload.user_id = current_user.id
    return release_slots(db=db, payload=payload)
