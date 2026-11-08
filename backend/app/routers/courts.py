from datetime import date, datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.crud import court as crud
from app.db.session import get_db
from app.models.booking import BookingSlot, BookingSlotStatus, BookingStatus
from app.schemas.court import CourtStatusOut

router = APIRouter(prefix="/courts", tags=["Courts"])


@router.get("", response_model=list[CourtStatusOut])
def read_courts(target_date: date | None = None, db: Session = Depends(get_db)):
    courts = crud.get_courts(db)
    query_date = target_date or date.today()
    now_dt = datetime.now()

    results = []
    for court in courts:
        price_per_hour = crud.get_court_price_per_hour(db, court.id)
        is_vip = "VIP" in court.name.upper()

        slots = (
            db.query(BookingSlot)
            .filter(
                BookingSlot.court_id == court.id,
                BookingSlot.status == BookingSlotStatus.Active,
            )
            .join(BookingSlot.booking)
            .filter(
                BookingStatus.Cancelled != BookingSlot.booking.property.mapper.class_.status,
                BookingStatus.Expired != BookingSlot.booking.property.mapper.class_.status,
            )
            .order_by(BookingSlot.start_at.asc())
            .all()
        )

        day_slots = [s for s in slots if s.start_at.date() == query_date]

        current_state = "empty"
        state_note = None
        active_booking_id = None

        for s in day_slots:
            cust_name = s.booking.user.name if (s.booking and s.booking.user) else "Khách"
            time_str = s.start_at.strftime("%H:%M")

            if s.start_at <= now_dt <= s.end_at:
                current_state = "playing"
                state_note = f"Bắt đầu: {time_str} (Khách: {cust_name})"
                active_booking_id = s.booking_id
                break
            elif s.start_at > now_dt:
                current_state = "booked"
                state_note = f"Giờ nhận: {time_str} (Khách: {cust_name})"
                active_booking_id = s.booking_id
                break
            else:
                state_note = f"Đã chơi lúc {time_str}"

        results.append(
            CourtStatusOut(
                id=court.id,
                name=court.name,
                description=court.description,
                status=court.status,
                is_vip=is_vip,
                price_per_hour=float(price_per_hour),
                current_state=current_state,
                state_note=state_note,
                active_booking_id=active_booking_id,
            )
        )
    return results
