"""Nghiệp vụ Lễ tân: tìm booking trong ngày, check-in và đánh dấu NO_SHOW."""
from datetime import date, datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.booking import Booking, BookingStatus
from app.models.booking_slot import BookingSlot, BookingSlotStatus
from app.models.user import User

CHECKIN_EARLY_MINUTES = 30
NO_SHOW_GRACE_MINUTES = 15


class NotFoundError(Exception):
    """Không tìm thấy bản ghi (HTTP 404)."""


def _get_earliest_slot_start(booking: Booking) -> datetime:
    active_slots = [s for s in booking.booking_slots if s.status == BookingSlotStatus.Active]
    slots = active_slots or booking.booking_slots
    if not slots:
        raise ValueError(f"Booking id={booking.id} không có khung giờ đặt sân")
    return min(s.start_at for s in slots)


def _get_confirmed_booking_with_start(
    db: Session, booking_id: int, action_label: str
) -> tuple[Booking, datetime]:
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise NotFoundError(f"Booking id={booking_id} không tồn tại")
    if booking.status != BookingStatus.Confirmed:
        raise ValueError(
            f"Chỉ có thể {action_label} khi booking đang ở trạng thái Confirmed. "
            f"Hiện tại: {booking.status.value}"
        )
    return booking, _get_earliest_slot_start(booking)


def search_reception_bookings(
    db: Session,
    *,
    booking_date: date | None = None,
    booking_code: str | None = None,
    phone: str | None = None,
    court_id: int | None = None,
) -> list[Booking]:
    """Lễ tân tìm booking trong ngày (mặc định hôm nay) theo mã / SĐT / sân."""
    target_date = booking_date or date.today()
    day_start = datetime.combine(target_date, time.min)
    day_end = datetime.combine(target_date, time.max)

    query = (
        select(Booking)
        .join(BookingSlot, BookingSlot.booking_id == Booking.id)
        .join(User, User.id == Booking.user_id)
        .where(
            BookingSlot.status == BookingSlotStatus.Active,
            BookingSlot.start_at >= day_start,
            BookingSlot.start_at <= day_end,
        )
    )

    if court_id is not None:
        query = query.where(BookingSlot.court_id == court_id)
    if booking_code and booking_code.strip():
        query = query.where(Booking.booking_code.ilike(f"%{booking_code.strip()}%"))
    if phone and phone.strip():
        query = query.where(User.phone.ilike(f"%{phone.strip()}%"))

    bookings = list(db.scalars(query.distinct()))
    bookings.sort(key=lambda b: min((s.start_at for s in b.booking_slots), default=datetime.max))
    return bookings


def check_in_booking(db: Session, booking_id: int, now: datetime | None = None) -> Booking:
    """Chuyển booking Confirmed → CHECKED_IN (trong vòng 30 phút trước giờ bắt đầu đến tối đa trễ 15 phút)."""
    booking, start_at = _get_confirmed_booking_with_start(db, booking_id, "check-in")
    current_time = now or datetime.now()

    earliest_checkin = start_at - timedelta(minutes=CHECKIN_EARLY_MINUTES)
    latest_checkin = start_at + timedelta(minutes=NO_SHOW_GRACE_MINUTES)

    if current_time < earliest_checkin:
        raise ValueError(
            f"Chưa đến giờ check-in. Chỉ được check-in trong vòng {CHECKIN_EARLY_MINUTES} phút "
            f"trước giờ bắt đầu (từ {earliest_checkin.strftime('%H:%M')})."
        )
    if current_time > latest_checkin:
        raise ValueError(
            f"Đã quá {NO_SHOW_GRACE_MINUTES} phút sau giờ bắt đầu ({start_at.strftime('%H:%M')}), "
            "không thể check-in. Vui lòng đánh dấu NO_SHOW."
        )

    booking.status = BookingStatus.CHECKED_IN
    db.commit()
    db.refresh(booking)
    return booking


def mark_no_show_booking(db: Session, booking_id: int, now: datetime | None = None) -> Booking:
    """Đánh dấu booking Confirmed → NO_SHOW khi quá 15 phút sau giờ bắt đầu mà khách chưa đến."""
    booking, start_at = _get_confirmed_booking_with_start(db, booking_id, "đánh dấu NO_SHOW")
    current_time = now or datetime.now()

    deadline = start_at + timedelta(minutes=NO_SHOW_GRACE_MINUTES)
    if current_time <= deadline:
        raise ValueError(
            f"Chưa quá {NO_SHOW_GRACE_MINUTES} phút sau giờ bắt đầu ({start_at.strftime('%H:%M')}). "
            f"Chỉ có thể đánh dấu NO_SHOW sau {deadline.strftime('%H:%M')}."
        )

    booking.status = BookingStatus.NO_SHOW
    db.commit()
    db.refresh(booking)
    return booking
