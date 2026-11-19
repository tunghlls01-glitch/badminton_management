"""Nghiệp vụ Báo cáo & Thống kê (Analytics / Reports):
- Doanh thu theo ngày/tháng (tiền sân và dịch vụ)
- Tỉ lệ lấp đầy theo sân và khung giờ
- Số booking huỷ / không đến (NO_SHOW)
- Top dịch vụ bán chạy
"""
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
from sqlalchemy import func, or_, and_, desc
from sqlalchemy.orm import Session

from app.models.booking import Booking, BookingStatus
from app.models.booking_slot import BookingSlot, BookingSlotStatus
from app.models.court import Court, CourtStatus
from app.models.invoice import Invoice
from app.models.service import Service
from app.models.service_order import ServiceOrder, ServiceOrderStatus
from app.models.service_order_item import ServiceOrderItem
from app.models.user import User

from app.schemas.analytics import (
    RevenueSummary,
    RevenueTimelineItem,
    RevenueReportResponse,
    CourtOccupancyItem,
    TimeSlotOccupancyItem,
    HeatmapCell,
    OccupancyReportResponse,
    CancelledBookingItem,
    CancellationsReportResponse,
    TopServiceItem,
    TopServicesReportResponse,
    AnalyticsOverviewResponse,
)

OPEN_HOUR = 6
CLOSE_HOUR = 22  # 16 khung giờ mỗi ngày: 06:00 -> 22:00


def _get_date_range(from_date: Optional[date], to_date: Optional[date]) -> Tuple[date, date, datetime, datetime]:
    today = date.today()
    if to_date is None:
        to_date = today
    if from_date is None:
        # Mặc định lấy từ đầu tháng hiện tại hoặc 30 ngày trước
        from_date = today.replace(day=1) if today.day > 1 else today - timedelta(days=30)
    if from_date > to_date:
        from_date, to_date = to_date, from_date

    start_dt = datetime.combine(from_date, time.min)
    end_dt = datetime.combine(to_date, time.max)
    return from_date, to_date, start_dt, end_dt


# ─────────────────────────────────────────────────────────────
# 1. DOANH THU THEO NGÀY / THÁNG (SÂN & DỊCH VỤ)
# ─────────────────────────────────────────────────────────────

