"""
Đường dẫn đầy đủ: /api/bookings
    POST   /api/bookings                       → Tạo booking (chống trùng slot)
    POST   /api/bookings/{id}/confirm          → Khách xác nhận đặt
    POST   /api/bookings/{id}/confirm-with-payment → Xác nhận booking và lưu yêu cầu thanh toán
    GET    /api/bookings/{id}/payment-receipt   → Xem ảnh chuyển khoản (có kiểm tra quyền)
    POST   /api/bookings/{id}/admin-cancel     → Admin hủy (bắt buộc lý do, gửi thông báo)
    GET    /api/bookings                       → Danh sách booking
    GET    /api/bookings/{id}                  → Chi tiết
    PATCH  /api/bookings/{id}/status           → Đổi trạng thái
    DELETE /api/bookings/{id}                  → Xoá
"""
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Optional
from uuid import uuid4


from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session


from app.crud import booking as booking_crud
from app.crud.booking import ConflictError
from app.core.security import get_current_user, require_roles
from app.db.session import get_db
from app.models.booking import BookingChannel, BookingStatus
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.models.user import User, UserRole
from app.schemas.booking import (
    BookingCreate,
    BookingOut,
    BookingUpdate,
    CancellationPreviewOut,
    CancelBookingOut,
    RecurringCheckRequest,
    RecurringCheckResponse,
    RecurringBookingCreate,
    RecurringBookingResponse,
    PromotionPreviewRequest,
    PromotionPreviewResponse,
)
from app.schemas.booking_slot import BookingSlotOut
from app.schemas.notification import AdminCancelBookingRequest, AdminCancelBookingOut


router = APIRouter(prefix="/bookings", tags=["Bookings"])

RECEIPT_DIR = Path(__file__).resolve().parents[2] / "static" / "uploads" / "payment_receipts"
MAX_RECEIPT_BYTES = 5 * 1024 * 1024
RECEIPT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def _to_booking_out(booking) -> dict:
    """Map Booking model → BookingOut schema (kèm toàn bộ slots)."""
    first_slot = None
    if booking.booking_slots:
        first_slot = booking.booking_slots[0]

    slots_out = []
    if booking.booking_slots:
        for s in booking.booking_slots:
            c_name = (
                getattr(s.court, "name", None)
                or getattr(s.court, "court_name", None)
                if s.court
                else None
            )
            slots_out.append(
                BookingSlotOut(
                    id=s.id,
                    booking_id=s.booking_id,
                    court_id=s.court_id,
                    court_name=c_name,
                    start_at=s.start_at,
                    end_at=s.end_at,
                    duration_minutes=s.duration_minutes,
                    price_per_hour=float(s.price_per_hour),
                    amount=float(s.amount),
                    status=s.status,
                )
            )

    payments = getattr(booking, "payments", None) or []
    latest_payment = max(payments, key=lambda payment: payment.id or 0, default=None)
    payment_method = getattr(latest_payment, "payment_method", None)
    payment_status = getattr(latest_payment, "payment_status", None)
    receipt_url = (
        f"/api/bookings/{booking.id}/payment-receipt"
        if any(payment.receipt_path for payment in payments) else None
    )
    prepaid = max(
        (payment for payment in payments
         if payment.payment_method == PaymentMethod.BANK_TRANSFER
         and payment.payment_status == PaymentStatus.SUCCESS
         and payment.invoice_id is None),
        key=lambda payment: payment.id or 0,
        default=None,
    )

    return BookingOut(
        id=booking.id,
        booking_code=booking.booking_code,
        user_id=booking.user_id,
        user_name=getattr(booking.user, "full_name", None) if booking.user else None,
        user_phone=getattr(booking.user, "phone", None) if booking.user else None,
        court_id=first_slot.court_id if first_slot else None,
        court_name=(
            getattr(first_slot.court, "name", None)
            or getattr(first_slot.court, "court_name", None)
            if first_slot and first_slot.court
            else None
        ),
        booking_date=first_slot.start_at.date() if first_slot else None,
        start_time=first_slot.start_at.strftime("%H:%M") if first_slot else None,
        end_time=first_slot.end_at.strftime("%H:%M") if first_slot else None,
        booking_channel=booking.booking_channel,
        subtotal_price=float(booking.subtotal_price or booking.total_price or 0),
        total_price=float(booking.total_price),
        discount_code=booking.discount_code,
        discount_percent=float(booking.discount_percent or 0),
        discount_amount=float(booking.discount_amount or 0),
        discount_reason=booking.discount_reason,
        status=booking.status,
        payment_method=getattr(payment_method, "value", payment_method),
        payment_status=getattr(payment_status, "value", payment_status),
        note=booking.note,
        created_at=booking.created_at,
        slots=slots_out,
        has_transferred=prepaid is not None,
        receipt_url=receipt_url,
        paid_amount=float(prepaid.amount) if prepaid else None,
    )




