from datetime import datetime, date, time, timedelta
from decimal import Decimal
from typing import List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.models.court import Court, CourtStatus
from app.models.court_block import CourtBlock
from app.models.booking_slot import BookingSlot, BookingSlotStatus
from app.models.booking import Booking, BookingChannel, BookingStatus
from app.crud.booking import booking_blocks_slot, generate_booking_code, get_price_per_hour, vietnam_now

from app.schemas.slot import (
    SlotDisplayStatus,
    SlotGridItem,
    CourtSlotGrid,
    SlotHoldRequest,
    SlotHoldResponse,
    SlotReleaseRequest,
)


def is_slot_free(db: Session, court_id: int, start_at: datetime, end_at: datetime) -> bool:
    """
    Hàm dùng chung kiểm tra slot có trống không.
    """
    now = vietnam_now()

    # 1. Kiểm tra khoá sân (CourtBlock)
    has_lock = db.query(CourtBlock).filter(
        CourtBlock.court_id == court_id,
        CourtBlock.start_at < end_at,
        CourtBlock.end_at > start_at
    ).first()

    if has_lock:
        return False

    # 2. Kiểm tra slot đã được đặt (BookingSlot join Booking)
    has_booking_slot = db.query(BookingSlot).join(Booking).filter(
        BookingSlot.court_id == court_id,
        BookingSlot.status == BookingSlotStatus.Active,
        BookingSlot.start_at < end_at,
        BookingSlot.end_at > start_at,
        booking_blocks_slot(now),
    ).first()

    if has_booking_slot:
        return False

    return True