def get_revenue_report(
    db: Session,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    group_by: str = "day",
) -> RevenueReportResponse:
    from_d, to_d, start_dt, end_dt = _get_date_range(from_date, to_date)
    is_month = group_by.lower() == "month"

    # Map lưu dữ liệu theo kỳ: period_key -> {court, service, discount, total, bookings, orders}
    data_map: Dict[str, Dict[str, float]] = {}

    def get_period_key(dt: datetime) -> str:
        return dt.strftime("%Y-%m") if is_month else dt.strftime("%Y-%m-%d")

    # 1. Lấy dữ liệu từ bảng Hóa đơn (Invoices)
    invoices = (
        db.query(Invoice)
        .filter(Invoice.created_at >= start_dt, Invoice.created_at <= end_dt)
        .all()
    )

    total_court_rev = Decimal("0.00")
    total_service_rev = Decimal("0.00")
    total_discount_val = Decimal("0.00")
    total_net_rev = Decimal("0.00")
    invoice_count = len(invoices)
    invoiced_booking_ids = set()

    for inv in invoices:
        invoiced_booking_ids.add(inv.booking_id)
        p_key = get_period_key(inv.created_at)
        if p_key not in data_map:
            data_map[p_key] = {
                "court": 0.0,
                "service": 0.0,
                "discount": 0.0,
                "total": 0.0,
                "bookings": 0,
                "orders": 0,
            }

        court_amt = float(inv.total_court_amount or 0)
        svc_amt = float(inv.total_service_amount or 0)
        disc_amt = float(inv.discount_amount or 0)
        grand = float(inv.grand_total or (court_amt + svc_amt - disc_amt))

        data_map[p_key]["court"] += court_amt
        data_map[p_key]["service"] += svc_amt
        data_map[p_key]["discount"] += disc_amt
        data_map[p_key]["total"] += grand
        data_map[p_key]["bookings"] += 1

        total_court_rev += Decimal(str(court_amt))
        total_service_rev += Decimal(str(svc_amt))
        total_discount_val += Decimal(str(disc_amt))
        total_net_rev += Decimal(str(grand))

    # 2. Lấy dữ liệu từ Đơn dịch vụ bán lẻ (ServiceOrder khách vãng lai không gắn booking)
    retail_orders = (
        db.query(ServiceOrder)
        .filter(
            ServiceOrder.booking_id.is_(None),
            ServiceOrder.status == ServiceOrderStatus.COMPLETED,
            ServiceOrder.created_at >= start_dt,
            ServiceOrder.created_at <= end_dt,
        )
        .all()
    )

    retail_order_count = len(retail_orders)
    for ro in retail_orders:
        p_key = get_period_key(ro.created_at)
        if p_key not in data_map:
            data_map[p_key] = {
                "court": 0.0,
                "service": 0.0,
                "discount": 0.0,
                "total": 0.0,
                "bookings": 0,
                "orders": 0,
            }
        ro_price = float(ro.total_price or 0)
        data_map[p_key]["service"] += ro_price
        data_map[p_key]["total"] += ro_price
        data_map[p_key]["orders"] += 1

        total_service_rev += Decimal(str(ro_price))
        total_net_rev += Decimal(str(ro_price))

    # 3. Hỗ trợ dự phòng: Booking hoàn thành (Completed) nhưng chưa tạo Invoice
    unbilled_bookings = (
        db.query(Booking)
        .filter(
            Booking.status == BookingStatus.Completed,
            Booking.created_at >= start_dt,
            Booking.created_at <= end_dt,
            ~Booking.id.in_(invoiced_booking_ids) if invoiced_booking_ids else True,
        )
        .all()
    )

    for ub in unbilled_bookings:
        p_key = get_period_key(ub.created_at)
        if p_key not in data_map:
            data_map[p_key] = {
                "court": 0.0,
                "service": 0.0,
                "discount": 0.0,
                "total": 0.0,
                "bookings": 0,
                "orders": 0,
            }
        ub_price = float(ub.total_price or 0)
        data_map[p_key]["court"] += ub_price
        data_map[p_key]["total"] += ub_price
        data_map[p_key]["bookings"] += 1

        total_court_rev += Decimal(str(ub_price))
        total_net_rev += Decimal(str(ub_price))

    # 4. Tạo timeline liên tục không bị đứt đoạn ngày
    timeline: List[RevenueTimelineItem] = []
    if is_month:
        curr = date(from_d.year, from_d.month, 1)
        end_m = date(to_d.year, to_d.month, 1)
        while curr <= end_m:
            m_key = curr.strftime("%Y-%m")
            stats = data_map.get(m_key, {
                "court": 0.0, "service": 0.0, "discount": 0.0, "total": 0.0, "bookings": 0, "orders": 0
            })
            timeline.append(RevenueTimelineItem(
                period=m_key,
                court_revenue=round(stats["court"], 2),
                service_revenue=round(stats["service"], 2),
                discount_amount=round(stats["discount"], 2),
                total_revenue=round(stats["total"], 2),
                booking_count=stats["bookings"],
                service_order_count=stats["orders"],
            ))
            # Bước sang tháng tiếp theo
            if curr.month == 12:
                curr = date(curr.year + 1, 1, 1)
            else:
                curr = date(curr.year, curr.month + 1, 1)
    else:
        curr = from_d
        while curr <= to_d:
            d_key = curr.strftime("%Y-%m-%d")
            stats = data_map.get(d_key, {
                "court": 0.0, "service": 0.0, "discount": 0.0, "total": 0.0, "bookings": 0, "orders": 0
            })
            timeline.append(RevenueTimelineItem(
                period=d_key,
                court_revenue=round(stats["court"], 2),
                service_revenue=round(stats["service"], 2),
                discount_amount=round(stats["discount"], 2),
                total_revenue=round(stats["total"], 2),
                booking_count=stats["bookings"],
                service_order_count=stats["orders"],
            ))
            curr += timedelta(days=1)

    summary = RevenueSummary(
        total_revenue=round(float(total_net_rev), 2),
        court_revenue=round(float(total_court_rev), 2),
        service_revenue=round(float(total_service_rev), 2),
        total_discount=round(float(total_discount_val), 2),
        total_invoices=invoice_count,
        total_service_orders=retail_order_count,
    )

    return RevenueReportResponse(
        from_date=from_d.isoformat(),
        to_date=to_d.isoformat(),
        group_by=group_by.lower(),
        summary=summary,
        timeline=timeline,
    )