def _get_or_404(booking_id: int, db: Session = Depends(get_db)):
    booking = booking_crud.get_booking(db, booking_id)
    if booking is None:
        raise HTTPException(status_code=404, detail=f"Booking id={booking_id} không tồn tại")
    return booking




# ─────────────── endpoints ───────────────


@router.post("/{booking_id}/promotion-preview", response_model=PromotionPreviewResponse)
def preview_booking_promotion(
    booking_id: int,
    data: PromotionPreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = booking_crud.get_booking(db, booking_id)
    if booking is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên giữ chỗ.")
    if booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền xem ưu đãi của phiên này.")
    if booking.status != BookingStatus.Pending:
        raise HTTPException(status_code=409, detail="Phiên giữ chỗ không còn ở trạng thái chờ xác nhận.")
    if not booking.hold_expires_at or booking.hold_expires_at <= datetime.now():
        raise HTTPException(status_code=410, detail="Phiên giữ chỗ đã hết hạn.")
    try:
        return booking_crud.preview_booking_promotion(db, booking, data.code)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error




@router.post("", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(data: BookingCreate, db: Session = Depends(get_db)):
    """Tạo booking mới. Nếu slot đã bị đặt → HTTP 409."""
    try:
        booking = booking_crud.create_booking(db, data)
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _to_booking_out(booking)


@router.post("/walk-in", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_walk_in_booking(
    data: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.STAFF)),
):
    """Lễ tân tạo lượt đặt quầy và lưu người tạo vào booking."""
    if not (data.customer_name or "").strip():
        raise HTTPException(status_code=422, detail="Vui lòng nhập tên khách hàng.")
    if not (data.customer_phone or "").strip():
        raise HTTPException(status_code=422, detail="Vui lòng nhập số điện thoại khách hàng.")

    data.customer_name = data.customer_name.strip()
    data.customer_phone = data.customer_phone.strip()
    phone_digits = "".join(character for character in data.customer_phone if character.isdigit())
    if len(data.customer_phone) > 15 or not 9 <= len(phone_digits) <= 15:
        raise HTTPException(status_code=422, detail="Số điện thoại phải có từ 9 đến 15 chữ số.")
    data.booking_channel = BookingChannel.Counter
    data.status = BookingStatus.Pending

    start_at = datetime.combine(data.booking_date, data.start_time)
    end_at = datetime.combine(data.booking_date, data.end_time)
    now = booking_crud.vietnam_now()
    duration_minutes = int((end_at - start_at).total_seconds() / 60)
    if (
        data.start_time.minute not in (0, 30)
        or data.end_time.minute not in (0, 30)
        or data.start_time.second
        or data.end_time.second
        or duration_minutes < 30
        or duration_minutes % 30 != 0
    ):
        raise HTTPException(status_code=422, detail="Thời lượng đặt phải gồm các ô 30 phút liền nhau.")
    if data.start_time < time(6, 0) or data.end_time > time(23, 0):
        raise HTTPException(status_code=422, detail="Khung giờ đặt phải nằm trong 06:00–23:00.")
    if start_at <= now:
        raise HTTPException(status_code=422, detail="Không thể đặt khung giờ đã bắt đầu hoặc đã qua.")

    try:
        booking = booking_crud.create_walk_in_booking(
            db,
            data,
            created_by=current_user.id,
        )
    except ConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return _to_booking_out(booking)


@router.post("/recurring/check", response_model=RecurringCheckResponse)
def check_recurring(data: RecurringCheckRequest, db: Session = Depends(get_db)):
    """Kiểm tra tính khả dụng từng tuần cho chuỗi 4–8 tuần."""
    try:
        return booking_crud.check_recurring_availability(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/recurring", response_model=RecurringBookingResponse, status_code=status.HTTP_201_CREATED)
def create_recurring(data: RecurringBookingCreate, db: Session = Depends(get_db)):
    """Tạo đặt sân cố định hàng tuần trong 1 TRANSACTION duy nhất.
    Nếu có tuần trùng và chưa nằm trong skip_conflict_dates -> HTTP 409 Conflict.
    Nếu người dùng đồng ý bỏ qua tuần trùng (được đưa vào skip_conflict_dates),
    tạo booking với các tuần còn lại.
    """
    try:
        booking, booked_dates, skipped_dates = booking_crud.create_recurring_booking(db, data)
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    court_name = None
    if booking.booking_slots and booking.booking_slots[0].court:
        court_name = getattr(booking.booking_slots[0].court, "name", None) or getattr(booking.booking_slots[0].court, "court_name", None)

    msg = f"Đặt sân cố định thành công {len(booked_dates)}/{data.weeks_count} tuần."
    if skipped_dates:
        msg += f" Đã bỏ qua {len(skipped_dates)} tuần bị trùng."

    return RecurringBookingResponse(
        booking_id=booking.id,
        booking_code=booking.booking_code,
        court_id=data.court_id,
        court_name=court_name,
        total_weeks_requested=data.weeks_count,
        booked_weeks_count=len(booked_dates),
        skipped_weeks_count=len(skipped_dates),
        total_price=float(booking.total_price),
        status=booking.status,
        booked_dates=booked_dates,
        skipped_dates=skipped_dates,
        message=msg,
    )




@router.post("/{booking_id}/confirm", response_model=BookingOut)
def confirm_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Khách gửi booking để lễ tân xác nhận; giá được tính lại theo bảng giá hiện tại."""
    booking = booking_crud.get_booking(db, booking_id)
    if booking is None:
        raise HTTPException(status_code=404, detail=f"Booking id={booking_id} không tồn tại")
    if booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền xác nhận booking này")
    if booking.hold_expires_at and booking.hold_expires_at <= datetime.now():
        raise HTTPException(status_code=410, detail="Phiên giữ chỗ đã hết hạn")
    try:
        booking = booking_crud.confirm_booking(db, booking_id)
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _to_booking_out(booking)


@router.post("/{booking_id}/confirm-with-payment")
async def confirm_booking_with_payment(
    booking_id: int,
    payment_method: str = Form(...),
    customer_name: str = Form(...),
    customer_phone: str = Form(...),
    note: str = Form(""),
    promotion_code: str = Form(""),
    receipt: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xác nhận booking và lưu yêu cầu thanh toán (biên lai chuyển khoản ở trạng thái chờ)."""
    booking = booking_crud.get_booking(db, booking_id)
    if booking is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy booking.")
    if booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền xác nhận booking này.")
    if booking.hold_expires_at and booking.hold_expires_at <= datetime.now():
        raise HTTPException(status_code=410, detail="Phiên giữ chỗ đã hết hạn.")
    if payment_method not in {"BANK_TRANSFER", "CASH"}:
        raise HTTPException(status_code=422, detail="Phương thức thanh toán không hợp lệ.")

    customer_name = customer_name.strip()
    customer_phone = customer_phone.strip()
    note = note.strip()
    if not customer_name or len(customer_name) > 100:
        raise HTTPException(status_code=422, detail="Họ tên phải có từ 1 đến 100 ký tự.")
    if not customer_phone or len(customer_phone) > 15:
        raise HTTPException(status_code=422, detail="Số điện thoại phải có từ 1 đến 15 ký tự.")
    if len(note) > 255:
        raise HTTPException(status_code=422, detail="Ghi chú không được vượt quá 255 ký tự.")

    duplicate_phone = (
        db.query(User)
        .filter(User.phone == customer_phone, User.id != current_user.id)
        .first()
    )
    if duplicate_phone:
        raise HTTPException(status_code=409, detail="Số điện thoại này đã thuộc một tài khoản khác.")

    if payment_method == "BANK_TRANSFER" and receipt is None:
        raise HTTPException(status_code=422, detail="Vui lòng tải ảnh minh chứng chuyển khoản.")

    saved_receipt: Path | None = None
    receipt_filename: str | None = None
    if receipt is not None:
        extension = RECEIPT_TYPES.get(receipt.content_type or "")
        if not extension:
            raise HTTPException(status_code=415, detail="Ảnh minh chứng phải là JPG, PNG hoặc WEBP.")
        content = await receipt.read(MAX_RECEIPT_BYTES + 1)
        if not content:
            raise HTTPException(status_code=400, detail="Ảnh minh chứng đang trống.")
        if len(content) > MAX_RECEIPT_BYTES:
            raise HTTPException(status_code=413, detail="Ảnh minh chứng không được vượt quá 5 MB.")
        RECEIPT_DIR.mkdir(parents=True, exist_ok=True)
        receipt_filename = f"{uuid4().hex}{extension}"
        saved_receipt = RECEIPT_DIR / receipt_filename
        saved_receipt.write_bytes(content)

    try:
        current_user.full_name = customer_name
        current_user.phone = customer_phone
        booking = booking_crud.confirm_booking(
            db,
            booking_id,
            payment_method=(
                PaymentMethod.BANK_TRANSFER
                if payment_method == "BANK_TRANSFER"
                else PaymentMethod.CASH
            ),
            receipt_path=receipt_filename,
            note=note,
            promotion_code=promotion_code,
        )
    except ConflictError as error:
        db.rollback()
        if saved_receipt:
            saved_receipt.unlink(missing_ok=True)
        raise HTTPException(
            status_code=409,
            detail={"code": "SLOT_UNAVAILABLE", "message": str(error)},
        ) from error
    except ValueError as error:
        db.rollback()
        if saved_receipt:
            saved_receipt.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception:
        db.rollback()
        if saved_receipt:
            saved_receipt.unlink(missing_ok=True)
        raise

    return {
        "booking": _to_booking_out(booking),
        "payment_status": "PENDING",
        "receipt_url": (
            f"/api/bookings/{booking.id}/payment-receipt" if receipt_filename else None
        ),
        "message": (
            "Đã gửi booking và ảnh chuyển khoản. Booking đang chờ lễ tân xác nhận; thanh toán đang chờ kiểm tra."
            if receipt_filename
            else "Đã gửi booking. Booking đang chờ lễ tân xác nhận; thanh toán tại quầy khi nhận sân."
        ),
    }


@router.get("/{booking_id}/payment-receipt")
def get_booking_payment_receipt(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = booking_crud.get_booking(db, booking_id)
    if booking is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy booking.")
    if current_user.id != booking.user_id and current_user.role not in {
        UserRole.ADMIN,
        UserRole.STAFF,
    }:
        raise HTTPException(status_code=403, detail="Bạn không có quyền xem ảnh minh chứng này.")

    payment = (
        db.query(Payment)
        .filter(Payment.booking_id == booking_id, Payment.receipt_path.isnot(None))
        .order_by(Payment.id.desc())
        .first()
    )
    if not payment or not payment.receipt_path:
        raise HTTPException(status_code=404, detail="Booking này chưa có ảnh minh chứng.")
    filename = Path(payment.receipt_path).name
    receipt_path = RECEIPT_DIR / filename
    if not receipt_path.is_file():
        alt_path = Path(payment.receipt_path)
        if alt_path.is_file():
            receipt_path = alt_path
        else:
            raise HTTPException(status_code=404, detail="Không tìm thấy file ảnh minh chứng.")
    media_type = next(
        (content_type for content_type, extension in RECEIPT_TYPES.items()
         if extension == receipt_path.suffix.lower()),
        "application/octet-stream",
    )
    return FileResponse(receipt_path, media_type=media_type, filename=filename)




@router.get("", response_model=list[BookingOut])
def list_bookings(
    booking_date: Optional[date] = Query(None),
    court_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
):
    bookings = booking_crud.get_bookings(
        db, booking_date=booking_date, court_id=court_id, status=status_filter
    )
    return [_to_booking_out(b) for b in bookings]




@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(booking=Depends(_get_or_404)):
    return _to_booking_out(booking)


@router.get("/{booking_id}/reception", response_model=BookingOut)
def get_reception_booking(
    booking=Depends(_get_or_404),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.STAFF)),
):
    return _to_booking_out(booking)




@router.patch("/{booking_id}/status", response_model=BookingOut)
def update_status(
    new_status: BookingStatus = Query(..., alias="status"),
    booking=Depends(_get_or_404),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {UserRole.ADMIN, UserRole.STAFF}:
        raise HTTPException(status_code=403, detail="Chỉ lễ tân hoặc quản trị viên được đổi trạng thái booking.")
    booking = booking_crud.update_booking_status(db, booking, new_status)
    return _to_booking_out(booking)




@router.get("/{booking_id}/cancellation-preview", response_model=CancellationPreviewOut)
def cancellation_preview(booking=Depends(_get_or_404), db: Session = Depends(get_db)):
    """Xem trước chính sách hoàn tiền và số tiền được hoàn trước khi hủy."""
    try:
        return booking_crud.get_cancellation_preview(db, booking)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{booking_id}/cancel", response_model=CancelBookingOut)
def cancel_booking(
    booking_id: int,
    reason: Optional[str] = Query(None, description="Lý do hủy lịch đặt"),
    booking=Depends(_get_or_404),
    db: Session = Depends(get_db),
):
    """Hủy lịch đặt sân theo chính sách:
    - Trước >= 24 giờ: hoàn 100%
    - Trước >= 6 giờ (6h – 24h): hoàn 50%
    - Dưới 6 giờ: không hoàn tiền (0%)
    - Đã tới/qua giờ vào sân: không được hủy.
    """
    try:
        return booking_crud.cancel_booking(db, booking, reason=reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{booking_id}/admin-cancel", response_model=AdminCancelBookingOut)
def admin_cancel_booking(
    booking_id: int,
    body: AdminCancelBookingRequest,
    booking=Depends(_get_or_404),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Admin hủy lịch đặt sân bất kỳ — bắt buộc nhập lý do, hệ thống gửi thông báo cho người dùng.

    - Chỉ admin mới được dùng endpoint này.
    - Lý do (admin_reason) là bắt buộc, không được để trống.
    - Áp dụng chính sách hoàn tiền bình thường nếu còn trước giờ chơi.
    - Nếu đã qua giờ → hoàn 0%, nhưng admin vẫn hủy được (khác với cancel thường).
    - Hệ thống tự động gửi thông báo vào bảng notifications của người dùng.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ quản trị viên mới có quyền hủy lịch đặt sân theo cách này.",
        )
    if not body.admin_reason or not body.admin_reason.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Lý do hủy là bắt buộc đối với quản trị viên.",
        )
    try:
        return booking_crud.admin_cancel_booking(
            db, booking,
            admin_reason=body.admin_reason.strip(),
            admin_user_id=current_user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_booking(booking=Depends(_get_or_404), db: Session = Depends(get_db)):
    booking_crud.delete_booking(db, booking)
