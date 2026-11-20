from datetime import date
from typing import List, Optional, Literal
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────
# 1. DOANH THU (REVENUE) SCHEMAS
# ─────────────────────────────────────────────────────────────

class RevenueSummary(BaseModel):
    total_revenue: float = Field(0.0, description="Tổng doanh thu thực nhận (Sân + Dịch vụ - Giảm giá)")
    court_revenue: float = Field(0.0, description="Doanh thu tiền sân")
    service_revenue: float = Field(0.0, description="Doanh thu dịch vụ (qua hóa đơn + bán lẻ)")
    total_discount: float = Field(0.0, description="Tổng tiền giảm giá khuyến mãi")
    total_invoices: int = Field(0, description="Tổng số hóa đơn đã thanh toán")
    total_service_orders: int = Field(0, description="Tổng số đơn dịch vụ đã hoàn thành")


class RevenueTimelineItem(BaseModel):
    period: str = Field(..., description="Mốc thời gian (YYYY-MM-DD hoặc YYYY-MM)")
    court_revenue: float = Field(0.0, description="Doanh thu tiền sân trong kỳ")
    service_revenue: float = Field(0.0, description="Doanh thu dịch vụ trong kỳ")
    discount_amount: float = Field(0.0, description="Tiền giảm giá trong kỳ")
    total_revenue: float = Field(0.0, description="Tổng doanh thu trong kỳ")
    booking_count: int = Field(0, description="Số lượt booking hoàn thành trong kỳ")
    service_order_count: int = Field(0, description="Số đơn dịch vụ trong kỳ")


class RevenueReportResponse(BaseModel):
    from_date: str
    to_date: str
    group_by: str
    summary: RevenueSummary
    timeline: List[RevenueTimelineItem]


# ─────────────────────────────────────────────────────────────
# 2. TỈ LỆ LẤP ĐẦY (OCCUPANCY RATE) SCHEMAS
# ─────────────────────────────────────────────────────────────

class CourtOccupancyItem(BaseModel):
    court_id: int
    court_name: str
    total_slots: int = Field(..., description="Tổng số ca sân khả dụng trong khoảng thời gian")
    booked_slots: int = Field(..., description="Số ca sân đã được đặt")
    occupancy_rate: float = Field(..., description="Tỉ lệ lấp đầy (%)")


class TimeSlotOccupancyItem(BaseModel):
    time_slot: str = Field(..., description="Khung giờ (VD: 06:00 - 07:00)")
    start_hour: int
    total_slots: int = Field(..., description="Tổng số ca của tất cả các sân trong khung giờ này")
    booked_slots: int = Field(..., description="Số ca đã được đặt trong khung giờ này")
    occupancy_rate: float = Field(..., description="Tỉ lệ lấp đầy (%)")


class HeatmapCell(BaseModel):
    court_id: int
    court_name: str
    time_slot: str
    start_hour: int
    booked_count: int
    total_days: int
    occupancy_rate: float


class OccupancyReportResponse(BaseModel):
    from_date: str
    to_date: str
    total_days: int
    total_courts: int
    total_available_slots: int
    total_booked_slots: int
    overall_occupancy_rate: float
    courts: List[CourtOccupancyItem]
    time_slots: List[TimeSlotOccupancyItem]
    matrix: List[HeatmapCell]


# ─────────────────────────────────────────────────────────────
# 3. SỐ BOOKING HUỶ / KHÔNG ĐẾN (CANCELLATIONS / NO-SHOW) SCHEMAS
# ─────────────────────────────────────────────────────────────

class CancelledBookingItem(BaseModel):
    booking_id: int
    booking_code: str
    customer_name: str
    customer_phone: str
    court_name: Optional[str] = None
    booking_date: Optional[str] = None
    time_range: Optional[str] = None
    status: str
    total_price: float
    note: Optional[str] = None
    created_at: str


class CancellationsReportResponse(BaseModel):
    from_date: str
    to_date: str
    total_bookings: int = Field(0, description="Tổng số booking trong kỳ")
    completed_count: int = Field(0, description="Số booking hoàn thành")
    confirmed_count: int = Field(0, description="Số booking đã xác nhận / đang hoạt động")
    cancelled_count: int = Field(0, description="Số booking bị huỷ")
    no_show_count: int = Field(0, description="Số booking không đến (NO_SHOW)")
    cancellation_rate: float = Field(0.0, description="Tỉ lệ huỷ (%)")
    no_show_rate: float = Field(0.0, description="Tỉ lệ không đến (%)")
    lost_revenue: float = Field(0.0, description="Tổng giá trị booking bị huỷ hoặc không đến")
    recent_records: List[CancelledBookingItem]


# ─────────────────────────────────────────────────────────────
# 4. TOP DỊCH VỤ BÁN CHẠY (TOP SERVICES) SCHEMAS
# ─────────────────────────────────────────────────────────────

class TopServiceItem(BaseModel):
    service_id: int
    service_name: str
    category: str
    unit: str
    unit_price: float
    quantity_sold: int
    total_revenue: float
    revenue_percentage: float = 0.0


class TopServicesReportResponse(BaseModel):
    from_date: str
    to_date: str
    total_items_sold: int
    total_service_revenue: float
    services: List[TopServiceItem]


# ─────────────────────────────────────────────────────────────
# 5. SO SÁNH VỚI KỲ TRƯỚC (COMPARISON METRICS)
# ─────────────────────────────────────────────────────────────

class ComparisonMetrics(BaseModel):
    previous_from_date: str
    previous_to_date: str
    previous_total_revenue: float = 0.0
    revenue_growth_pct: float = 0.0
    previous_total_bookings: int = 0
    booking_growth_pct: float = 0.0
    previous_occupancy_rate: float = 0.0
    occupancy_growth_pts: float = 0.0


# ─────────────────────────────────────────────────────────────
# 6. TỔNG HỢP (DASHBOARD OVERVIEW)
# ─────────────────────────────────────────────────────────────

class AnalyticsOverviewResponse(BaseModel):
    from_date: str
    to_date: str
    group_by: str
    revenue: RevenueReportResponse
    occupancy: OccupancyReportResponse
    cancellations: CancellationsReportResponse
    top_services: TopServicesReportResponse
    comparison: Optional[ComparisonMetrics] = None
