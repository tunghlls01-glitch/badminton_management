from datetime import datetime, date, time
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.models.court import Court, CourtStatus
from app.models.court_block import CourtBlock
from app.models.booking_slot import BookingSlot 
from app.models.booking import Booking, BookingStatus

from app.schemas.slot import SlotDisplayStatus, SlotGridItem, CourtSlotGrid


def is_slot_free(db: Session, court_id: int, start_at: datetime, end_at: datetime) -> bool:
    """
    Hàm dùng chung kiểm tra slot có trống không.
    """
    now = datetime.now()

    # 1. Kiểm tra khoá sân (CourtBlock)
    has_lock = db.query(CourtBlock).filter(
        CourtBlock.court_id == court_id,
        CourtBlock.start_time < end_at,
        CourtBlock.end_time > start_at
    ).first()

    if has_lock:
        return False

    # 2. Kiểm tra slot đã được đặt (BookingSlot join Booking)
    has_booking_slot = db.query(BookingSlot).join(Booking).filter(
        BookingSlot.court_id == court_id,
        BookingSlot.start_at < end_at,
        BookingSlot.end_at > start_at,
        or_(
            Booking.status.in_([BookingStatus.Confirmed, BookingStatus.CHECKED_IN]),
            and_(
                Booking.status == BookingStatus.Pending,
                Booking.hold_expires_at > now
            )
        )
    ).first()

    if has_booking_slot:
        return False

    return True


def get_slot_grid_by_date(db: Session, query_date: date) -> List[CourtSlotGrid]:
    """
    Quét ma trận slot theo ngày chuẩn xác theo Model.
    """
    now = datetime.now()
    courts = db.query(Court).all()
    result = []

    open_hour = 6
    close_hour = 22
    slot_duration = 1

    for court in courts:
        slots = []

        # Kiểm tra xem sân có đang ở trạng thái Bảo trì/Ngưng hoạt động không
        is_maintenance = (court.status == CourtStatus.Maintenance or court.status == CourtStatus.Inactive)

        for hour in range(open_hour, close_hour, slot_duration):
            start_dt = datetime.combine(query_date, time(hour, 0))
            end_dt = datetime.combine(query_date, time(hour + slot_duration, 0))
            
            # 1. Trường hợp Sân ngưng hoạt động / bảo trì toàn thời gian
            if is_maintenance:
                slots.append(SlotGridItem(
                    court_id=court.id,
                    court_name=court.name,
                    start_at=start_dt,
                    end_at=end_dt,
                    status=SlotDisplayStatus.LOCKED,
                    price=50000,
                    lock_reason="Sân đang bảo trì/ngừng hoạt động"
                ))
                continue

            # 2. Kiểm tra Lịch khoá sân theo khung giờ (CourtBlock)
            lock = db.query(CourtBlock).filter(
                CourtBlock.court_id == court.id,
                CourtBlock.start_time < end_dt,
                CourtBlock.end_time > start_dt
            ).first()

            if lock:
                slots.append(SlotGridItem(
                    court_id=court.id,
                    court_name=court.name,
                    start_at=start_dt,
                    end_at=end_dt,
                    status=SlotDisplayStatus.LOCKED,
                    price=50000,
                    lock_reason=lock.reason or "Bảo trì khung giờ"
                ))
                continue

            # 3. Kiểm tra BookingSlot trong khung giờ
            slot_record = db.query(BookingSlot).join(Booking).filter(
                BookingSlot.court_id == court.id,
                BookingSlot.start_at < end_dt,
                BookingSlot.end_at > start_dt
            ).first()

            if slot_record:
                booking = slot_record.booking
                if booking.status in (BookingStatus.Confirmed, BookingStatus.CHECKED_IN):
                    status = SlotDisplayStatus.BOOKED
                elif booking.status == BookingStatus.Pending and getattr(booking, 'hold_expires_at', None) and booking.hold_expires_at > now:
                    status = SlotDisplayStatus.HOLD
                else:
                    status = SlotDisplayStatus.FREE

                slots.append(SlotGridItem(
                    court_id=court.id,
                    court_name=court.name,
                    start_at=start_dt,
                    end_at=end_dt,
                    status=status,
                    price=slot_record.amount or 50000,
                    booking_id=booking.id,
                    hold_expires_at=getattr(booking, 'hold_expires_at', None)
                ))
            else:
                # Slot trống hoàn toàn
                slots.append(SlotGridItem(
                    court_id=court.id,
                    court_name=court.name,
                    start_at=start_dt,
                    end_at=end_dt,
                    status=SlotDisplayStatus.FREE,
                    price=50000
                ))

        result.append(CourtSlotGrid(
            court_id=court.id,
            court_name=court.name,
            slots=slots
        ))

    return result