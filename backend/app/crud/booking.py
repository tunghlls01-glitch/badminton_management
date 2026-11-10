from datetime import date, datetime
from decimal import Decimal
import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.crud.court import get_court, get_court_price_per_hour
from app.models.booking import (
    Booking,
    BookingChannel,
    BookingSlot,
    BookingSlotStatus,
    BookingStatus,
)
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.models.user import User, UserRole, UserStatus
from app.schemas.booking import BookingCreate, BookingUpdate


CANCELLATION_POLICY = (
    "📋 CHÍNH SÁCH HOÀN TIỀN KHI HỦY LỊCH ĐẶT SÂN:\n"
    "• Hủy trước giờ chơi >= 24 giờ: Hoàn 100% tổng tiền đặt sân.\n"
    "• Hủy trước giờ chơi từ 6 đến dưới 24 giờ: Hoàn 50% tổng tiền đặt sân.\n"
    "• Hủy trước giờ chơi dưới 6 giờ (hoặc sau giờ bắt đầu): Không hoàn tiền (0%)."
)


def generate_booking_code() -> str:
    prefix = datetime.now().strftime("%y%m%d")
    suffix = uuid.uuid4().hex[:4].upper()
    return f"BK{prefix}-{suffix}"


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
        role=UserRole.Customer,
        status=UserStatus.Active,
    )

    db.add(user)
    db.flush()

    return user


def create_booking(db: Session, data: BookingCreate) -> Booking:
    try:
        court = get_court(db, data.court_id)
        if not court:
            raise ValueError(f"Không tìm thấy sân với ID #{data.court_id}")

        user = get_or_create_user(
            db,
            name=data.customer_name,
            phone=data.customer_phone,
        )

        start_at = datetime.combine(data.booking_date, data.start_time)
        end_at = datetime.combine(data.booking_date, data.end_time)

        duration_minutes = max(
            30,
            int((end_at - start_at).total_seconds() / 60),
        )

        price_per_hour = get_court_price_per_hour(db, data.court_id)

        if data.total_price and data.total_price > 0:
            amount = Decimal(str(data.total_price))
        else:
            hours = Decimal(str(duration_minutes)) / Decimal("60.0")
            amount = (Decimal(str(price_per_hour)) * hours).quantize(Decimal("0.01"))

        booking = Booking(
            booking_code=generate_booking_code(),
            user_id=user.id,
            created_by=None,
            booking_channel=data.booking_channel or BookingChannel.Counter,
            total_price=amount,
            status=data.status or BookingStatus.Pending,
            note=data.note,
        )

        db.add(booking)
        db.flush()

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
        db.commit()

        return get_booking(db, booking.id)

    except Exception as e:
        db.rollback()
        import traceback

        print("\n========== BOOKING ERROR ==========")
        print("Error:", repr(e))
        traceback.print_exc()
        print("===================================\n")
        raise


def get_bookings(
    db: Session,
    booking_date: date | None = None,
    court_id: int | None = None,
    status: BookingStatus | None = None,
) -> list[Booking]:
    query = (
        select(Booking)
        .options(
            joinedload(Booking.user),
            selectinload(Booking.booking_slots).joinedload(BookingSlot.court),
        )
        .order_by(Booking.id.desc())
    )

    if status:
        query = query.where(Booking.status == status)

    if booking_date or court_id:
        query = query.join(Booking.booking_slots)
        if booking_date:
            query = query.where(func.date(BookingSlot.start_at) == booking_date)
        if court_id:
            query = query.where(BookingSlot.court_id == court_id)
        query = query.distinct()

    return list(db.scalars(query).all())


def get_booking(db: Session, booking_id: int) -> Booking | None:
    return db.scalar(
        select(Booking)
        .options(
            joinedload(Booking.user),
            selectinload(Booking.booking_slots).joinedload(BookingSlot.court),
        )
        .where(Booking.id == booking_id)
    )


def update_booking(
    db: Session,
    booking: Booking,
    data: BookingUpdate,
) -> Booking:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(booking, field, value)

    db.commit()
    return get_booking(db, booking.id)


