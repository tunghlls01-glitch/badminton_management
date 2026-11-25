"""CRUD operations for Invoice (Hóa đơn & Chốt ca)."""
from datetime import date, datetime, time
from decimal import Decimal
from typing import List, Optional, Tuple, Dict, Any

from sqlalchemy import or_, and_, func, select
from sqlalchemy.orm import Session, selectinload, joinedload

from app.models.booking import Booking, BookingStatus
from app.models.booking_slot import BookingSlot, BookingSlotStatus
from app.models.court import Court
from app.models.invoice import Invoice
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.models.service import Service
from app.models.service_order import ServiceOrder, ServiceOrderStatus
from app.models.service_order_item import ServiceOrderItem
from app.models.user import User, UserRole
from app.schemas.invoice import (
    InvoiceDetailResponse,
    InvoiceListItem,
    InvoiceListResponse,
    InvoiceServiceItem,
    InvoiceSlotItem,
    InvoiceSummaryStats,
    ReceptionistOut,
    ShiftClosingResponse,
    ShiftInvoiceItem,
    ShiftCloseRequest,
    ShiftCloseResponse,
)


class InvoiceNotFoundError(Exception):
    pass


def get_receptionists_list(db: Session) -> List[ReceptionistOut]:
    """Lấy danh sách các nhân viên lễ tân và quản trị viên."""
    staff_users = (
        db.query(User)
        .filter(User.role.in_([UserRole.STAFF, UserRole.ADMIN]))
        .order_by(User.role.asc(), User.full_name.asc())
        .all()
    )
    return [
        ReceptionistOut(
            id=u.id,
            full_name=u.full_name,
            email=u.email,
            phone=u.phone,
            role=u.role.value if hasattr(u.role, "value") else str(u.role),
        )
        for u in staff_users
    ]


