from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.crud import booking as crud
from app.db.session import get_db
from app.models.booking import BookingStatus
from app.schemas.booking import (
    BookingCreate,
    BookingOut,
    BookingSlotOut,
    BookingUpdate,
    CancelBookingOut,
    CancellationPreviewOut,
)

router = APIRouter(prefix="/bookings", tags=["Bookings"])


def to_booking_out(booking) -> BookingOut:
    first_slot = booking.booking_slots[0] if booking.booking_slots else None

    slots_out = []
    for s in booking.booking_slots:
        slots_out.append(
            BookingSlotOut(
                id=s.id,
                booking_id=s.booking_id,
                court_id=s.court_id,
                court_name=s.court.name if s.court else None,
                start_at=s.start_at,
                end_at=s.end_at,
                duration_minutes=s.duration_minutes,
                price_per_hour=float(s.price_per_hour),
                amount=float(s.amount),
                status=s.status,
            )
        )

    return BookingOut(
        id=booking.id,
        booking_code=booking.booking_code,
        user_id=booking.user_id,
        user_name=booking.user.name if booking.user else None,
        user_phone=booking.user.phone if booking.user else None,
        court_id=first_slot.court_id if first_slot else None,
        court_name=first_slot.court.name if first_slot and first_slot.court else None,
        booking_date=first_slot.start_at.date() if first_slot else None,
        start_time=first_slot.start_at.strftime("%H:%M") if first_slot else None,
        end_time=first_slot.end_at.strftime("%H:%M") if first_slot else None,
        booking_channel=booking.booking_channel,
        total_price=float(booking.total_price),
        status=booking.status,
        note=booking.note,
        created_at=booking.created_at,
        slots=slots_out,
    )


@router.get("", response_model=list[BookingOut])
def read_bookings(
    booking_date: date | None = None,
    court_id: int | None = None,
    status: BookingStatus | None = None,
    db: Session = Depends(get_db),
):
    bookings = crud.get_bookings(db, booking_date=booking_date, court_id=court_id, status=status)
    return [to_booking_out(b) for b in bookings]


@router.get("/{booking_id}", response_model=BookingOut)
def read_booking(booking_id: int, db: Session = Depends(get_db)):
    booking = crud.get_booking(db, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn đặt sân")
    return to_booking_out(booking)


@router.get("/{booking_id}/cancel-preview", response_model=CancellationPreviewOut)
def preview_cancellation(booking_id: int, db: Session = Depends(get_db)):
    """Kiểm tra đơn đặt có tồn tại không và xem trước chính sách hoàn tiền."""
    try:
        preview = crud.get_cancellation_preview(db, booking_id)
        return CancellationPreviewOut(
            booking_id=preview["booking_id"],
            booking_code=preview["booking_code"],
            earliest_start=preview["earliest_start"],
            hours_before=preview["hours_before"],
            refund_percent=preview["refund_percent"],
            refund_amount=preview["refund_amount"],
            total_price=preview["total_price"],
            policy_message=preview["policy_message"],
            summary_message=preview["summary_message"],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{booking_id}/cancel", response_model=CancelBookingOut)
def cancel_booking_endpoint(booking_id: int, db: Session = Depends(get_db)):
    """Hủy đơn đặt sân, áp dụng quy tắc hoàn tiền và trả về thông báo chi tiết."""
    try:
        result = crud.cancel_booking(db, booking_id)
        return CancelBookingOut(
            booking_id=result["booking_id"],
            booking_code=result["booking_code"],
            status=result["status"],
            refund_percent=result["refund_percent"],
            refund_amount=result["refund_amount"],
            policy_message=result["policy_message"],
            message=result["message"],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(data: BookingCreate, db: Session = Depends(get_db)):
    booking = crud.create_booking(db, data)
    return to_booking_out(booking)


@router.put("/{booking_id}", response_model=BookingOut)
def update_booking(booking_id: int, data: BookingUpdate, db: Session = Depends(get_db)):
    booking = crud.get_booking(db, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn đặt sân")
    updated = crud.update_booking(db, booking, data)
    return to_booking_out(updated)


@router.patch("/{booking_id}/status", response_model=BookingOut)
def update_booking_status(booking_id: int, status: BookingStatus, db: Session = Depends(get_db)):
    booking = crud.get_booking(db, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn đặt sân")
    try:
        updated = crud.update_booking_status(db, booking, status)
        return to_booking_out(updated)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_booking(booking_id: int, db: Session = Depends(get_db)):
    booking = crud.get_booking(db, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn đặt sân")
    crud.delete_booking(db, booking)