# ─────────────────────────────────────────────────────────────
# 2. TỈ LỆ LẤP ĐẦY THEO SÂN VÀ KHUNG GIỜ
# ─────────────────────────────────────────────────────────────

def get_occupancy_report(
    db: Session,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
) -> OccupancyReportResponse:
    from_d, to_d, start_dt, end_dt = _get_date_range(from_date, to_date)
    num_days = max(1, (to_d - from_d).days + 1)

    # 1. Lấy danh sách sân
    courts = (
        db.query(Court)
        .filter(Court.status != CourtStatus.Inactive)
        .order_by(Court.id.asc())
        .all()
    )
    if not courts:
        courts = db.query(Court).order_by(Court.id.asc()).all()

    total_courts = len(courts)
    slots_per_court_per_day = CLOSE_HOUR - OPEN_HOUR  # 16 slots (06:00 -> 22:00)
    total_slots_per_court = slots_per_court_per_day * num_days
    total_available_slots = total_courts * total_slots_per_court

    # 2. Lấy các BookingSlot đang hoạt động trong khoảng thời gian
    active_slots = (
        db.query(BookingSlot)
        .join(Booking, Booking.id == BookingSlot.booking_id)
        .filter(
            BookingSlot.start_at >= start_dt,
            BookingSlot.start_at <= end_dt,
            BookingSlot.status != BookingSlotStatus.Cancelled,
            Booking.status.in_([
                BookingStatus.Confirmed,
                BookingStatus.CHECKED_IN,
                BookingStatus.Completed,
                BookingStatus.NO_SHOW,
            ]),
        )
        .all()
    )

    total_booked_slots = len(active_slots)

    # 3. Phân bổ theo Sân
    court_booked_counts: Dict[int, int] = {c.id: 0 for c in courts}
    # Phân bổ theo Khung giờ: hour -> count
    hour_booked_counts: Dict[int, int] = {h: 0 for h in range(OPEN_HOUR, CLOSE_HOUR)}
    # Phân bổ Ma trận: (court_id, hour) -> count
    matrix_counts: Dict[Tuple[int, int], int] = {
        (c.id, h): 0 for c in courts for h in range(OPEN_HOUR, CLOSE_HOUR)
    }

    for slot in active_slots:
        cid = slot.court_id
        hour = slot.start_at.hour

        if cid in court_booked_counts:
            court_booked_counts[cid] += 1

        if hour in hour_booked_counts:
            hour_booked_counts[hour] += 1

        if (cid, hour) in matrix_counts:
            matrix_counts[(cid, hour)] += 1

    court_items: List[CourtOccupancyItem] = []
    for c in courts:
        b_count = court_booked_counts.get(c.id, 0)
        rate = round((b_count / total_slots_per_court) * 100, 1) if total_slots_per_court > 0 else 0.0
        court_items.append(CourtOccupancyItem(
            court_id=c.id,
            court_name=c.name,
            total_slots=total_slots_per_court,
            booked_slots=b_count,
            occupancy_rate=min(100.0, rate),
        ))

    time_slot_items: List[TimeSlotOccupancyItem] = []
    slots_per_hour = total_courts * num_days
    for h in range(OPEN_HOUR, CLOSE_HOUR):
        b_count = hour_booked_counts.get(h, 0)
        rate = round((b_count / slots_per_hour) * 100, 1) if slots_per_hour > 0 else 0.0
        time_slot_items.append(TimeSlotOccupancyItem(
            time_slot=f"{h:02d}:00 - {h+1:02d}:00",
            start_hour=h,
            total_slots=slots_per_hour,
            booked_slots=b_count,
            occupancy_rate=min(100.0, rate),
        ))

    matrix_items: List[HeatmapCell] = []
    for c in courts:
        for h in range(OPEN_HOUR, CLOSE_HOUR):
            b_count = matrix_counts.get((c.id, h), 0)
            rate = round((b_count / num_days) * 100, 1) if num_days > 0 else 0.0
            matrix_items.append(HeatmapCell(
                court_id=c.id,
                court_name=c.name,
                time_slot=f"{h:02d}:00 - {h+1:02d}:00",
                start_hour=h,
                booked_count=b_count,
                total_days=num_days,
                occupancy_rate=min(100.0, rate),
            ))

    overall_rate = (
        round((total_booked_slots / total_available_slots) * 100, 1)
        if total_available_slots > 0 else 0.0
    )

    return OccupancyReportResponse(
        from_date=from_d.isoformat(),
        to_date=to_d.isoformat(),
        total_days=num_days,
        total_courts=total_courts,
        total_available_slots=total_available_slots,
        total_booked_slots=total_booked_slots,
        overall_occupancy_rate=min(100.0, overall_rate),
        courts=court_items,
        time_slots=time_slot_items,
        matrix=matrix_items,
    )


