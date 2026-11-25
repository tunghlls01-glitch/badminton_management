from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.crud.booking import booking_blocks_slot
from app.crud.reception import CHECKIN_EARLY_MINUTES, NO_SHOW_GRACE_MINUTES
from app.models.booking import Booking, BookingStatus
from app.models.booking_slot import BookingSlot, BookingSlotStatus
from app.models.court import Court, CourtStatus
from app.models.court_block import CourtBlock
from app.models.invoice import Invoice
from app.models.payment import Payment, PaymentStatus
from app.models.user import User

# Same opening window as the existing slot grid.
OPEN_HOUR = 6
CLOSE_HOUR = 23
HALF_HOUR = timedelta(minutes=30)
BOOKED = {BookingStatus.Confirmed, BookingStatus.CHECKED_IN, BookingStatus.Completed}
EXCLUDED = {BookingStatus.Cancelled, BookingStatus.Expired, BookingStatus.NO_SHOW}


def overlaps(intervals, start, end):
    return (row for row in intervals if row.start_at < end and row.end_at > start)


def slot_state(court, slots, blocks, start, end, now):
    if court.status != CourtStatus.Active:
        return {"state": "locked", "reason": "Sân đang bảo trì hoặc ngừng hoạt động"}
    block = next(overlaps(blocks, start, end), None)
    if block:
        return {"state": "locked", "reason": block.reason or "Khung giờ đã khóa"}
    candidates = list(overlaps(slots, start, end))
    booking_slot = next((row for row in candidates if row.booking.status != BookingStatus.Pending), None)
    if booking_slot is None and candidates:
        booking_slot = candidates[0]
    if booking_slot:
        booking = booking_slot.booking
        held = booking.status == BookingStatus.Pending and booking.hold_expires_at is not None
        return {"state": "hold" if held else "booked", "booking_id": booking.id}
    if start <= now:
        return {"state": "locked", "reason": "Khung giờ đã bắt đầu hoặc đã qua"}
    return {"state": "free"}


def read_revenue(db: Session, day: date):
    first_day = day - timedelta(days=6)
    amounts = {}
    try:
        # Checkout may promote an old Pending payment. Its invoice records the checkout date.
        paid_at = func.coalesce(Invoice.created_at, Payment.created_at)
        rows = db.execute(
            select(func.date(paid_at), func.sum(Payment.amount))
            .outerjoin(Invoice, Invoice.id == Payment.invoice_id)
            .where(
                Payment.payment_status == PaymentStatus.SUCCESS,
                paid_at >= datetime.combine(first_day, time.min),
                paid_at < datetime.combine(day + timedelta(days=1), time.min),
            )
            .group_by(func.date(paid_at))
        )
        amounts = {str(period): value for period, value in rows}
    except Exception as e:
        print(f"[WARN] read_revenue query failed: {e}")
    return [
        {"date": current, "amount": amounts.get(current.isoformat(), Decimal(0))}
        for current in (first_day + timedelta(days=i) for i in range(7))
    ]


def booking_summary(booking, slots):
    return {
        "id": booking.id,
        "code": booking.booking_code,
        "customer": booking.user.full_name,
        "total": booking.total_price,
        "status": booking.status,
        "slots": [
            {"court": slot.court.name, "start": slot.start_at, "end": slot.end_at}
            for slot in sorted(slots, key=lambda row: (row.start_at, row.id))
        ],
    }


def search_bookings(db: Session, q: str, now: datetime):
    term = q.strip()
    if not term:
        return []
    bookings = db.scalars(
        select(Booking).join(Booking.user)
        .where(
            or_(Booking.booking_code.contains(term, autoescape=True), User.phone.contains(term, autoescape=True)),
            ~((Booking.status == BookingStatus.Pending) & (Booking.hold_expires_at.is_not(None))
              & (Booking.hold_expires_at <= now)),
        )
        .options(selectinload(Booking.user), selectinload(Booking.booking_slots).selectinload(BookingSlot.court))
        .order_by(Booking.created_at.desc(), Booking.id.desc()).limit(20)
    )
    return [booking_summary(booking, booking.booking_slots) for booking in bookings]


