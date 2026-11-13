from datetime import date, datetime, time, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
import uuid
from app.models.user import User, UserRole, UserStatus


from sqlalchemy import and_, or_, select, text
from sqlalchemy.orm import Session


from app.models.booking import Booking, BookingChannel, BookingStatus
from app.models.booking_slot import BookingSlot, BookingSlotStatus
from app.models.court_block import CourtBlock
from app.schemas.booking import BookingCreate
from app.models.court import Court, CourtStatus
from app.models.price_rule import PriceRule, PriceRuleStatus



def generate_booking_code() -> str:
    """Tạo mã booking duy nhất: BK + ngày + random. VD: BK261109-X3K7."""
    date_part = datetime.now().strftime("%y%m%d")
    suffix = uuid.uuid4().hex[:4].upper()
    return f"BK{date_part}-{suffix}"


def get_or_create_user(
    db: Session,
    name: str | None = None,
    phone: str | None = None,
) -> User:
    if phone:
        user = db.scalar(select(User).where(User.phone == phone))
        if user:
            return user

    unique_id = uuid.uuid4().hex[:8]

    if phone:
        phone_digits = "".join(char for char in phone if char.isdigit())
        email = f"guest_{phone_digits}_{unique_id}@guest.local"
    else:
        email = f"guest_{unique_id}@guest.local"
        phone = f"GUEST{uuid.uuid4().hex[:10]}"

    user = User(
        full_name=name or "Khách vãng lai",
        email=email,
        phone=phone,
        hashed_password="",
        role=UserRole.CUSTOMER,
        status=UserStatus.ACTIVE,
    )

    db.add(user)
    db.flush()

    return user




# ──────────── module Sân: tính giá theo PriceRule ────────────




def get_price_per_hour(
    db: Session,
    court_id: int,
    target_date: date,
    target_time: time,
) -> Decimal:
    dow = target_date.weekday()  # 0=Mon, 6=Sun


    rule = db.scalars(
        select(PriceRule)
        .where(
            PriceRule.court_id == court_id,
            PriceRule.day_of_week == dow,
            PriceRule.start_time <= target_time,
            PriceRule.end_time > target_time,
            PriceRule.status == PriceRuleStatus.Active,
        )
        .limit(1)
    ).first()


    if rule:
        return rule.price_per_hour
    return Decimal("50000")  # giá mặc định




def calculate_slot_amount(
    db: Session,
    court_id: int,
    booking_date: date,
    start_time: time,
    end_time: time,
) -> tuple[Decimal, Decimal, int]:
    """Tính tiền cho 1 slot dựa trên bảng giá.


    Returns: (price_per_hour, amount, duration_minutes)
    """
    price_per_hour = get_price_per_hour(db, court_id, booking_date, start_time)


    start_dt = datetime.combine(booking_date, start_time)
    end_dt = datetime.combine(booking_date, end_time)
    duration = end_dt - start_dt
    duration_minutes = int(duration.total_seconds() / 60)


    # amount = price_per_hour * (duration / 60 phút)
    amount = (price_per_hour * Decimal(duration_minutes) / Decimal(60)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )


    return price_per_hour, amount, duration_minutes




def is_slot_available(
    db: Session,
    court_id: int,
    start_at: datetime,
    end_at: datetime,
    *,
    exclude_booking_id: int | None = None,
    lock: bool = False,
) -> bool:
    """Kiểm tra slot [start_at, end_at) có trống không.


    Kiểm tra 2 nguồn xung đột:
      1. BookingSlot đang Active (đã đặt / đang giữ)
      2. CourtBlock đang Active (sân bảo trì)


    Khi lock=True → dùng FOR UPDATE để lock rows, chống race-condition.
    """
    # --- 1. Kiểm tra BookingSlot trùng ---
    slot_query = (
        select(BookingSlot.id)
        .join(Booking, Booking.id == BookingSlot.booking_id)
        .where(
            BookingSlot.court_id == court_id,
            BookingSlot.status == BookingSlotStatus.Active,
            Booking.status.in_(
                [BookingStatus.Pending, BookingStatus.Confirmed, BookingStatus.CHECKED_IN]),
            # overlap: slot_start < end_at AND slot_end > start_at
            BookingSlot.start_at < end_at,
            BookingSlot.end_at > start_at,
        )
    )
    if exclude_booking_id:
        slot_query = slot_query.where(
            BookingSlot.booking_id != exclude_booking_id)


    if lock:
        slot_query = slot_query.with_for_update()


    conflict_slot = db.scalars(slot_query.limit(1)).first()
    if conflict_slot is not None:
        return False


    # --- 2. Kiểm tra CourtBlock trùng ---
    block_query = (
        select(CourtBlock.id)
        .where(
            CourtBlock.court_id == court_id,
            CourtBlock.start_at < end_at,
            CourtBlock.end_at > start_at,
        )
    )
    if lock:
        block_query = block_query.with_for_update()


    conflict_block = db.scalars(block_query.limit(1)).first()
    if conflict_block is not None:
        return False


    return True




