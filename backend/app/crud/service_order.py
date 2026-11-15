"""CRUD cho ServiceOrder và ServiceOrderItem (Nghiệp vụ POS bán dịch vụ tại quầy).

- Tạo đơn dịch vụ gắn vào booking hoặc bán lẻ cho khách vãng lai.
- Tự động kiểm tra và trừ tồn kho khi order.
- Tự động hoàn tồn kho khi hủy dòng món hoặc hủy đơn.
- Cung cấp tổng tiền dịch vụ gắn theo booking cho module Thanh toán.
"""
from decimal import Decimal
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.booking import Booking
from app.models.service import Service, ServiceStatus
from app.models.service_order import ServiceOrder, ServiceOrderStatus
from app.models.service_order_item import ServiceOrderItem
from app.models.service_stock_log import ServiceStockLog
from app.schemas.service_order import ServiceOrderAddItem, ServiceOrderCreate


def get_order(db: Session, order_id: int) -> Optional[ServiceOrder]:
    """Lấy chi tiết 1 đơn order dịch vụ theo ID."""
    return db.get(ServiceOrder, order_id)


def get_orders(
    db: Session,
    booking_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> List[ServiceOrder]:
    """Lấy danh sách các đơn order dịch vụ, có lọc theo booking_id hoặc trạng thái."""
    query = db.query(ServiceOrder)
    if booking_id is not None:
        query = query.filter(ServiceOrder.booking_id == booking_id)
    if status:
        query = query.filter(ServiceOrder.status == status)
    return query.order_by(ServiceOrder.id.desc()).offset(skip).limit(limit).all()


def create_order(db: Session, order_in: ServiceOrderCreate) -> ServiceOrder:
    """Tạo mới đơn dịch vụ tại quầy POS:

    - Gắn vào booking_id hoặc bán lẻ (booking_id=None).
    - Trừ kho tương ứng từng món, chặn nếu tồn kho không đủ.
    - Ghi log xuất bán vào service_stock_logs ('Bán lẻ').
    - Tính tổng tiền đơn hàng.
    """
    if order_in.booking_id is not None:
        booking = db.get(Booking, order_in.booking_id)
        if not booking:
            raise ValueError(f"Không tìm thấy lượt đặt sân (booking_id={order_in.booking_id}).")

    if not order_in.items:
        raise ValueError("Đơn hàng phải có ít nhất 1 dịch vụ.")

    # 1. Tạo bản ghi đơn hàng
    order = ServiceOrder(
        booking_id=order_in.booking_id,
        status=ServiceOrderStatus.PENDING,
        note=order_in.note,
        total_price=Decimal("0.00"),
    )
    db.add(order)
    db.flush()  # Sinh order.id để liên kết với các item

    total = Decimal("0.00")

    # 2. Xử lý từng món, trừ tồn kho và ghi log
    for item in order_in.items:
        service = db.get(Service, item.service_id)
        if not service:
            raise ValueError(f"Không tìm thấy dịch vụ ID={item.service_id}.")

        # Kiểm tra trạng thái hoạt động
        status_str = service.status.value if hasattr(service.status, "value") else str(service.status)
        if status_str.upper() not in ("ACTIVE", "ACTIVE"):
            raise ValueError(f"Dịch vụ '{service.name}' hiện đang tạm ngừng kinh doanh.")

        # Kiểm tra tồn kho
        if service.stock_quantity < item.quantity:
            raise ValueError(
                f"Dịch vụ '{service.name}' không đủ tồn kho (hiện còn {service.stock_quantity}, yêu cầu {item.quantity})."
            )

        # Trừ kho
        qty_before = service.stock_quantity
        service.stock_quantity -= item.quantity
        qty_after = service.stock_quantity

        # Ghi log xuất bán kho
        note_log = f"Xuất bán đơn POS #{order.id}"
        if order.booking_id:
            note_log += f" (Booking #{order.booking_id})"
        else:
            note_log += " (Khách vãng lai)"

        stock_log = ServiceStockLog(
            service_id=service.id,
            change_type="Bán lẻ",
            quantity_change=-item.quantity,
            quantity_before=qty_before,
            quantity_after=qty_after,
            note=note_log,
        )
        db.add(stock_log)

        # Tính thành tiền món
        unit_price = Decimal(str(service.price))
        amount = unit_price * item.quantity
        total += amount

        order_item = ServiceOrderItem(
            service_order_id=order.id,
            service_id=service.id,
            quantity=item.quantity,
            unit_price=unit_price,
            amount=amount,
        )
        db.add(order_item)

    order.total_price = total
    db.commit()
    db.refresh(order)
    return order


def add_item_to_order(db: Session, order_id: int, item_in: ServiceOrderAddItem) -> ServiceOrder:
    """Thêm món bổ sung vào đơn đang phục vụ (PENDING) và trừ kho."""
    order = db.get(ServiceOrder, order_id)
    if not order:
        raise ValueError(f"Không tìm thấy đơn hàng #{order_id}.")

    if order.status != ServiceOrderStatus.PENDING:
        raise ValueError("Chỉ có thể thêm món vào đơn hàng đang phục vụ (PENDING).")

    service = db.get(Service, item_in.service_id)
    if not service:
        raise ValueError(f"Không tìm thấy dịch vụ ID={item_in.service_id}.")

    status_str = service.status.value if hasattr(service.status, "value") else str(service.status)
    if status_str.upper() not in ("ACTIVE", "ACTIVE"):
        raise ValueError(f"Dịch vụ '{service.name}' hiện đang tạm ngừng kinh doanh.")

    if service.stock_quantity < item_in.quantity:
        raise ValueError(
            f"Dịch vụ '{service.name}' không đủ tồn kho (hiện còn {service.stock_quantity}, yêu cầu {item_in.quantity})."
        )

    # Trừ tồn kho
    qty_before = service.stock_quantity
    service.stock_quantity -= item_in.quantity
    qty_after = service.stock_quantity

    stock_log = ServiceStockLog(
        service_id=service.id,
        change_type="Bán lẻ",
        quantity_change=-item_in.quantity,
        quantity_before=qty_before,
        quantity_after=qty_after,
        note=f"Thêm món vào đơn POS #{order.id}",
    )
    db.add(stock_log)

    # Kiểm tra xem món này đã có trong đơn chưa để cộng dồn hoặc thêm dòng mới
    existing_item = (
        db.query(ServiceOrderItem)
        .filter(
            ServiceOrderItem.service_order_id == order.id,
            ServiceOrderItem.service_id == service.id,
        )
        .first()
    )

    unit_price = Decimal(str(service.price))
    add_amount = unit_price * item_in.quantity

    if existing_item:
        existing_item.quantity += item_in.quantity
        existing_item.amount = Decimal(str(existing_item.amount)) + add_amount
    else:
        new_item = ServiceOrderItem(
            service_order_id=order.id,
            service_id=service.id,
            quantity=item_in.quantity,
            unit_price=unit_price,
            amount=add_amount,
        )
        db.add(new_item)

    order.total_price = Decimal(str(order.total_price)) + add_amount
    db.commit()
    db.refresh(order)
    return order


def remove_order_item(db: Session, order_id: int, item_id: int) -> ServiceOrder:
    """HỦY DÒNG MÓN -> TỰ ĐỘNG HOÀN TRẢ TỒN KHO:

    - Hoàn lại số lượng hàng về kho của dịch vụ đó.
    - Ghi nhận ServiceStockLog với change_type='Điều chỉnh'.
    - Trừ bớt tiền ra khỏi tổng đơn hàng order.total_price.
    - Xóa dòng khỏi database.
    """
    order = db.get(ServiceOrder, order_id)
    if not order:
        raise ValueError(f"Không tìm thấy đơn hàng #{order_id}.")

    if order.status == ServiceOrderStatus.CANCELLED:
        raise ValueError("Đơn hàng này đã bị hủy trước đó.")

    item = db.get(ServiceOrderItem, item_id)
    if not item or item.service_order_id != order.id:
        raise ValueError(f"Không tìm thấy món #{item_id} trong đơn hàng #{order_id}.")

    # Hoàn tồn kho
    service = db.get(Service, item.service_id)
    if service:
        qty_before = service.stock_quantity
        service.stock_quantity += item.quantity
        qty_after = service.stock_quantity

        stock_log = ServiceStockLog(
            service_id=service.id,
            change_type="Điều chỉnh",
            quantity_change=item.quantity,
            quantity_before=qty_before,
            quantity_after=qty_after,
            note=f"Hoàn kho do hủy món '{service.name}' (SL: {item.quantity}) trong đơn #{order.id}",
        )
        db.add(stock_log)

    # Giảm tổng tiền đơn hàng
    order.total_price = max(Decimal("0.00"), Decimal(str(order.total_price)) - Decimal(str(item.amount)))

    # Xóa dòng
    db.delete(item)
    db.commit()
    db.refresh(order)
    return order


def cancel_order(db: Session, order_id: int) -> ServiceOrder:
    """HỦY TOÀN BỘ ĐƠN HÀNG -> HOÀN TRẢ KHO TOÀN BỘ CÁC MÓN:

    - Hoàn lại số lượng tồn kho cho tất cả các món trong đơn.
    - Ghi log hoàn trả kho.
    - Đổi trạng thái sang CANCELLED.
    """
    order = db.get(ServiceOrder, order_id)
    if not order:
        raise ValueError(f"Không tìm thấy đơn hàng #{order_id}.")

    if order.status == ServiceOrderStatus.CANCELLED:
        raise ValueError("Đơn hàng này đã ở trạng thái hủy trước đó.")

    if order.status == ServiceOrderStatus.COMPLETED:
        raise ValueError("Đơn hàng đã hoàn thành/thanh toán, không thể hủy.")

    # Hoàn kho cho từng món
    for item in order.items:
        service = db.get(Service, item.service_id)
        if service:
            qty_before = service.stock_quantity
            service.stock_quantity += item.quantity
            qty_after = service.stock_quantity

            stock_log = ServiceStockLog(
                service_id=service.id,
                change_type="Điều chỉnh",
                quantity_change=item.quantity,
                quantity_before=qty_before,
                quantity_after=qty_after,
                note=f"Hoàn kho do hủy toàn bộ đơn POS #{order.id}",
            )
            db.add(stock_log)

    order.status = ServiceOrderStatus.CANCELLED
    db.commit()
    db.refresh(order)
    return order


def complete_order(db: Session, order_id: int) -> ServiceOrder:
    """Đánh dấu hoàn thành đơn hàng (khi khách thanh toán xong)."""
    order = db.get(ServiceOrder, order_id)
    if not order:
        raise ValueError(f"Không tìm thấy đơn hàng #{order_id}.")

    if order.status == ServiceOrderStatus.CANCELLED:
        raise ValueError("Đơn hàng đã bị hủy, không thể đánh dấu hoàn thành.")

    order.status = ServiceOrderStatus.COMPLETED
    db.commit()
    db.refresh(order)
    return order


def get_booking_service_summary(db: Session, booking_id: int) -> dict:
    """DÀNH CHO MODULE THANH TOÁN:

    Lấy tổng tiền tất cả dịch vụ chưa hủy gắn với booking_id để tính tiền hóa đơn.
    """
    booking = db.get(Booking, booking_id)
    if not booking:
        raise ValueError(f"Không tìm thấy lượt đặt sân (booking_id={booking_id}).")

    # Lấy các đơn dịch vụ chưa hủy của booking
    orders = (
        db.query(ServiceOrder)
        .filter(
            ServiceOrder.booking_id == booking_id,
            ServiceOrder.status != ServiceOrderStatus.CANCELLED,
        )
        .all()
    )

    total_amount = sum(float(o.total_price) for o in orders)

    return {
        "booking_id": booking_id,
        "total_service_amount": float(total_amount),
        "total_orders": len(orders),
        "orders": orders,
    }