def get_overview(db: Session, day: date, now: datetime):
    start = datetime.combine(day, time.min)
    end = start + timedelta(days=1)
    periods = or_(
        (BookingSlot.start_at < end) & (BookingSlot.end_at > start),
        (BookingSlot.start_at <= now) & (BookingSlot.end_at > now),
    )
    try:
        slots = list(db.execute(
            select(BookingSlot, booking_blocks_slot(now).label("blocks_slot")).join(Booking).where(periods)
            .options(selectinload(BookingSlot.booking).selectinload(Booking.user), selectinload(BookingSlot.court))
        ))
    except Exception as e:
        print(f"[WARN] slots query failed: {e}")
        slots = []

    try:
        blocks = list(db.scalars(select(CourtBlock).where(or_(
            (CourtBlock.start_at < end) & (CourtBlock.end_at > start),
            (CourtBlock.start_at <= now) & (CourtBlock.end_at > now),
        ))))
    except Exception as e:
        print(f"[WARN] blocks query failed: {e}")
        blocks = []

    try:
        courts = list(db.scalars(select(Court).order_by(Court.id)))
    except Exception as e:
        print(f"[WARN] courts query failed: {e}")
        courts = []

    by_court = defaultdict(list)
    by_booking = defaultdict(list)
    blocks_by_court = defaultdict(list)
    for block in blocks:
        blocks_by_court[block.court_id].append(block)
    for slot, blocks_slot in slots:
        booking = slot.booking
        active = slot.status == BookingSlotStatus.Active
        pending_hold = booking.status == BookingStatus.Pending and booking.hold_expires_at is not None
        if slot.start_at < end and slot.end_at > start and not pending_hold:
            by_booking[booking.id].append(slot)
        if active and (blocks_slot or (booking.status == BookingStatus.Completed and slot.end_at <= now)):
            by_court[slot.court_id].append(slot)

    scheduled = [rows for rows in by_booking.values() if rows[0].booking.status not in EXCLUDED
                 and any(row.status == BookingSlotStatus.Active for row in rows)]
    scheduled.sort(key=lambda rows: min(row.start_at for row in rows))
    pending = [rows[0].booking for rows in scheduled if rows[0].booking.status == BookingStatus.Pending
               and any(row.status == BookingSlotStatus.Active and row.end_at > now for row in rows)]
    candidates = [rows[0].booking.id for rows in scheduled if rows[0].booking.status == BookingStatus.Confirmed]
    try:
        earliest_by_id = dict(db.execute(
            select(BookingSlot.booking_id, func.min(BookingSlot.start_at))
            .where(BookingSlot.booking_id.in_(candidates), BookingSlot.status == BookingSlotStatus.Active)
            .group_by(BookingSlot.booking_id)
        ).all()) if candidates and day == now.date() else {}
    except Exception as e:
        print(f"[WARN] earliest_by_id failed: {e}")
        earliest_by_id = {}
    checkin = [booking_id for booking_id, earliest in earliest_by_id.items()
               if earliest - timedelta(minutes=CHECKIN_EARLY_MINUTES) <= now
               <= earliest + timedelta(minutes=NO_SHOW_GRACE_MINUTES)]
    checkin.sort(key=earliest_by_id.__getitem__)

    grid = []
    using = free = 0
    operating = OPEN_HOUR <= now.hour < CLOSE_HOUR
    for court in courts:
        court_slots = by_court[court.id]
        court_blocks = blocks_by_court[court.id]
        present = [slot for slot in court_slots if slot.start_at <= now < slot.end_at
                   and slot.booking.status != BookingStatus.Completed]
        usable = court.status == CourtStatus.Active and not any(
            block.start_at <= now < block.end_at for block in court_blocks
        )
        using += bool(operating and usable and any(slot.booking.status == BookingStatus.CHECKED_IN
                                                   for slot in present))
        free += bool(operating and usable and not present)
        cells = []
        for i in range((CLOSE_HOUR - OPEN_HOUR) * 2):
            cell_start = start + timedelta(hours=OPEN_HOUR) + i * HALF_HOUR
            cells.append({"start": cell_start.strftime("%H:%M"), **slot_state(
                court, court_slots, court_blocks, cell_start, cell_start + HALF_HOUR, now
            )})
        grid.append({"id": court.id, "name": court.name, "cells": cells})

    recent = sorted(by_booking.values(), key=lambda rows: (rows[0].booking.created_at, rows[0].booking.id), reverse=True)
    return {
        "date": day,
        "today": now.date(),
        "revenue": read_revenue(db, day),
        "booked_court_value": sum(
            (slot.amount for rows in scheduled if rows[0].booking.status in BOOKED
             for slot in rows if slot.status == BookingSlotStatus.Active),
            Decimal(0),
        ),
        "booking_count": len(scheduled),
        "confirmed_count": sum(rows[0].booking.status in BOOKED for rows in scheduled),
        "courts_in_use": using,
        "courts_free": free,
        "open": f"{OPEN_HOUR:02d}:00",
        "close": f"{CLOSE_HOUR:02d}:00",
        "courts": grid,
        "pending_count": len(pending),
        "next_pending_id": pending[0].id if pending else None,
        "checkin_count": len(checkin),
        "next_checkin_id": checkin[0] if checkin else None,
        "recent": [booking_summary(rows[0].booking, rows) for rows in recent[:4]],
    }