def create_booking(db: Session, data: BookingCreate) -> Booking:
    # 1. Kiểm tra sân
    court = db.get(Court, data.court_id)
    if court is None:
        raise ValueError(f"Sân id={data.court_id} không tồn tại")
    if hasattr(court, "status") and court.status not in (
        "HOẠT ĐỘNG",
        "Active",
        CourtStatus.Active if hasattr(CourtStatus, "Active") else "Active",
    ):
        raise ValueError(
            f"Sân '{court.name if hasattr(court, 'name') else court.court_name}' đang không hoạt động")


    # Tính start_at / end_at
    start_at = datetime.combine(data.booking_date, data.start_time)
    end_at = datetime.combine(data.booking_date, data.end_time)
    if end_at <= start_at:
        raise ValueError("Giờ kết thúc phải sau giờ bắt đầu")


    # 2. Lock + kiểm tra slot (trong cùng transaction)
    if not is_slot_available(db, data.court_id, start_at, end_at, lock=True):
        raise ConflictError(
            f"Slot {data.start_time}–{data.end_time} ngày {data.booking_date} "
            f"tại sân id={data.court_id} đã được đặt!"
        )


    # 3. Tính giá
    price_per_hour, amount, duration_minutes = calculate_slot_amount(
        db, data.court_id, data.booking_date, data.start_time, data.end_time
    )


    # 4. Tạo hoặc lấy User
    user_id = getattr(data, "user_id", None)
    if not user_id:
        user = get_or_create_user(
            db,
            name=getattr(data, "customer_name", None),
            phone=getattr(data, "customer_phone", None),
        )
        user_id = user.id

    # Tạo Booking
    booking = Booking(
        booking_code=generate_booking_code(),
        user_id=user_id,
        booking_channel=data.booking_channel,
        total_price=amount,
        status=BookingStatus.Pending,
        note=data.note,
    )
    db.add(booking)
    db.flush()  # lấy booking.id nhưng chưa commit


    # 5. Tạo BookingSlot
    slot = BookingSlot(
        booking_id=booking.id,
        court_id=data.court_id,
        start_at=start_at,
        end_at=end_at,
        duration_minutes=duration_minutes,
        price_per_hour=price_per_hour,
        amount=amount,
        status=BookingSlotStatus.Active,
    )
    db.add(slot)


    # 6. Commit toàn bộ transaction
    db.commit()
    db.refresh(booking)
    return booking




def confirm_booking(db: Session, booking_id: int) -> Booking:
    """Khách xác nhận booking đang Pending → Confirmed.


    - Kiểm tra booking tồn tại, status=Pending
    - Re-check slot vẫn khả dụng (FOR UPDATE)
    - Tính lại tiền bằng hàm giá module Sân (đảm bảo đúng giá hiện tại)
    - Cập nhật status → Confirmed
    """
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise ValueError(f"Booking id={booking_id} không tồn tại")
    if booking.status != BookingStatus.Pending:
        raise ValueError(
            f"Chỉ xác nhận booking đang Pending. Hiện tại: {booking.status.value}"
        )


    # Tính lại tổng tiền từ các slot Active
    total = Decimal("0")
    for slot in booking.booking_slots:
        if slot.status != BookingSlotStatus.Active:
            continue


        # Re-check slot availability (loại trừ chính booking này)
        if not is_slot_available(
            db, slot.court_id, slot.start_at, slot.end_at,
            exclude_booking_id=booking.id, lock=True,
        ):
            raise ConflictError(
                f"Slot {slot.start_at} – {slot.end_at} tại sân id={slot.court_id} "
                f"đã bị đặt bởi người khác!"
            )


        # Tính lại giá theo PriceRule hiện tại
        slot_date = slot.start_at.date()
        slot_time = slot.start_at.time()
        price_per_hour = get_price_per_hour(
            db, slot.court_id, slot_date, slot_time)
        duration_minutes = int(
            (slot.end_at - slot.start_at).total_seconds() / 60)
        amount = (price_per_hour * Decimal(duration_minutes) / Decimal(60)).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        slot.price_per_hour = price_per_hour
        slot.amount = amount
        total += amount


    booking.total_price = total
    booking.status = BookingStatus.Confirmed


    db.commit()
    db.refresh(booking)
    return booking




def get_bookings(
    db: Session,
    *,
    booking_date: date | None = None,
    court_id: int | None = None,
    status: str | None = None,
) -> list[Booking]:
    query = select(Booking).order_by(Booking.created_at.desc())
    if status:
        query = query.where(Booking.status == status)
    if court_id or booking_date:
        query = query.join(BookingSlot)
        if court_id:
            query = query.where(BookingSlot.court_id == court_id)
        if booking_date:
            day_start = datetime.combine(booking_date, time.min)
            day_end = datetime.combine(booking_date, time.max)
            query = query.where(
                BookingSlot.start_at >= day_start,
                BookingSlot.start_at <= day_end,
            )
    return list(db.scalars(query.distinct()))




def get_booking(db: Session, booking_id: int) -> Booking | None:
    return db.get(Booking, booking_id)




def update_booking_status(db: Session, booking: Booking, new_status: BookingStatus) -> Booking:
    booking.status = new_status
    db.commit()
    db.refresh(booking)
    return booking




def delete_booking(db: Session, booking: Booking) -> None:
    db.delete(booking)
    db.commit()




# ──────────── Custom exceptions ────────────




class ConflictError(Exception):
    """Slot đã bị chiếm bởi người khác (HTTP 409)."""
    pass