def get_invoices(
    db: Session,
    date_val: Optional[date] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    staff_id: Optional[int] = None,
    payment_method: Optional[str] = None,
    q: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
) -> InvoiceListResponse:
    """Lấy danh sách hóa đơn có bộ lọc ngày, lễ tân, hình thức thanh toán, từ khóa và phân trang."""
    query = (
        db.query(Invoice)
        .outerjoin(Booking, Invoice.booking_id == Booking.id)
        .outerjoin(User, Invoice.customer_id == User.id)
    )

    # 1. Lọc theo ngày
    if date_val is not None:
        start_dt = datetime.combine(date_val, time.min)
        end_dt = datetime.combine(date_val, time.max)
        query = query.filter(Invoice.created_at >= start_dt, Invoice.created_at <= end_dt)
    else:
        if date_from is not None:
            query = query.filter(Invoice.created_at >= datetime.combine(date_from, time.min))
        if date_to is not None:
            query = query.filter(Invoice.created_at <= datetime.combine(date_to, time.max))

    # 2. Lọc theo lễ tân / nhân viên
    if staff_id is not None:
        query = query.filter(
            or_(
                Invoice.staff_id == staff_id,
                and_(Invoice.staff_id.is_(None), Booking.created_by == staff_id),
            )
        )

    # 3. Tìm kiếm theo từ khóa q
    if q and q.strip():
        search_term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Invoice.invoice_code.ilike(search_term),
                Booking.booking_code.ilike(search_term),
                User.full_name.ilike(search_term),
                User.phone.ilike(search_term),
            )
        )

    # Lấy tất cả các bản ghi thỏa mãn điều kiện để tính toán summary thống kê
    all_matched_invoices = query.all()

    # Tạo map invoice_id -> Payment
    matched_invoice_ids = [inv.id for inv in all_matched_invoices]
    matched_booking_ids = [inv.booking_id for inv in all_matched_invoices if inv.booking_id]
    payment_map: Dict[int, Payment] = {}
    if matched_invoice_ids or matched_booking_ids:
        filter_conds = []
        if matched_invoice_ids:
            filter_conds.append(Payment.invoice_id.in_(matched_invoice_ids))
        if matched_booking_ids:
            filter_conds.append(Payment.booking_id.in_(matched_booking_ids))
        payments = (
            db.query(Payment)
            .filter(or_(*filter_conds))
            .order_by(Payment.id.desc())
            .all()
        )
        for p in payments:
            if p.invoice_id and p.invoice_id not in payment_map:
                payment_map[p.invoice_id] = p
            elif p.booking_id:
                for inv in all_matched_invoices:
                    if inv.booking_id == p.booking_id and inv.id not in payment_map:
                        payment_map[inv.id] = p

    # Lọc theo payment_method nếu có yêu cầu
    if payment_method and payment_method.strip():
        method_upper = payment_method.strip().upper()
        filtered_invoices = []
        for inv in all_matched_invoices:
            pm = payment_map.get(inv.id)
            pm_str = (pm.payment_method.value if hasattr(pm.payment_method, "value") else str(pm.payment_method)) if pm else None
            if pm_str and pm_str.upper() == method_upper:
                filtered_invoices.append(inv)
        all_matched_invoices = filtered_invoices

    # Thống kê tổng hợp
    total_count = len(all_matched_invoices)
    summary_stats = InvoiceSummaryStats()
    summary_stats.total_invoices = total_count

    for inv in all_matched_invoices:
        grand = float(inv.grand_total or 0)
        summary_stats.total_revenue += grand
        summary_stats.total_court_amount += float(inv.total_court_amount or 0)
        summary_stats.total_service_amount += float(inv.total_service_amount or 0)
        summary_stats.total_discount_amount += float(inv.discount_amount or 0)

        pm = payment_map.get(inv.id)
        pm_str = (pm.payment_method.value if hasattr(pm.payment_method, "value") else str(pm.payment_method)) if pm else "CASH"
        if pm_str and "BANK" in pm_str.upper():
            summary_stats.total_bank_transfer += grand
        else:
            summary_stats.total_cash += grand

    # Sắp xếp mới nhất trước
    all_matched_invoices.sort(key=lambda x: (x.created_at or datetime.min, x.id or 0), reverse=True)

    # Phân trang
    start_idx = (page - 1) * limit
    paged_invoices = all_matched_invoices[start_idx : start_idx + limit]

    # Batch load Users để hiển thị tên staff/customer nhanh và chống N+1
    user_ids = set()
    for inv in paged_invoices:
        if inv.customer_id:
            user_ids.add(inv.customer_id)
        if inv.staff_id:
            user_ids.add(inv.staff_id)
        if inv.booking and inv.booking.created_by:
            user_ids.add(inv.booking.created_by)
        if inv.booking and inv.booking.user_id:
            user_ids.add(inv.booking.user_id)

    users_map: Dict[int, User] = {}
    if user_ids:
        users = db.query(User).filter(User.id.in_(user_ids)).all()
        for u in users:
            users_map[u.id] = u

    # Build response items
    items: List[InvoiceListItem] = []
    for inv in paged_invoices:
        # Customer info
        cust_user = users_map.get(inv.customer_id)
        if not cust_user and inv.booking:
            cust_user = users_map.get(inv.booking.user_id)
        cust_name = cust_user.full_name if cust_user else "Khách vãng lai"
        cust_phone = cust_user.phone if cust_user else None

        # Staff info
        st_id = inv.staff_id or (inv.booking.created_by if inv.booking else None)
        st_user = users_map.get(st_id) if st_id else None
        st_name = st_user.full_name if st_user else "Quầy lễ tân"

        # Payment info
        pm = payment_map.get(inv.id)
        pm_method = (pm.payment_method.value if hasattr(pm.payment_method, "value") else str(pm.payment_method)) if pm else "CASH"
        pm_status = (pm.payment_status.value if hasattr(pm.payment_status, "value") else str(pm.payment_status)) if pm else "SUCCESS"
        tx_code = pm.transaction_code if pm else None
        rc_url = (
            f"/api/bookings/{inv.booking_id}/payment-receipt"
            if (pm and getattr(pm, "receipt_path", None) and inv.booking_id)
            else None
        )

        items.append(
            InvoiceListItem(
                id=inv.id,
                invoice_code=inv.invoice_code,
                booking_id=inv.booking_id,
                booking_code=inv.booking.booking_code if inv.booking else None,
                customer_id=inv.customer_id,
                customer_name=cust_name,
                customer_phone=cust_phone,
                staff_id=st_id,
                staff_name=st_name,
                total_court_amount=float(inv.total_court_amount or 0),
                total_service_amount=float(inv.total_service_amount or 0),
                discount_amount=float(inv.discount_amount or 0),
                discount_reason=inv.discount_reason,
                grand_total=float(inv.grand_total or 0),
                payment_method=pm_method,
                payment_status=pm_status,
                transaction_code=tx_code,
                receipt_url=rc_url,
                created_at=inv.created_at or datetime.now(),
            )
        )

    return InvoiceListResponse(
        items=items,
        total=total_count,
        page=page,
        limit=limit,
        summary=summary_stats,
    )


