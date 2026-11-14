from datetime import datetime, date, time, timedelta
from decimal import Decimal
from typing import List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.models.court import Court, CourtStatus
from app.models.court_block import CourtBlock
from app.models.booking_slot import BookingSlot, BookingSlotStatus
from app.models.booking import Booking, BookingStatus

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


def _get_cancelled_booking_status():
    return getattr(BookingStatus, "Cancelled", None) or getattr(BookingStatus, "CANCELLED")


def _get_user_column():
    return getattr(Booking, "user_id", None) or getattr(Booking, "customer_id")


def hold_slots(db: Session, payload: SlotHoldRequest) -> SlotHoldResponse:
    """
    Giữ tạm một hoặc nhiều slot liền nhau trong 10 phút (dùng transaction with_for_update chống trùng).
    """
    now = datetime.now()
    hold_expires_at = now + timedelta(minutes=10)
    cancelled_status = _get_cancelled_booking_status()
    user_col = _get_user_column()

    try:
        court = db.query(Court).filter(Court.id == payload.court_id).first()
        if not court:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy sân")

        if court.status in (CourtStatus.Maintenance, CourtStatus.Inactive):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sân đang bảo trì hoặc ngưng hoạt động",
            )

        # 1. Khóa kiểm tra lịch bảo trì sân (CourtBlock)
        block_conditions = [
            and_(CourtBlock.start_time < item.end_at, CourtBlock.end_time > item.start_at)
            for item in payload.slots
        ]
        has_lock = (
            db.query(CourtBlock)
            .filter(CourtBlock.court_id == payload.court_id, or_(*block_conditions))
            .with_for_update()
            .first()
        )
        if has_lock:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Khung giờ này đang bị khóa bảo trì.",
            )

        # 2. Khóa các BookingSlot trùng khung giờ trong transaction (2 người đặt cùng lúc chỉ 1 người thành công)
        overlap_conditions = [
            and_(BookingSlot.start_at < item.end_at, BookingSlot.end_at > item.start_at)
            for item in payload.slots
        ]
        existing_slots = (
            db.query(BookingSlot)
            .join(Booking, BookingSlot.booking_id == Booking.id)
            .filter(
                BookingSlot.court_id == payload.court_id,
                BookingSlot.status == BookingSlotStatus.Active,
                or_(*overlap_conditions),
            )
            .with_for_update()
            .all()
        )

        for slot in existing_slots:
            booking = slot.booking
            is_booked = booking.status in (BookingStatus.Confirmed, BookingStatus.CHECKED_IN)
            is_holding = (
                booking.status == BookingStatus.Pending
                and getattr(booking, "hold_expires_at", None) is not None
                and booking.hold_expires_at > now
            )

            if is_booked or is_holding:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Khung giờ {slot.start_at.strftime('%H:%M')} - {slot.end_at.strftime('%H:%M')} đã có người đặt hoặc đang được giữ.",
                )

            # Đơn Pending đã hết hạn 10 phút -> tự coi là trống & đánh dấu hủy đơn cũ
            if booking.status == BookingStatus.Pending:
                booking.status = cancelled_status
                slot.status = BookingSlotStatus.Cancelled

        # 3. Tạo bản ghi Booking ở trạng thái Pending giữ chỗ 10 phút
        booking_kwargs = {
            user_col.key: payload.user_id,
            "status": BookingStatus.Pending,
            "hold_expires_at": hold_expires_at,
        }
        new_booking = Booking(**booking_kwargs)
        db.add(new_booking)
        db.flush()

        # 4. Tạo các BookingSlot liền nhau gắn với new_booking.id
        held_slot_ids = []
        total_amount = Decimal("0")
        default_price = Decimal("50000")

        for item in payload.slots:
            duration = int((item.end_at - item.start_at).total_seconds() // 60)
            amount = (Decimal(duration) / Decimal(60)) * default_price
            total_amount += amount

            new_slot = BookingSlot(
                booking_id=new_booking.id,
                court_id=payload.court_id,
                start_at=item.start_at,
                end_at=item.end_at,
                duration_minutes=duration,
                price_per_hour=default_price,
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
            court_id=payload.court_id,
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
        target_ranges = {(s.start_at, s.end_at) for s in payload.slots}
        released_count = 0

        for slot in list(booking.booking_slots):
            if (slot.start_at, slot.end_at) in target_ranges:
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