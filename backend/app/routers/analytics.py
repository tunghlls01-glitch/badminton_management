"""Router Báo cáo doanh thu và Thống kê vận hành.
Đường dẫn cơ sở: /api/analytics
- GET /api/analytics/overview: Toàn bộ chỉ số tổng quan
- GET /api/analytics/revenue: Doanh thu theo ngày/tháng (tiền sân và dịch vụ)
- GET /api/analytics/occupancy: Tỉ lệ lấp đầy theo sân và khung giờ
- GET /api/analytics/cancellations: Thống kê booking huỷ và không đến
- GET /api/analytics/top-services: Danh sách top dịch vụ bán chạy
"""
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.user import UserRole
from app.crud import analytics as analytics_crud
from app.schemas.analytics import (
    AnalyticsOverviewResponse,
    RevenueReportResponse,
    OccupancyReportResponse,
    CancellationsReportResponse,
    TopServicesReportResponse,
)

router = APIRouter(
    prefix="/analytics",
    tags=["Báo cáo & Thống kê"],
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)


@router.get("/overview", response_model=AnalyticsOverviewResponse)
def get_overview(
    from_date: Optional[date] = Query(None, description="Ngày bắt đầu (YYYY-MM-DD)"),
    to_date: Optional[date] = Query(None, description="Ngày kết thúc (YYYY-MM-DD)"),
    group_by: str = Query("day", regex="^(day|month)$", description="Nhóm theo ngày hoặc tháng"),
    db: Session = Depends(get_db),
):
    """Lấy dữ liệu tổng hợp toàn diện cho Dashboard Analytics trong 1 lượt gọi."""
    return analytics_crud.get_analytics_overview(
        db, from_date=from_date, to_date=to_date, group_by=group_by
    )


@router.get("/revenue", response_model=RevenueReportResponse)
def get_revenue(
    from_date: Optional[date] = Query(None, description="Ngày bắt đầu (YYYY-MM-DD)"),
    to_date: Optional[date] = Query(None, description="Ngày kết thúc (YYYY-MM-DD)"),
    group_by: str = Query("day", regex="^(day|month)$", description="Nhóm theo 'day' hoặc 'month'"),
    db: Session = Depends(get_db),
):
    """Báo cáo doanh thu theo ngày/tháng phân tách rõ tiền sân, tiền dịch vụ, giảm giá và tổng cộng."""
    return analytics_crud.get_revenue_report(
        db, from_date=from_date, to_date=to_date, group_by=group_by
    )


@router.get("/occupancy", response_model=OccupancyReportResponse)
def get_occupancy(
    from_date: Optional[date] = Query(None, description="Ngày bắt đầu (YYYY-MM-DD)"),
    to_date: Optional[date] = Query(None, description="Ngày kết thúc (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
):
    """Báo cáo tỉ lệ lấp đầy theo từng sân, từng khung giờ và ma trận Heatmap sân x khung giờ."""
    return analytics_crud.get_occupancy_report(db, from_date=from_date, to_date=to_date)


@router.get("/cancellations", response_model=CancellationsReportResponse)
def get_cancellations(
    from_date: Optional[date] = Query(None, description="Ngày bắt đầu (YYYY-MM-DD)"),
    to_date: Optional[date] = Query(None, description="Ngày kết thúc (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
):
    """Báo cáo số lượt booking bị huỷ hoặc không đến (NO_SHOW), tỉ lệ huỷ và doanh thu thất thoát."""
    return analytics_crud.get_cancellations_report(db, from_date=from_date, to_date=to_date)


@router.get("/top-services", response_model=TopServicesReportResponse)
def get_top_services(
    from_date: Optional[date] = Query(None, description="Ngày bắt đầu (YYYY-MM-DD)"),
    to_date: Optional[date] = Query(None, description="Ngày kết thúc (YYYY-MM-DD)"),
    limit: int = Query(10, ge=1, le=50, description="Số lượng dịch vụ hiển thị"),
    db: Session = Depends(get_db),
):
    """Báo cáo top dịch vụ bán chạy nhất theo số lượng bán và doanh thu."""
    return analytics_crud.get_top_services_report(
        db, from_date=from_date, to_date=to_date, limit=limit
    )