def get_cancellation_preview(
    db: Session,
    booking_id: int | Booking,
    now: datetime | None = None,
) -> dict:
    booking = booking_id if isinstance(booking_id, Booking) else get_booking(db, booking_id)

    if not booking:
        raise ValueError("Không tìm thấy lịch đặt!")

    if booking.status == BookingStatus.Cancelled:
        raise ValueError(f"Lịch đặt #{booking.booking_code} đã bị hủy trước đó rồi!")

    if booking.status == BookingStatus.Completed:
        raise ValueError(f"Lịch đặt #{booking.booking_code} đã hoàn thành, không thể hủy!")

    now = now or datetime.now()
    earliest_start = None

    if booking.booking_slots:
        active_slots = [
            slot for slot in booking.booking_slots if slot.status == BookingSlotStatus.Active
        ]
        target_slots = active_slots if active_slots else booking.booking_slots
        earliest_start = min(slot.start_at for slot in target_slots)

    if earliest_start:
        hours_before = (earliest_start - now).total_seconds() / 3600.0
    else:
        hours_before = 999.0

    if hours_before >= 24:
        refund_percent = 100
        tier_label = "Trước 24 giờ trở lên"
    elif hours_before >= 6:
        refund_percent = 50
        tier_label = "Trước từ 6 đến 24 giờ"
    else:
        refund_percent = 0
        tier_label = "Dưới 6 giờ hoặc đã đến giờ chơi"

    total_price = Decimal(str(booking.total_price or 0))
    refund_amount = (total_price * Decimal(refund_percent) / Decimal(100)).quantize(Decimal("0.01"))

    if hours_before >= 0:
        time_desc = f"còn {hours_before:.1f} giờ nữa đến giờ chơi"
    else:
        time_desc = f"đã qua giờ chơi {abs(hours_before):.1f} giờ"

    summary_message = (
        f"Lịch đặt {booking.booking_code} ({time_desc} - diện '{tier_label}'). "
        f"Theo chính sách, bạn sẽ được hoàn {refund_percent}% "
        f"số tiền ({float(refund_amount):,.0f} ₫)."
    )

    return {
        "booking": booking,
        "booking_id": booking.id,
        "booking_code": booking.booking_code,
        "earliest_start": earliest_start,
        "hours_before": round(hours_before, 2),
        "refund_percent": refund_percent,
        "refund_amount": refund_amount,
        "total_price": total_price,
        "policy_message": CANCELLATION_POLICY,
        "summary_message": summary_message,
    }


def cancel_booking(
    db: Session,
    booking_id: int | Booking,
    now: datetime | None = None,
) -> dict:
    preview = get_cancellation_preview(db, booking_id, now)
    booking = preview["booking"]

    refund_percent = preview["refund_percent"]
    refund_amount = preview["refund_amount"]

    booking.status = BookingStatus.Cancelled
    for slot in booking.booking_slots:
        slot.status = BookingSlotStatus.Cancelled

    cancel_time_str = (now or datetime.now()).strftime("%d/%m/%Y %H:%M")
    cancel_note = (
        f"Hủy lúc {cancel_time_str}. Được hoàn {refund_percent}% ({float(refund_amount):,.0f}đ)."
    )

    booking.note = f"{booking.note} | {cancel_note}" if booking.note else cancel_note

    if refund_amount > 0:
        refund_payment = Payment(
            booking_id=booking.id,
            amount=refund_amount,
            payment_method=PaymentMethod.Cash,
            payment_status=PaymentStatus.Refunded,
            transaction_code=f"REFUND-{booking.booking_code}",
        )
        db.add(refund_payment)

    db.commit()

    message = (
        f"Đã hủy lịch đặt #{booking.booking_code} thành công!\n"
        f"Bạn được hoàn lại {refund_percent}% tổng tiền "
        f"(tương đương {float(refund_amount):,.0f} ₫)."
    )

    return {
        "booking": booking,
        "booking_id": booking.id,
        "booking_code": booking.booking_code,
        "status": booking.status,
        "refund_percent": refund_percent,
        "refund_amount": float(refund_amount),
        "policy_message": CANCELLATION_POLICY,
        "message": message,
    }


def update_booking_status(
    db: Session,
    booking: Booking,
    status: BookingStatus,
) -> Booking:
    if status == BookingStatus.Cancelled:
        result = cancel_booking(db, booking)
        return result["booking"]

    booking.status = status
    db.commit()
    return get_booking(db, booking.id)


def delete_booking(
    db: Session,
    booking: Booking,
) -> None:
    db.delete(booking)
    db.commit()