# ─────────────────────────────────────────────────────────────
# 3. SỐ BOOKING HUỶ / KHÔNG ĐẾN
# ─────────────────────────────────────────────────────────────

def get_cancellations_report(
    db: Session,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
) -> CancellationsReportResponse:
    from_d, to_d, start_dt, end_dt = _get_date_range(from_date, to_date)

    # Lấy tất cả booking trong khoảng ngày
    bookings = (
        db.query(Booking)
        .filter(Booking.created_at >= start_dt, Booking.created_at <= end_dt)
        .order_by(Booking.created_at.desc())
        .all()
    )

    total_bookings = len(bookings)
    completed_count = 0
    confirmed_count = 0
    cancelled_count = 0
    no_show_count = 0
    lost_revenue = Decimal("0.00")

    cancelled_or_noshow_items: List[CancelledBookingItem] = []

    for b in bookings:
        status_val = b.status.value if hasattr(b.status, "value") else str(b.status)

        if status_val == BookingStatus.Completed.value:
            completed_count += 1
        elif status_val in (BookingStatus.Confirmed.value, BookingStatus.CHECKED_IN.value):
            confirmed_count += 1
        elif status_val == BookingStatus.Cancelled.value:
            cancelled_count += 1
            lost_revenue += Decimal(str(b.total_price or 0))
        elif status_val == BookingStatus.NO_SHOW.value:
            no_show_count += 1
            lost_revenue += Decimal(str(b.total_price or 0))

        if status_val in (BookingStatus.Cancelled.value, BookingStatus.NO_SHOW.value):
            first_slot = b.booking_slots[0] if b.booking_slots else None
            court_name = None
            booking_date_str = None
            time_range_str = None

            if first_slot:
                court_name = getattr(first_slot.court, "name", None) or f"Sân #{first_slot.court_id}"
                booking_date_str = first_slot.start_at.strftime("%d/%m/%Y")
                time_range_str = f"{first_slot.start_at.strftime('%H:%M')} - {first_slot.end_at.strftime('%H:%M')}"

            customer_name = b.user.full_name if b.user else "Khách vãng lai"
            customer_phone = b.user.phone if b.user else "---"

            cancelled_or_noshow_items.append(CancelledBookingItem(
                booking_id=b.id,
                booking_code=b.booking_code,
                customer_name=customer_name,
                customer_phone=customer_phone,
                court_name=court_name,
                booking_date=booking_date_str,
                time_range=time_range_str,
                status=status_val,
                total_price=float(b.total_price or 0),
                note=b.note,
                created_at=b.created_at.strftime("%d/%m/%Y %H:%M"),
            ))

    cancel_rate = round((cancelled_count / total_bookings) * 100, 1) if total_bookings > 0 else 0.0
    no_show_rate = round((no_show_count / total_bookings) * 100, 1) if total_bookings > 0 else 0.0

    return CancellationsReportResponse(
        from_date=from_d.isoformat(),
        to_date=to_d.isoformat(),
        total_bookings=total_bookings,
        completed_count=completed_count,
        confirmed_count=confirmed_count,
        cancelled_count=cancelled_count,
        no_show_count=no_show_count,
        cancellation_rate=cancel_rate,
        no_show_rate=no_show_rate,
        lost_revenue=round(float(lost_revenue), 2),
        recent_records=cancelled_or_noshow_items,
    )