def get_invoice_detail(db: Session, invoice_id_or_code: str, is_reprint: bool = False) -> InvoiceDetailResponse:
    """Lấy chi tiết đầy đủ của một hóa đơn để xem trước hoặc in lại."""
    # Tìm theo id hoặc invoice_code
    invoice = None
    if str(invoice_id_or_code).isdigit():
        invoice = db.query(Invoice).filter(Invoice.id == int(invoice_id_or_code)).first()
    if not invoice:
        invoice = db.query(Invoice).filter(Invoice.invoice_code == str(invoice_id_or_code).strip()).first()
    if not invoice:
        # Hỗ trợ tìm qua booking_code
        booking = db.query(Booking).filter(Booking.booking_code == str(invoice_id_or_code).strip()).first()
        if booking and booking.invoices:
            invoice = booking.invoices[0]

    if not invoice:
        raise InvoiceNotFoundError(f"Không tìm thấy hóa đơn với định danh: {invoice_id_or_code}")

    # Customer info
    customer = db.query(User).filter(User.id == invoice.customer_id).first()
    if not customer and invoice.booking:
        customer = db.query(User).filter(User.id == invoice.booking.user_id).first()

    cust_name = customer.full_name if customer else "Khách hàng"
    cust_phone = customer.phone if customer else None
    cust_email = customer.email if customer else None

    # Staff info
    staff_id = invoice.staff_id or (invoice.booking.created_by if invoice.booking else None)
    staff = db.query(User).filter(User.id == staff_id).first() if staff_id else None
    staff_name = staff.full_name if staff else "Nhân viên quầy"

    # Payment info
    payment = db.query(Payment).filter(Payment.invoice_id == invoice.id).first()
    if not payment and invoice.booking_id:
        payment = (
            db.query(Payment)
            .filter(Payment.booking_id == invoice.booking_id)
            .order_by(Payment.id.desc())
            .first()
        )
    pm_method = (payment.payment_method.value if hasattr(payment.payment_method, "value") else str(payment.payment_method)) if payment else "CASH"
    pm_status = (payment.payment_status.value if hasattr(payment.payment_status, "value") else str(payment.payment_status)) if payment else "SUCCESS"
    tx_code = payment.transaction_code if payment else None
    rc_url = (
        f"/api/bookings/{invoice.booking_id}/payment-receipt"
        if (payment and getattr(payment, "receipt_path", None) and invoice.booking_id)
        else None
    )

    # Court slots info
    court_slots: List[InvoiceSlotItem] = []
    if invoice.booking and invoice.booking.booking_slots:
        for slot in invoice.booking.booking_slots:
            court_name = slot.court.name if slot.court else "Sân tiêu chuẩn"
            play_d = slot.start_at.strftime("%d/%m/%Y") if slot.start_at else ""
            t_slot = f"{slot.start_at.strftime('%H:%M')}–{slot.end_at.strftime('%H:%M')}" if (slot.start_at and slot.end_at) else ""
            hours = float(slot.duration_minutes or 60) / 60.0
            price_h = float(slot.price_per_hour or 0)
            amt = float(slot.amount or (price_h * hours))
            court_slots.append(
                InvoiceSlotItem(
                    court_name=court_name,
                    court_type="Sân tiêu chuẩn",
                    play_date=play_d,
                    time_slot=t_slot,
                    hours=hours,
                    price_per_hour=price_h,
                    amount=amt,
                )
            )

    # Services info from ServiceOrders
    services_list: List[InvoiceServiceItem] = []
    if invoice.booking_id:
        service_orders = (
            db.query(ServiceOrder)
            .filter(
                ServiceOrder.booking_id == invoice.booking_id,
                ServiceOrder.status != ServiceOrderStatus.CANCELLED,
            )
            .all()
        )
        for order in service_orders:
            for item in order.items:
                svc_name = item.service_name or (item.service.name if item.service else "Dịch vụ")
                svc_unit = item.service_unit or (item.service.unit if item.service else "Lượt")
                cat = item.service.category if item.service else None
                cat_str = cat.value if hasattr(cat, "value") else (str(cat) if cat else "KHÁC")
                services_list.append(
                    InvoiceServiceItem(
                        service_id=item.service_id,
                        service_name=svc_name,
                        category=cat_str,
                        unit=svc_unit,
                        quantity=item.quantity,
                        unit_price=float(item.unit_price or 0),
                        amount=float(item.amount or (item.quantity * item.unit_price)),
                    )
                )

    return InvoiceDetailResponse(
        id=invoice.id,
        invoice_code=invoice.invoice_code,
        created_at=invoice.created_at or datetime.now(),
        customer_id=invoice.customer_id,
        customer_name=cust_name,
        customer_phone=cust_phone,
        customer_email=cust_email,
        staff_id=staff_id,
        staff_name=staff_name,
        booking_id=invoice.booking_id,
        booking_code=invoice.booking.booking_code if invoice.booking else None,
        court_slots=court_slots,
        services=services_list,
        total_court_amount=float(invoice.total_court_amount or 0),
        total_service_amount=float(invoice.total_service_amount or 0),
        discount_amount=float(invoice.discount_amount or 0),
        discount_reason=invoice.discount_reason,
        grand_total=float(invoice.grand_total or 0),
        payment_method=pm_method,
        payment_status=pm_status,
        transaction_code=tx_code,
        receipt_url=rc_url,
        is_reprint=is_reprint,
    )


