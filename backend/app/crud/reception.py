"""Nghiệp vụ Lễ tân: tìm booking trong ngày, check-in, đánh dấu NO_SHOW và thanh toán checkout."""
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.booking import Booking, BookingStatus
from app.models.booking_slot import BookingSlot, BookingSlotStatus
from app.models.invoice import Invoice
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.models.service_order import ServiceOrder, ServiceOrderStatus
from app.models.user import User
from app.schemas.booking import BookingCheckoutRequest, BookingCheckoutResponse

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


def checkout_booking(
    db: Session,
    booking_id: int,
    data: BookingCheckoutRequest,
) -> BookingCheckoutResponse:
    """Thanh toán tổng kết cho booking (tiền sân + tiền dịch vụ - giảm giá) trong 1 Transaction duy nhất.
    
    - Chống thanh toán 2 lần bằng Pessimistic Lock (SELECT ... FOR UPDATE) và Unique DB constraint.
    - Áp dụng giảm giá thủ công (bắt buộc nhập lý do nếu discount > 0).
    - Tạo Invoice và Payment (CASH hoặc BANK_TRANSFER).
    - Đổi trạng thái ServiceOrder -> COMPLETED và Booking -> Completed.
    """
    payment_method_str = (data.payment_method or "").strip().upper()
    if payment_method_str not in ("CASH", "BANK_TRANSFER"):
        raise ValueError("Phương thức thanh toán chỉ hỗ trợ 'CASH' (tiền mặt) hoặc 'BANK_TRANSFER' (chuyển khoản).")

    discount = data.discount_amount or Decimal(0)
    if discount < 0:
        raise ValueError("Số tiền giảm giá không được âm.")
    if discount > 0 and (not data.discount_reason or not data.discount_reason.strip()):
        raise ValueError("Bắt buộc phải nhập lý do giảm giá khi có áp dụng giảm giá.")

    try:
        # Khóa dòng booking (Pessimistic Locking) để tránh race condition thanh toán 2 lần cùng lúc
        booking = (
            db.query(Booking)
            .filter(Booking.id == booking_id)
            .with_for_update()
            .first()
        )
        if booking is None:
            raise NotFoundError(f"Booking id={booking_id} không tồn tại")

        # Kiểm tra trạng thái booking
        if booking.status == BookingStatus.Completed:
            raise ValueError(f"Booking {booking.booking_code} đã thanh toán và hoàn thành trước đó.")

        # Kiểm tra hóa đơn đã tồn tại chưa
        existing_invoice = db.query(Invoice).filter(Invoice.booking_id == booking_id).first()
        if existing_invoice:
            raise ValueError(
                f"Booking {booking.booking_code} đã được xuất hóa đơn ({existing_invoice.invoice_code}), "
                "không thể thanh toán lần 2."
            )

        if booking.status not in (BookingStatus.CHECKED_IN, BookingStatus.Confirmed):
            raise ValueError(
                f"Chỉ có thể thanh toán khi booking ở trạng thái CHECKED_IN hoặc Confirmed. "
                f"Hiện tại: {booking.status.value}"
            )

        # 1. Tiền sân
        total_court_amount = Decimal(str(booking.total_price or 0))

        # 2. Tiền dịch vụ (các ServiceOrder của booking không bị huỷ)
        service_orders = (
            db.query(ServiceOrder)
            .filter(
                ServiceOrder.booking_id == booking_id,
                ServiceOrder.status != ServiceOrderStatus.CANCELLED,
            )
            .all()
        )
        total_service_amount = sum(
            (Decimal(str(order.total_price or 0)) for order in service_orders),
            Decimal(0),
        )

        subtotal = total_court_amount + total_service_amount
        if discount > subtotal:
            raise ValueError(
                f"Số tiền giảm giá ({discount:,.0f}đ) không được vượt quá tổng tiền ({subtotal:,.0f}đ)."
            )

        grand_total = subtotal - discount

        # 3. Tạo mã hóa đơn duy nhất
        now = datetime.now()
        timestamp_str = now.strftime("%Y%m%d%H%M%S")
        invoice_code = f"INV-{timestamp_str}-{booking.id}"

        # 4. Tạo bản ghi Hóa đơn (Invoice)
        invoice = Invoice(
            invoice_code=invoice_code,
            booking_id=booking.id,
            customer_id=booking.user_id,
            total_court_amount=total_court_amount,
            total_service_amount=total_service_amount,
            discount_amount=discount,
            discount_reason=data.discount_reason.strip() if data.discount_reason else None,
            grand_total=grand_total,
        )
        db.add(invoice)
        db.flush()  # sinh invoice.id

        # 5. Tạo bản ghi Thanh toán (Payment)
        payment = Payment(
            booking_id=booking.id,
            invoice_id=invoice.id,
            amount=grand_total,
            payment_method=PaymentMethod(payment_method_str),
            payment_status=PaymentStatus.SUCCESS,
            transaction_code=data.transaction_code.strip() if data.transaction_code else None,
        )
        db.add(payment)

        # 6. Đổi trạng thái các đơn dịch vụ liên quan -> COMPLETED
        for order in service_orders:
            order.status = ServiceOrderStatus.COMPLETED

        # 7. Đổi trạng thái Booking -> Completed
        booking.status = BookingStatus.Completed
        if data.note and data.note.strip():
            existing_note = booking.note or ""
            booking.note = f"{existing_note} | {data.note.strip()}".strip(" |")

        # Hoàn tất transaction nguyên tử
        db.commit()

        return BookingCheckoutResponse(
            message="Thanh toán và hoàn thành booking thành công",
            booking_id=booking.id,
            booking_code=booking.booking_code,
            booking_status=booking.status,
            total_court_amount=float(total_court_amount),
            total_service_amount=float(total_service_amount),
            discount_amount=float(discount),
            discount_reason=invoice.discount_reason,
            grand_total=float(grand_total),
            payment_method=payment_method_str,
            payment_status="SUCCESS",
            transaction_code=payment.transaction_code,
            invoice_code=invoice.invoice_code,
        )
    except Exception:
        db.rollback()
        raise
