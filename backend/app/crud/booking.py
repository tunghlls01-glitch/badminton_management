from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
import uuid
from app.models.user import User, UserRole, UserStatus


from sqlalchemy import and_, or_, select, text
from sqlalchemy.orm import Session


from app.models.booking import Booking, BookingChannel, BookingStatus
from app.models.booking_slot import BookingSlot, BookingSlotStatus
from app.models.court_block import CourtBlock
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.schemas.booking import (
    BookingCreate,
    RecurringCheckRequest,
    RecurringBookingCreate,
)
from app.models.court import Court, CourtStatus
from app.models.price_rule import PriceRule, PriceRuleStatus
from app.models.public_pricing import PublicPricing
from app.models.promotion import Promotion


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
    public_table = db.get(PublicPricing, 1)
    if public_table and public_table.rules:
        day_type = "WEEKEND" if target_date.weekday() >= 5 else "WEEKDAY"
        for rule in public_table.rules:
            if rule.get("day_type") not in (day_type, "ALL"):
                continue
            start_value = rule.get("start_time")
            end_value = rule.get("end_time")
            start_time = start_value if isinstance(start_value, time) else time.fromisoformat(str(start_value))
            end_time = end_value if isinstance(end_value, time) else time.fromisoformat(str(end_value))
            if start_time <= target_time < end_time:
                return Decimal(str(rule.get("price", 0)))

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


def vietnam_now() -> datetime:
    return datetime.now(timezone(timedelta(hours=7))).replace(tzinfo=None)


def booking_blocks_slot(now: datetime):
    return or_(
        Booking.status.in_([BookingStatus.Confirmed, BookingStatus.CHECKED_IN]),
        and_(
            Booking.status == BookingStatus.Pending,
            or_(Booking.hold_expires_at.is_(None), Booking.hold_expires_at > now),
        ),
    )
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
            booking_blocks_slot(vietnam_now()),
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


def create_booking(
    db: Session,
    data: BookingCreate,
    *,
    created_by: int | None = None,
) -> Booking:
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
        created_by=created_by,
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


