"""API cho Quản lý Order Dịch vụ tại quầy POS (Gắn vào Booking hoặc Bán lẻ cho khách vãng lai).

Đường dẫn đầy đủ: /api/service-orders
    POST   /api/service-orders                           Tạo đơn order mới (gắn booking hoặc bán lẻ), tự động trừ kho
    GET    /api/service-orders                           Lấy danh sách các đơn order (?booking_id=..., ?status=...)
    GET    /api/service-orders/booking/{booking_id}/summary  Lấy tổng tiền dịch vụ của booking (dành cho module Thanh toán)
    GET    /api/service-orders/{order_id}                Xem chi tiết 1 đơn order và các món đã gọi
    POST   /api/service-orders/{order_id}/items          Thêm món bổ sung vào đơn đang phục vụ, tự động trừ kho
    DELETE /api/service-orders/{order_id}/items/{item_id} Hủy 1 dòng món -> TỰ ĐỘNG HOÀN KHO
    PATCH  /api/service-orders/{order_id}/cancel         Hủy toàn bộ đơn order -> TỰ ĐỘNG HOÀN KHO TOÀN BỘ
    PATCH  /api/service-orders/{order_id}/complete       Đánh dấu hoàn thành đơn (khi thanh toán)
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.crud import service_order as order_crud
from app.db.session import get_db
from app.models.service_order import ServiceOrderStatus
from app.models.user import User, UserRole
from app.schemas.service_order import (
    BookingServiceSummary,
    ServiceOrderAddItem,
    ServiceOrderCreate,
    ServiceOrderResponse,
)

router = APIRouter(
    prefix="/service-orders",
    tags=["POS - Order Dịch Vụ"],
)


@router.post("", response_model=ServiceOrderResponse, status_code=status.HTTP_201_CREATED)
def create_service_order(
    data: ServiceOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.STAFF)),
):
    """Tạo đơn order dịch vụ mới:

    - Nếu truyền `booking_id`: gắn vào booking đang chơi của khách.
    - Nếu để trống `booking_id`: bán lẻ cho khách vãng lai.
    - Tự động kiểm tra và trừ tồn kho, ghi log 'Bán lẻ'.
    """
    try:
        return order_crud.create_order(db, data)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err))


@router.get("", response_model=List[ServiceOrderResponse])
def list_service_orders(
    booking_id: Optional[int] = Query(None, description="Lọc theo ID lượt đặt sân"),
    status: Optional[ServiceOrderStatus] = Query(None, description="Lọc theo trạng thái đơn"),
    skip: int = Query(0, ge=0, description="Bỏ qua N bản ghi"),
    limit: int = Query(50, ge=1, le=100, description="Số bản ghi tối đa"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.STAFF)),
):
    """Lấy danh sách các đơn order dịch vụ tại quầy."""
    status_val = status.value if status else None
    return order_crud.get_orders(db, booking_id=booking_id, status=status_val, skip=skip, limit=limit)


@router.get("/booking/{booking_id}/summary", response_model=BookingServiceSummary)
def get_booking_service_summary(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.STAFF)),
):
    """API DÀNH CHO MODULE THANH TOÁN:

    Lấy tổng tiền tất cả dịch vụ chưa hủy của booking để cộng vào hóa đơn thanh toán sân.
    """
    try:
        return order_crud.get_booking_service_summary(db, booking_id)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(err))


@router.get("/{order_id}", response_model=ServiceOrderResponse)
def get_service_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.STAFF)),
):
    """Lấy chi tiết một đơn order dịch vụ theo ID."""
    order = order_crud.get_order(db, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy đơn hàng với ID={order_id}",
        )
    return order


@router.post("/{order_id}/items", response_model=ServiceOrderResponse)
def add_item_to_order(
    order_id: int,
    item_in: ServiceOrderAddItem,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.STAFF)),
):
    """Thêm món bổ sung vào đơn đang phục vụ (tự động kiểm tra và trừ tồn kho)."""
    try:
        return order_crud.add_item_to_order(db, order_id, item_in)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err))


@router.delete("/{order_id}/items/{item_id}", response_model=ServiceOrderResponse)
def remove_order_item(
    order_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.STAFF)),
):
    """HỦY DÒNG MÓN -> TỰ ĐỘNG HOÀN TRẢ TỒN KHO:

    - Cộng lại số lượng hàng vào kho của dịch vụ đó.
    - Ghi log hoàn kho với change_type='Điều chỉnh'.
    - Giảm bớt số tiền tương ứng khỏi tổng đơn hàng.
    """
    try:
        return order_crud.remove_order_item(db, order_id, item_id)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err))


@router.patch("/{order_id}/cancel", response_model=ServiceOrderResponse)
def cancel_service_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.STAFF)),
):
    """HỦY TOÀN BỘ ĐƠN ORDER -> TỰ ĐỘNG HOÀN KHO TOÀN BỘ:

    - Hoàn trả lại toàn bộ các món trong đơn vào kho.
    - Đổi trạng thái đơn thành CANCELLED.
    """
    try:
        return order_crud.cancel_order(db, order_id)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err))


@router.patch("/{order_id}/complete", response_model=ServiceOrderResponse)
def complete_service_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.STAFF)),
):
    """Đánh dấu đơn order hoàn thành (khi đã thu tiền / thanh toán xong)."""
    try:
        return order_crud.complete_order(db, order_id)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err))