def get_slot_grid_by_date(
    db: Session,
    query_date: date,
    slot_minutes: int = 60,
) -> List[CourtSlotGrid]:
    """
    Quét ma trận slot theo ngày chuẩn xác theo Model.
    """
    now = vietnam_now()
    courts = db.query(Court).all()
    result = []

    if slot_minutes not in (30, 60):
        raise ValueError("slot_minutes chỉ hỗ trợ 30 hoặc 60 phút")

    open_minutes = 6 * 60
    close_minutes = 23 * 60

    for court in courts:
        slots = []

        # Kiểm tra xem sân có đang ở trạng thái Bảo trì/Ngưng hoạt động không
        is_maintenance = (court.status == CourtStatus.Maintenance or court.status == CourtStatus.Inactive)

        for minute_of_day in range(open_minutes, close_minutes, slot_minutes):
            start_time = time(minute_of_day // 60, minute_of_day % 60)
            end_minute_of_day = minute_of_day + slot_minutes
            end_time = time(end_minute_of_day // 60, end_minute_of_day % 60)
            start_dt = datetime.combine(query_date, start_time)
            end_dt = datetime.combine(query_date, end_time)
            price_per_hour = get_price_per_hour(db, court.id, query_date, start_time)
            cell_price = (
                price_per_hour * Decimal(slot_minutes) / Decimal(60)
            ).quantize(Decimal("0.01"))
            
            # 1. Trường hợp Sân ngưng hoạt động / bảo trì toàn thời gian
            if is_maintenance:
                slots.append(SlotGridItem(
                    court_id=court.id,
                    court_name=court.name,
                    start_at=start_dt,
                    end_at=end_dt,
                    status=SlotDisplayStatus.LOCKED,
                    price=cell_price,
                    lock_reason="Sân đang bảo trì/ngừng hoạt động"
                ))
                continue

            # 2. Kiểm tra Lịch khoá sân theo khung giờ (CourtBlock)
            lock = db.query(CourtBlock).filter(
                CourtBlock.court_id == court.id,
                CourtBlock.start_at < end_dt,
                CourtBlock.end_at > start_dt
            ).first()

            if lock:
                slots.append(SlotGridItem(
                    court_id=court.id,
                    court_name=court.name,
                    start_at=start_dt,
                    end_at=end_dt,
                    status=SlotDisplayStatus.LOCKED,
                    price=cell_price,
                    lock_reason=lock.reason or "Bảo trì khung giờ"
                ))
                continue

            # 3. Kiểm tra BookingSlot trong khung giờ
            slot_record = db.query(BookingSlot).join(Booking).filter(
                BookingSlot.court_id == court.id,
                BookingSlot.status == BookingSlotStatus.Active,
                BookingSlot.start_at < end_dt,
                BookingSlot.end_at > start_dt,
                booking_blocks_slot(now),
            ).first()

            if slot_record:
                booking = slot_record.booking
                if booking.status in (BookingStatus.Confirmed, BookingStatus.CHECKED_IN) or (
                    booking.status == BookingStatus.Pending and booking.hold_expires_at is None
                ):
                    status_display = SlotDisplayStatus.BOOKED
                elif booking.status == BookingStatus.Pending and getattr(booking, 'hold_expires_at', None) and booking.hold_expires_at > now:
                    status_display = SlotDisplayStatus.HOLD
                else:
                    status_display = SlotDisplayStatus.FREE

                slots.append(SlotGridItem(
                    court_id=court.id,
                    court_name=court.name,
                    start_at=start_dt,
                    end_at=end_dt,
                    status=status_display,
                    price=(
                        (slot_record.price_per_hour * Decimal(slot_minutes) / Decimal(60)).quantize(Decimal("0.01"))
                        if slot_minutes == 30
                        else slot_record.amount or cell_price
                    ),
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
                    price=cell_price
                ))

        result.append(CourtSlotGrid(
            court_id=court.id,
            court_name=court.name,
            slots=slots
        ))

    return result


def _get_cancelled_booking_status():
    return getattr(BookingStatus, "Cancelled", None) or getattr(BookingStatus, "CANCELLED")


def _get_user_column():
    return getattr(Booking, "user_id", None) or getattr(Booking, "customer_id")


def hold_slots(db: Session, payload: SlotHoldRequest) -> SlotHoldResponse:
    """
    Giữ tạm một hoặc nhiều slot liền nhau trong 10 phút (dùng transaction with_for_update chống trùng).
    """
    now = vietnam_now()
    hold_expires_at = now + timedelta(minutes=10)
    cancelled_status = _get_cancelled_booking_status()
    user_col = _get_user_column()
    slots_by_court: dict[int, list] = {}
    for item in payload.slots:
        if item.court_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Mỗi khung giờ cần có sân tương ứng.",
            )
        slots_by_court.setdefault(item.court_id, []).append(item)

    try:
        if any(item.start_at <= now for item in payload.slots):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể giữ khung giờ đã bắt đầu hoặc đã qua.",
            )

        for court_id, court_slots in slots_by_court.items():
            court = db.query(Court).filter(Court.id == court_id).first()
            if not court:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Không tìm thấy sân id={court_id}")

            if court.status in (CourtStatus.Maintenance, CourtStatus.Inactive):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Sân {court.name} đang bảo trì hoặc ngưng hoạt động.",
                )

            block_conditions = [
                and_(CourtBlock.start_at < item.end_at, CourtBlock.end_at > item.start_at)
                for item in court_slots
            ]
            has_lock = (
                db.query(CourtBlock)
                .filter(CourtBlock.court_id == court_id, or_(*block_conditions))
                .with_for_update()
                .first()
            )
            if has_lock:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Có khung giờ tại {court.name} đang bị khóa bảo trì.",
                )

            overlap_conditions = [
                and_(BookingSlot.start_at < item.end_at, BookingSlot.end_at > item.start_at)
                for item in court_slots
            ]
            existing_slots = (
                db.query(BookingSlot)
                .join(Booking, BookingSlot.booking_id == Booking.id)
                .filter(
                    BookingSlot.court_id == court_id,
                    BookingSlot.status == BookingSlotStatus.Active,
                    or_(*overlap_conditions),
                )
                .with_for_update()
                .all()
            )

            for slot in existing_slots:
                booking = slot.booking
                is_booked = booking.status in (BookingStatus.Confirmed, BookingStatus.CHECKED_IN) or (
                    booking.status == BookingStatus.Pending and booking.hold_expires_at is None
                )
                is_holding = (
                    booking.status == BookingStatus.Pending
                    and booking.hold_expires_at is not None
                    and booking.hold_expires_at > now
                )

                if is_booked or is_holding:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Khung giờ {slot.start_at.strftime('%H:%M')} - {slot.end_at.strftime('%H:%M')} tại {court.name} đã có người đặt hoặc đang được giữ.",
                    )

                if booking.status == BookingStatus.Pending:
                    booking.status = cancelled_status
                    slot.status = BookingSlotStatus.Cancelled

        # 3. Tạo bản ghi Booking ở trạng thái Pending giữ chỗ 10 phút
        booking_kwargs = {
            user_col.key: payload.user_id,
            "booking_code": generate_booking_code(),
            "booking_channel": BookingChannel.Online,
            "status": BookingStatus.Pending,
            "hold_expires_at": hold_expires_at,
        }
        new_booking = Booking(**booking_kwargs)
        db.add(new_booking)
        db.flush()

        # 4. Tạo các BookingSlot liền nhau gắn với new_booking.id
        held_slot_ids = []
        total_amount = Decimal("0")

        for item in payload.slots:
            duration = int((item.end_at - item.start_at).total_seconds() // 60)
            price_per_hour = get_price_per_hour(
                db, item.court_id, item.start_at.date(), item.start_at.time()
            )
            amount = (Decimal(duration) / Decimal(60)) * price_per_hour
            total_amount += amount

            new_slot = BookingSlot(
                booking_id=new_booking.id,
                court_id=item.court_id,
                start_at=item.start_at,
                end_at=item.end_at,
                duration_minutes=duration,
                price_per_hour=price_per_hour,
                amount=amount,
                status=BookingSlotStatus.Active,
            )
            db.add(new_slot)
            db.flush()
            held_slot_ids.append(new_slot.id)

        if hasattr(new_booking, "total_amount"):
            new_booking.total_amount = total_amount

        db.commit()
        return SlotHoldResponse(
            booking_id=new_booking.id,
            court_id=next(iter(slots_by_court)),
            court_ids=list(slots_by_court),
            held_slot_ids=held_slot_ids,
            hold_expires_at=hold_expires_at,
            message="Giữ chỗ thành công trong 10 phút",
        )

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


def release_slots(db: Session, payload: SlotReleaseRequest) -> dict:
    """
    Nhả chỗ ngay lập tức khi khách bỏ chọn slot.
    """
    user_col = _get_user_column()

    try:
        booking = (
            db.query(Booking)
            .filter(
                Booking.id == payload.booking_id,
                user_col == payload.user_id,
                Booking.status == BookingStatus.Pending,
            )
            .with_for_update()
            .first()
        )
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy phiên giữ chỗ hợp lệ hoặc phiên đã hết hạn.",
            )

        # Không truyền danh sách slot -> hủy toàn bộ phiên giữ
        if not payload.slots:
            released_count = len(booking.booking_slots)
            db.delete(booking)
            db.commit()
            return {"released_count": released_count, "message": "Đã nhả toàn bộ slot đang giữ"}

        # Bỏ chọn bớt 1 vài slot cụ thể
        target_ranges = {
            (s.court_id, s.start_at, s.end_at)
            for s in payload.slots
            if s.court_id is not None
        }
        legacy_ranges = {
            (s.start_at, s.end_at)
            for s in payload.slots
            if s.court_id is None
        }
        released_count = 0

        for slot in list(booking.booking_slots):
            matches_range = (slot.court_id, slot.start_at, slot.end_at) in target_ranges
            matches_legacy_range = (slot.start_at, slot.end_at) in legacy_ranges
            if matches_range or matches_legacy_range:
                db.delete(slot)
                released_count += 1

        db.flush()
        db.refresh(booking)

        if not booking.booking_slots:
            db.delete(booking)
        elif hasattr(booking, "total_amount"):
            booking.total_amount = sum(s.amount for s in booking.booking_slots)

        db.commit()
        return {"released_count": released_count, "message": "Đã nhả chỗ thành công"}

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