def create_walk_in_booking(
    db: Session,
    data: BookingCreate,
    *,
    created_by: int,
) -> Booking:
    """Tạo một booking quầy gồm nhiều ô 30 phút liền nhau."""
    court = db.get(Court, data.court_id)
    if court is None:
        raise ValueError(f"Sân id={data.court_id} không tồn tại")
    if court.status not in (CourtStatus.Active, "Active", "HOẠT ĐỘNG"):
        raise ValueError(f"Sân '{court.name}' đang không hoạt động")

    start_at = datetime.combine(data.booking_date, data.start_time)
    end_at = datetime.combine(data.booking_date, data.end_time)
    duration_minutes = int((end_at - start_at).total_seconds() / 60)
    if duration_minutes < 30 or duration_minutes % 30 != 0:
        raise ValueError("Thời lượng đặt phải là bội số của 30 phút")
    if not is_slot_available(db, data.court_id, start_at, end_at, lock=True):
        raise ConflictError(
            f"Khung giờ {data.start_time}–{data.end_time} ngày {data.booking_date} "
            f"tại sân id={data.court_id} vừa có người đặt hoặc giữ chỗ."
        )

    try:
        user = get_or_create_user(
            db,
            name=data.customer_name,
            phone=data.customer_phone,
        )
        booking = Booking(
            booking_code=generate_booking_code(),
            user_id=user.id,
            created_by=created_by,
            booking_channel=BookingChannel.Counter,
            total_price=Decimal("0"),
            status=BookingStatus.Pending,
            hold_expires_at=None,
            note=data.note,
        )
        db.add(booking)
        db.flush()

        total_amount = Decimal("0")
        cursor = start_at
        while cursor < end_at:
            segment_end = cursor + timedelta(minutes=30)
            price_per_hour = get_price_per_hour(
                db,
                data.court_id,
                data.booking_date,
                cursor.time(),
            )
            amount = (
                price_per_hour * Decimal("30") / Decimal("60")
            ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            db.add(BookingSlot(
                booking_id=booking.id,
                court_id=data.court_id,
                start_at=cursor,
                end_at=segment_end,
                duration_minutes=30,
                price_per_hour=price_per_hour,
                amount=amount,
                status=BookingSlotStatus.Active,
            ))
            total_amount += amount
            cursor = segment_end

        booking.total_price = total_amount
        db.commit()
        db.refresh(booking)
        return booking
    except Exception:
        db.rollback()
        raise


def check_recurring_availability(db: Session, data: RecurringCheckRequest) -> dict:
    """Kiểm tra từng tuần trong chuỗi 4–8 tuần xem tuần nào trống, tuần nào trùng."""
    court = db.get(Court, data.court_id)
    if court is None:
        raise ValueError(f"Sân id={data.court_id} không tồn tại")

    court_name = getattr(court, "name", None) or getattr(
        court, "court_name", None) or f"Sân {court.id}"
    weeks = []
    available_count = 0
    conflict_count = 0
    estimated_total = Decimal("0")

    dow_names = ["Thứ Hai", "Thứ Ba", "Thứ Tư",
                 "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"]

    for week_idx in range(data.weeks_count):
        cur_date = data.start_date + timedelta(days=week_idx * 7)
        start_at = datetime.combine(cur_date, data.start_time)
        end_at = datetime.combine(cur_date, data.end_time)

        available = is_slot_available(
            db, data.court_id, start_at, end_at, lock=False)
        dow_str = dow_names[cur_date.weekday()]

        price_per_hour, amount, duration_minutes = calculate_slot_amount(
            db, data.court_id, cur_date, data.start_time, data.end_time
        )

        reason = None
        if not available:
            conflict_count += 1
            reason = "Khung giờ này đã có người đặt trước hoặc sân bận"
        else:
            available_count += 1
            estimated_total += amount

        weeks.append({
            "week_number": week_idx + 1,
            "booking_date": cur_date,
            "day_of_week": dow_str,
            "start_time": data.start_time.strftime("%H:%M"),
            "end_time": data.end_time.strftime("%H:%M"),
            "is_available": available,
            "conflict_reason": reason,
            "price": float(amount),
        })

    return {
        "court_id": data.court_id,
        "court_name": court_name,
        "total_weeks": data.weeks_count,
        "available_weeks_count": available_count,
        "conflict_weeks_count": conflict_count,
        "has_conflicts": conflict_count > 0,
        "estimated_total_price": float(estimated_total),
        "weeks": weeks,
    }


def create_recurring_booking(
    db: Session, data: RecurringBookingCreate
) -> tuple[Booking, list[date], list[date]]:
    """Tạo chuỗi đặt sân cố định hàng tuần trong MỘT transaction duy nhất.

    - Kiểm tra từng tuần.
    - Tuần nào trùng mà nằm trong `skip_conflict_dates` thì cho phép bỏ qua.
    - Tuần nào trùng mà chưa được người dùng xác nhận bỏ qua thì rollback và raise ConflictError.
    - Tạo 1 Booking và nhiều BookingSlot (mỗi tuần 1 slot) trong cùng 1 transaction.
    """
    court = db.get(Court, data.court_id)
    if court is None:
        raise ValueError(f"Sân id={data.court_id} không tồn tại")
    if hasattr(court, "status") and court.status not in (
        "HOẠT ĐỘNG",
        "Active",
        CourtStatus.Active if hasattr(CourtStatus, "Active") else "Active",
    ):
        raise ValueError(
            f"Sân '{court.name if hasattr(court, 'name') else court.court_name}' đang không hoạt động"
        )

    if data.end_time <= data.start_time:
        raise ValueError("Giờ kết thúc phải sau giờ bắt đầu")

    if data.weeks_count < 4 or data.weeks_count > 8:
        raise ValueError("Số tuần đặt cố định phải từ 4 đến 8 tuần")

    skip_set = set(data.skip_conflict_dates)
    booked_dates = []
    skipped_dates = []
    slots_to_create = []
    total_amount = Decimal("0")

    try:
        # Kiểm tra và lock từng tuần
        for week_idx in range(data.weeks_count):
            cur_date = data.start_date + timedelta(days=week_idx * 7)
            start_at = datetime.combine(cur_date, data.start_time)
            end_at = datetime.combine(cur_date, data.end_time)

            available = is_slot_available(
                db, data.court_id, start_at, end_at, lock=True)

            if not available:
                if cur_date in skip_set:
                    # Người dùng đồng ý bỏ qua tuần trùng này
                    skipped_dates.append(cur_date)
                    continue
                else:
                    raise ConflictError(
                        f"Tuần {week_idx + 1} (ngày {cur_date.strftime('%d/%m/%Y')}) đã bị trùng lịch! "
                        f"Vui lòng xác nhận bỏ qua tuần này để tiếp tục tạo đơn."
                    )

            price_per_hour, amount, duration_minutes = calculate_slot_amount(
                db, data.court_id, cur_date, data.start_time, data.end_time
            )
            booked_dates.append(cur_date)
            total_amount += amount
            slots_to_create.append({
                "court_id": data.court_id,
                "start_at": start_at,
                "end_at": end_at,
                "duration_minutes": duration_minutes,
                "price_per_hour": price_per_hour,
                "amount": amount,
            })

        if not slots_to_create:
            raise ValueError(
                "Không có tuần nào khả dụng để tạo lịch đặt sân cố định!")

        # Tạo hoặc lấy user
        user = get_or_create_user(
            db,
            name=data.customer_name,
            phone=data.customer_phone,
        )

        note_prefix = f"Đặt cố định {len(slots_to_create)}/{data.weeks_count} tuần"
        full_note = f"{note_prefix} | {data.note}" if data.note else note_prefix

        # Tạo Booking
        booking = Booking(
            booking_code=generate_booking_code(),
            user_id=user.id,
            booking_channel=data.booking_channel,
            total_price=total_amount,
            status=BookingStatus.Pending,
            note=full_note,
        )
        db.add(booking)
        db.flush()

        # Tạo BookingSlot cho từng tuần
        for s in slots_to_create:
            slot = BookingSlot(
                booking_id=booking.id,
                court_id=s["court_id"],
                start_at=s["start_at"],
                end_at=s["end_at"],
                duration_minutes=s["duration_minutes"],
                price_per_hour=s["price_per_hour"],
                amount=s["amount"],
                status=BookingSlotStatus.Active,
            )
            db.add(slot)

        # Commit toàn bộ trong 1 transaction duy nhất
        db.commit()
        db.refresh(booking)
        return booking, booked_dates, skipped_dates

    except Exception:
        db.rollback()
        raise


FIRST_BOOKING_PROMOTION_CODE = "FIRST15"


def _has_prior_submitted_booking(db: Session, user_id: int, exclude_booking_id: int) -> bool:
    prior_booking = db.scalar(
        select(Booking.id)
        .where(
            Booking.user_id == user_id,
            Booking.id != exclude_booking_id,
            Booking.hold_expires_at.is_(None),
            Booking.status.notin_((BookingStatus.Cancelled, BookingStatus.Expired)),
        )
        .limit(1)
    )
    return prior_booking is not None


def resolve_booking_promotion(
    db: Session,
    booking: Booking,
    code: str | None,
    *,
    lock_user: bool = False,
) -> dict:
    """Validate a user-entered promotion or select the first-booking offer."""
    if lock_user:
        db.query(User).filter(User.id == booking.user_id).with_for_update().first()

    has_prior_booking = _has_prior_submitted_booking(db, booking.user_id, booking.id)
    requested_code = (code or "").strip().upper()
    automatically_applied = False
    if not requested_code:
        if has_prior_booking:
            return {"promotion": None, "automatically_applied": False}
        requested_code = FIRST_BOOKING_PROMOTION_CODE
        automatically_applied = True

    query = select(Promotion).where(Promotion.code == requested_code)
    if lock_user:
        query = query.with_for_update()
    promotion = db.scalar(query)
    if promotion is None or not promotion.is_active:
        raise ValueError("Mã ưu đãi không tồn tại hoặc đã ngừng áp dụng.")
    if promotion.first_booking_only and has_prior_booking:
        raise ValueError("Mã này chỉ áp dụng cho lần đặt sân đầu tiên của tài khoản.")
    if promotion.discount_percent <= 0 or promotion.discount_percent > 100:
        raise ValueError("Mã ưu đãi có mức giảm không hợp lệ.")

    return {
        "promotion": promotion,
        "automatically_applied": automatically_applied,
    }


def preview_booking_promotion(
    db: Session,
    booking: Booking,
    code: str | None,
) -> dict:
    """Calculate current booking prices without reserving or consuming a promotion."""
    subtotal = Decimal("0")
    for slot in booking.booking_slots:
        if slot.status != BookingSlotStatus.Active:
            continue
        price_per_hour = get_price_per_hour(
            db, slot.court_id, slot.start_at.date(), slot.start_at.time()
        )
        duration = int((slot.end_at - slot.start_at).total_seconds() / 60)
        subtotal += (price_per_hour * Decimal(duration) / Decimal(60)).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

    resolved = resolve_booking_promotion(db, booking, code)
    promotion = resolved["promotion"]
    percent = Decimal(str(promotion.discount_percent)) if promotion else Decimal("0")
    discount = (subtotal * percent / Decimal("100")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    discount = min(discount, subtotal)
    return {
        "booking_id": booking.id,
        "subtotal_price": subtotal,
        "discount_code": promotion.code if promotion else None,
        "discount_name": promotion.name if promotion else None,
        "discount_percent": percent,
        "discount_amount": discount,
        "total_price": subtotal - discount,
        "automatically_applied": resolved["automatically_applied"],
        "message": (
            f"Đã tự động áp dụng {promotion.code}, giảm {percent.normalize()}% cho lần đặt đầu."
            if promotion and resolved["automatically_applied"]
            else f"Đã áp dụng {promotion.code}, giảm {percent.normalize()}%."
            if promotion
            else "Nhập mã ưu đãi nếu bạn có."
        ),
    }


def confirm_booking(
    db: Session,
    booking_id: int,
    *,
    payment_method: PaymentMethod | None = None,
    receipt_path: str | None = None,
    note: str | None = None,
    promotion_code: str | None = None,
) -> Booking:
    """Khách gửi booking đang giữ chỗ để lễ tân xác nhận.


    - Kiểm tra booking tồn tại, status=Pending
    - Re-check slot vẫn khả dụng (FOR UPDATE)
    - Tính lại tiền bằng hàm giá module Sân (đảm bảo đúng giá hiện tại)
    - Bỏ hạn giữ chỗ và giữ booking ở trạng thái Pending
    """
    booking = db.query(Booking).filter(Booking.id == booking_id).with_for_update().first()
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

    resolved_promotion = resolve_booking_promotion(
        db,
        booking,
        promotion_code,
        lock_user=True,
    )
    promotion = resolved_promotion["promotion"]
    discount_percent = Decimal(str(promotion.discount_percent)) if promotion else Decimal("0")
    discount_amount = (total * discount_percent / Decimal("100")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    discount_amount = min(discount_amount, total)
    booking.subtotal_price = total
    booking.discount_code = promotion.code if promotion else None
    booking.discount_percent = discount_percent
    booking.discount_amount = discount_amount
    booking.discount_reason = promotion.name if promotion else None
    booking.total_price = total - discount_amount
    booking.status = BookingStatus.Pending
    booking.hold_expires_at = None
    booking.booking_channel = BookingChannel.Online
    if note is not None:
        booking.note = note.strip() or None
    if payment_method is not None:
        db.add(Payment(
            booking_id=booking.id,
            amount=booking.total_price,
            payment_method=payment_method,
            payment_status=PaymentStatus.PENDING,
            receipt_path=receipt_path,
        ))

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


def calculate_cancellation_terms(
    booking: Booking, now: datetime | None = None
) -> tuple[datetime | None, float, int, float, str]:
    if now is None:
        now = datetime.now()

    earliest_start = None
    if booking.booking_slots:
        active_slots = [
            s for s in booking.booking_slots if s.status != BookingSlotStatus.Cancelled]
        slots_to_check = active_slots if active_slots else booking.booking_slots
        earliest_start = min(s.start_at for s in slots_to_check)

    if earliest_start is None:
        raise ValueError(
            "Lịch đặt sân không có khung giờ hợp lệ để tính chính sách hủy")

    diff_seconds = (earliest_start - now).total_seconds()
    hours_before = round(diff_seconds / 3600.0, 2)

    if hours_before <= 0:
        raise ValueError(
            "Không thể hủy đặt sân khi đã đến hoặc qua giờ vào sân!")

    if hours_before >= 24:
        refund_percent = 100
        policy_message = "Hủy trước 24 giờ: hoàn 100% tổng tiền"
    elif hours_before >= 6:
        refund_percent = 50
        policy_message = "Hủy trước 6 giờ (từ 6h – 24h): hoàn 50% tổng tiền"
    else:
        refund_percent = 0
        policy_message = "Hủy dưới 6 giờ trước giờ vào sân: không hoàn tiền (0%)"

    refund_amount = round(float(booking.total_price) *
                          (refund_percent / 100.0), 2)
    return earliest_start, hours_before, refund_percent, refund_amount, policy_message


def get_cancellation_preview(db: Session, booking: Booking) -> dict:
    if booking.status == BookingStatus.Cancelled:
        raise ValueError("Lịch đặt sân này đã được hủy trước đó")
    if booking.status in (BookingStatus.Completed, BookingStatus.CHECKED_IN):
        raise ValueError(
            f"Lịch đặt sân đang ở trạng thái {booking.status.value}, không thể hủy")

    earliest_start, hours_before, refund_percent, refund_amount, policy_message = calculate_cancellation_terms(
        booking)

    summary_message = (
        f"Còn {hours_before:.1f} giờ trước giờ vào sân. "
        f"Chính sách áp dụng: {policy_message}. "
        f"Hoàn lại: {refund_amount:,.0f}đ ({refund_percent}%)."
    )

    return {
        "booking_id": booking.id,
        "booking_code": booking.booking_code,
        "earliest_start": earliest_start,
        "hours_before": hours_before,
        "refund_percent": refund_percent,
        "refund_amount": refund_amount,
        "total_price": float(booking.total_price),
        "policy_message": policy_message,
        "summary_message": summary_message,
    }


def cancel_booking(db: Session, booking: Booking, reason: str | None = None) -> dict:
    if booking.status == BookingStatus.Cancelled:
        raise ValueError("Lịch đặt sân này đã được hủy trước đó")
    if booking.status in (BookingStatus.Completed, BookingStatus.CHECKED_IN):
        raise ValueError(
            f"Lịch đặt sân đang ở trạng thái {booking.status.value}, không thể hủy")

    earliest_start, hours_before, refund_percent, refund_amount, policy_message = calculate_cancellation_terms(
        booking)

    # 1. Cập nhật trạng thái booking
    booking.status = BookingStatus.Cancelled
    if reason:
        booking.note = f"{booking.note} | Lý do hủy: {reason}" if booking.note else f"Lý do hủy: {reason}"

    # 2. Hủy các slot để giải phóng sân cho khách khác đặt
    for slot in booking.booking_slots:
        slot.status = BookingSlotStatus.Cancelled

    db.commit()
    db.refresh(booking)

    msg = f"Hủy đặt sân thành công. Hoàn lại: {refund_amount:,.0f}đ ({refund_percent}%)."
    return {
        "booking_id": booking.id,
        "booking_code": booking.booking_code,
        "status": booking.status,
        "refund_percent": refund_percent,
        "refund_amount": refund_amount,
        "policy_message": policy_message,
        "message": msg,
    }


def delete_booking(db: Session, booking: Booking) -> None:
    db.delete(booking)
    db.commit()



def admin_cancel_booking(
    db: Session,
    booking: Booking,
    admin_reason: str,
    admin_user_id: int,
) -> dict:
    """Admin hủy lịch đặt sân bắt buộc phải có lý do.

    - Admin có thể hủy bất kỳ booking nào (kể cả dưới 6 giờ),
      miễn là booking chưa hủy / chưa hoàn thành.
    - Áp dụng chính sách hoàn tiền bình thường (nếu còn trước giờ chơi).
    - Nếu đã qua giờ chơi → hoàn 0% (không rollback, admin vẫn hủy được).
    - Gửi thông báo cho người dùng qua bảng notifications.
    """
    from app.models.notification import Notification, NotificationType

    if booking.status == BookingStatus.Cancelled:
        raise ValueError("Lịch đặt sân này đã được hủy trước đó")
    if booking.status in (BookingStatus.Completed,):
        raise ValueError(f"Lịch đặt sân đang ở trạng thái {booking.status.value}, không thể hủy")

    # Tính chính sách hoàn tiền (admin vẫn áp dụng bình thường nếu còn thời gian)
    refund_percent = 0
    refund_amount = 0.0
    policy_message = "Admin hủy sau giờ vào sân: không hoàn tiền (0%)"

    try:
        _, hours_before, refund_percent, refund_amount, policy_message = calculate_cancellation_terms(booking)
        policy_message = f"Admin hủy | {policy_message}"
    except ValueError:
        # Đã qua giờ → hoàn 0%, nhưng admin vẫn được hủy
        refund_percent = 0
        refund_amount = 0.0
        policy_message = "Admin hủy sau giờ vào sân: không hoàn tiền (0%)"

    # Hủy booking + các slot
    booking.status = BookingStatus.Cancelled
    old_note = booking.note or ""
    booking.note = f"{old_note} | [ADMIN HỦY] Lý do: {admin_reason}".strip(" |")

    for slot in booking.booking_slots:
        slot.status = BookingSlotStatus.Cancelled

    # Tạo thông báo cho người dùng
    court_info = ""
    if booking.booking_slots:
        s = booking.booking_slots[0]
        court_name = getattr(getattr(s, "court", None), "name", None) or f"Sân {s.court_id}"
        start_str = s.start_at.strftime("%H:%M")
        date_str = s.start_at.strftime("%d/%m/%Y")
        court_info = f"{court_name} · {start_str} ngày {date_str}"

    notif_title = f"Lịch đặt sân {booking.booking_code} đã bị hủy bởi quản trị viên"
    notif_message = (
        f"Kính gửi quý khách,\n\n"
        f"Lịch đặt sân của bạn ({court_info}) đã bị hủy bởi quản trị viên hệ thống.\n\n"
        f"Lý do: {admin_reason}\n\n"
        f"Chính sách hoàn tiền: {policy_message}\n"
        f"Số tiền hoàn lại: {refund_amount:,.0f}đ ({refund_percent}%)\n\n"
        f"Vui lòng liên hệ quầy lễ tân để được hỗ trợ thêm. Chúng tôi xin lỗi vì sự bất tiện này."
    )

    notification = Notification(
        user_id=booking.user_id,
        booking_id=booking.id,
        type=NotificationType.BOOKING_CANCELLED_BY_ADMIN,
        title=notif_title,
        message=notif_message,
        admin_reason=admin_reason,
        is_read=False,
    )
    db.add(notification)

    db.commit()
    db.refresh(booking)

    return {
        "booking_id": booking.id,
        "booking_code": booking.booking_code,
        "status": booking.status,
        "refund_percent": refund_percent,
        "refund_amount": refund_amount,
        "policy_message": policy_message,
        "message": f"Đã hủy lịch đặt sân {booking.booking_code} thành công. Thông báo đã được gửi đến khách hàng.",
        "notification_sent": True,
        "notification_message": notif_title,
    }

# ──────────── Custom exceptions ────────────


class ConflictError(Exception):
    """Slot đã bị chiếm bởi người khác (HTTP 409)."""
    pass