# ─────────────────────────────────────────────────────────────
# 4. TOP DỊCH VỤ BÁN CHẠY
# ─────────────────────────────────────────────────────────────

def get_top_services_report(
    db: Session,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    limit: int = 10,
) -> TopServicesReportResponse:
    from_d, to_d, start_dt, end_dt = _get_date_range(from_date, to_date)

    # Truy vấn nhóm theo dịch vụ các dòng món đã bán trong các đơn không bị huỷ
    rows = (
        db.query(
            Service.id.label("service_id"),
            Service.name.label("service_name"),
            Service.category.label("category"),
            Service.unit.label("unit"),
            Service.price.label("unit_price"),
            func.sum(ServiceOrderItem.quantity).label("quantity_sold"),
            func.sum(ServiceOrderItem.amount).label("total_revenue"),
        )
        .join(ServiceOrderItem, ServiceOrderItem.service_id == Service.id)
        .join(ServiceOrder, ServiceOrder.id == ServiceOrderItem.service_order_id)
        .filter(
            ServiceOrder.created_at >= start_dt,
            ServiceOrder.created_at <= end_dt,
            ServiceOrder.status != ServiceOrderStatus.CANCELLED,
        )
        .group_by(Service.id, Service.name, Service.category, Service.unit, Service.price)
        .order_by(desc("quantity_sold"), desc("total_revenue"))
        .all()
    )

    total_items = sum(r.quantity_sold for r in rows) if rows else 0
    total_rev = sum(float(r.total_revenue) for r in rows) if rows else 0.0

    items: List[TopServiceItem] = []
    for r in rows[:limit]:
        rev = float(r.total_revenue)
        pct = round((rev / total_rev) * 100, 1) if total_rev > 0 else 0.0
        items.append(TopServiceItem(
            service_id=r.service_id,
            service_name=r.service_name,
            category=str(r.category),
            unit=r.unit,
            unit_price=float(r.unit_price or 0),
            quantity_sold=int(r.quantity_sold),
            total_revenue=round(rev, 2),
            revenue_percentage=pct,
        ))

    return TopServicesReportResponse(
        from_date=from_d.isoformat(),
        to_date=to_d.isoformat(),
        total_items_sold=total_items,
        total_service_revenue=round(total_rev, 2),
        services=items,
    )


# ─────────────────────────────────────────────────────────────
# 5. TỔNG HỢP TOÀN BỘ BÁO CÁO (DASHBOARD OVERVIEW)
# ─────────────────────────────────────────────────────────────

def get_analytics_overview(
    db: Session,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    group_by: str = "day",
) -> AnalyticsOverviewResponse:
    from_d, to_d, _, _ = _get_date_range(from_date, to_date)
    revenue = get_revenue_report(db, from_d, to_d, group_by=group_by)
    occupancy = get_occupancy_report(db, from_d, to_d)
    cancellations = get_cancellations_report(db, from_d, to_d)
    top_services = get_top_services_report(db, from_d, to_d, limit=10)

    return AnalyticsOverviewResponse(
        from_date=from_d.isoformat(),
        to_date=to_d.isoformat(),
        group_by=group_by.lower(),
        revenue=revenue,
        occupancy=occupancy,
        cancellations=cancellations,
        top_services=top_services,
    )