def get_shift_closing_summary(
    db: Session,
    staff_id: int,
    date_val: Optional[date] = None,
    shift_type: str = "ALL_DAY",
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
) -> ShiftClosingResponse:
    """Tính toán chốt ca: tổng tiền mặt, tổng chuyển khoản của một lễ tân trong ca làm việc."""
    date_target = date_val or date.today()

    # Xác định khung giờ ca
    shift_name = "Toàn ngày"
    s_time = time(6, 0)
    e_time = time(23, 59, 59)

    shift_type_clean = (shift_type or "ALL_DAY").strip().upper()
    if shift_type_clean == "MORNING":
        shift_name = "Ca sáng (06:00 – 14:00)"
        s_time = time(6, 0)
        e_time = time(14, 0, 0)
    elif shift_type_clean == "AFTERNOON":
        shift_name = "Ca chiều (14:00 – 22:00)"
        s_time = time(14, 0)
        e_time = time(22, 0, 0)
    elif shift_type_clean == "EVENING":
        shift_name = "Ca tối (18:00 – 23:00)"
        s_time = time(18, 0)
        e_time = time(23, 0, 0)
    elif shift_type_clean == "CUSTOM" and start_time and end_time:
        try:
            parts_s = start_time.strip().split(":")
            parts_e = end_time.strip().split(":")
            s_time = time(int(parts_s[0]), int(parts_s[1]))
            e_time = time(int(parts_e[0]), int(parts_e[1]), 59)
            shift_name = f"Tùy chỉnh ({s_time.strftime('%H:%M')} – {e_time.strftime('%H:%M')})"
        except Exception:
            pass

    start_dt = datetime.combine(date_target, s_time)
    end_dt = datetime.combine(date_target, e_time)

    # Lấy thông tin lễ tân
    staff = db.query(User).filter(User.id == staff_id).first()
    if not staff:
        raise InvoiceNotFoundError(f"Nhân viên lễ tân id={staff_id} không tồn tại.")

    # Truy vấn các hóa đơn do lễ tân này thực hiện trong ca
    query = (
        db.query(Invoice)
        .outerjoin(Booking, Invoice.booking_id == Booking.id)
        .filter(
            Invoice.created_at >= start_dt,
            Invoice.created_at <= end_dt,
            or_(
                Invoice.staff_id == staff_id,
                and_(Invoice.staff_id.is_(None), Booking.created_by == staff_id),
            ),
        )
        .order_by(Invoice.created_at.asc())
    )

    shift_invoices = query.all()

    # Map payment
    invoice_ids = [inv.id for inv in shift_invoices]
    booking_ids = [inv.booking_id for inv in shift_invoices if inv.booking_id]
    payment_map: Dict[int, Payment] = {}
    if invoice_ids or booking_ids:
        filter_conds = []
        if invoice_ids:
            filter_conds.append(Payment.invoice_id.in_(invoice_ids))
        if booking_ids:
            filter_conds.append(Payment.booking_id.in_(booking_ids))
        payments = (
            db.query(Payment)
            .filter(or_(*filter_conds))
            .order_by(Payment.id.desc())
            .all()
        )
        for p in payments:
            if p.invoice_id and p.invoice_id not in payment_map:
                payment_map[p.invoice_id] = p
            elif p.booking_id:
                for inv in shift_invoices:
                    if inv.booking_id == p.booking_id and inv.id not in payment_map:
                        payment_map[inv.id] = p

    # Map Customer
    cust_ids = {inv.customer_id for inv in shift_invoices if inv.customer_id}
    cust_map: Dict[int, User] = {}
    if cust_ids:
        users = db.query(User).filter(User.id.in_(cust_ids)).all()
        for u in users:
            cust_map[u.id] = u

    # Tính toán tổng tiền mặt và chuyển khoản
    total_cash = 0.0
    total_bank_transfer = 0.0
    total_court_amount = 0.0
    total_service_amount = 0.0
    total_discount_amount = 0.0
    items: List[ShiftInvoiceItem] = []

    for inv in shift_invoices:
        grand = float(inv.grand_total or 0)
        total_court_amount += float(inv.total_court_amount or 0)
        total_service_amount += float(inv.total_service_amount or 0)
        total_discount_amount += float(inv.discount_amount or 0)

        pm = payment_map.get(inv.id)
        pm_str = (pm.payment_method.value if hasattr(pm.payment_method, "value") else str(pm.payment_method)) if pm else "CASH"

        if pm_str and "BANK" in pm_str.upper():
            total_bank_transfer += grand
        else:
            total_cash += grand

        cust = cust_map.get(inv.customer_id)
        cust_name = cust.full_name if cust else "Khách hàng"

        rc_url = (
            f"/api/bookings/{inv.booking_id}/payment-receipt"
            if (pm and getattr(pm, "receipt_path", None) and inv.booking_id)
            else None
        )

        items.append(
            ShiftInvoiceItem(
                id=inv.id,
                invoice_code=inv.invoice_code,
                booking_code=inv.booking.booking_code if inv.booking else None,
                customer_name=cust_name,
                payment_method=pm_str,
                receipt_url=rc_url,
                total_court_amount=float(inv.total_court_amount or 0),
                total_service_amount=float(inv.total_service_amount or 0),
                discount_amount=float(inv.discount_amount or 0),
                grand_total=grand,
                created_at=inv.created_at or datetime.now(),
            )
        )

    total_revenue = total_cash + total_bank_transfer

    return ShiftClosingResponse(
        staff_id=staff.id,
        staff_name=staff.full_name,
        staff_email=staff.email,
        staff_phone=staff.phone,
        date=date_target.strftime("%Y-%m-%d"),
        shift_type=shift_type_clean,
        shift_name=shift_name,
        start_time=s_time.strftime("%H:%M"),
        end_time=e_time.strftime("%H:%M"),
        total_invoices=len(items),
        total_cash=total_cash,
        total_bank_transfer=total_bank_transfer,
        total_revenue=total_revenue,
        total_court_amount=total_court_amount,
        total_service_amount=total_service_amount,
        total_discount_amount=total_discount_amount,
        invoices=items,
        closed_at=datetime.now(),
    )


def confirm_shift_closing(
    db: Session,
    payload: ShiftCloseRequest,
    current_user_id: int,
) -> ShiftCloseResponse:
    """Xác nhận chốt ca làm việc, đối soát tiền mặt trong két và lưu ghi chú bàn giao."""
    target_staff_id = payload.staff_id or current_user_id
    summary = get_shift_closing_summary(
        db=db,
        staff_id=target_staff_id,
        date_val=payload.date,
        shift_type=payload.shift_type,
        start_time=payload.start_time,
        end_time=payload.end_time,
    )
    
    # Tính chênh lệch nếu actual_cash được nhập
    diff = payload.difference
    if payload.actual_cash is not None:
        diff = float(payload.actual_cash) - summary.total_cash

    return ShiftCloseResponse(
        success=True,
        message=f"Đã xác nhận chốt ca {summary.shift_name} của lễ tân {summary.staff_name} thành công!",
        summary=summary,
        actual_cash=payload.actual_cash,
        difference=diff,
        note=payload.note,
        confirmed_at=datetime.now(),
    )

