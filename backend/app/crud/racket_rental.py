"""CRUD cho quản lý Thuê và Trả vợt theo Booking (T3D2CB1)."""
from datetime import datetime
from typing import List, Optional
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.crud.service import deduct_stock, restore_stock
from app.models.booking import Booking
from app.models.racket_rental import RacketRental, RacketRentalStatus
from app.models.service import Service, ServiceCategory
from app.schemas.racket_rental import RacketRentalCreate, RacketRentalOut


def get_rental(db: Session, rental_id: int) -> Optional[RacketRental]:
    """Lấy chi tiết 1 lượt thuê vợt."""
    return db.get(RacketRental, rental_id)


def get_rentals(
    db: Session,
    booking_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[RacketRental]:
    """Lấy danh sách thuê vợt, lọc theo booking_id và trạng thái."""
    query = select(RacketRental)
    if booking_id is not None:
        query = query.where(RacketRental.booking_id == booking_id)
    if status:
        query = query.where(RacketRental.status == status.upper())

    query = query.order_by(RacketRental.id.desc()).offset(skip).limit(limit)
    rentals = list(db.scalars(query))
    for r in rentals:
        if r.service:
            r.service_name = r.service.name
    return rentals


def create_rental(db: Session, data: RacketRentalCreate) -> RacketRental:
    """Tạo mới 1 lượt thuê vợt cho Booking."""
    booking = db.get(Booking, data.booking_id)
    if not booking:
        raise ValueError(f"Không tìm thấy Booking ID #{data.booking_id}.")

    service = db.get(Service, data.service_id)
    if not service:
        raise ValueError(f"Không tìm thấy dịch vụ ID #{data.service_id}.")

    if data.quantity <= 0:
        raise ValueError("Số lượng vợt thuê phải lớn hơn 0.")

    # Nếu không phải tạo từ ServiceOrder (đã trừ kho rồi), thì thực hiện trừ kho tạm giữ
    if not data.service_order_id:
        deduct_stock(
            db=db,
            service_id=service.id,
            quantity=data.quantity,
            note=f"Tạm giữ kho cho thuê vợt Booking #{booking.id}",
            commit=False,
        )

    rental = RacketRental(
        booking_id=data.booking_id,
        service_id=data.service_id,
        service_order_id=data.service_order_id,
        quantity=data.quantity,
        status=RacketRentalStatus.RENTING.value,
        note=data.note,
    )
    db.add(rental)
    db.commit()
    db.refresh(rental)
    rental.service_name = service.name
    return rental


def return_rental(db: Session, rental_id: int, note: Optional[str] = None) -> RacketRental:
    """Đánh dấu đã trả vợt:

    - Cập nhật status -> RETURNED
    - Ghi nhận returned_at
    - Tự động hoàn lại số lượng vợt vào kho khả dụng (Service.stock_quantity).
    """
    rental = db.get(RacketRental, rental_id)
    if not rental:
        raise ValueError(f"Không tìm thấy lượt thuê vợt ID #{rental_id}.")

    if rental.status == RacketRentalStatus.RETURNED.value:
        raise ValueError("Lượt thuê vợt này đã được xác nhận trả trước đó.")

    # Hoàn tồn kho
    service = db.get(Service, rental.service_id)
    if service:
        restore_note = f"Hoàn kho do trả vợt mượn Booking #{rental.booking_id}"
        if note:
            restore_note += f" ({note})"
        restore_stock(
            db=db,
            service_id=service.id,
            quantity=rental.quantity,
            note=restore_note,
            commit=False,
        )

    rental.status = RacketRentalStatus.RETURNED.value
    rental.returned_at = datetime.now()
    if note:
        rental.note = f"{rental.note} | Trả: {note}" if rental.note else f"Trả: {note}"

    db.commit()
    db.refresh(rental)
    if service:
        rental.service_name = service.name
    return rental


def return_all_rackets_for_booking(
    db: Session, booking_id: int, note: Optional[str] = None
) -> List[RacketRental]:
    """Thu hồi toàn bộ vợt chưa trả của một booking."""
    query = (
        select(RacketRental)
        .where(
            RacketRental.booking_id == booking_id,
            RacketRental.status == RacketRentalStatus.RENTING.value,
        )
    )
    rentals = list(db.scalars(query))
    if not rentals:
        return []

    for rental in rentals:
        service = db.get(Service, rental.service_id)
        if service:
            restore_stock(
                db=db,
                service_id=service.id,
                quantity=rental.quantity,
                note=f"Thu hồi toàn bộ vợt Booking #{booking_id}" + (f": {note}" if note else ""),
                commit=False,
            )
        rental.status = RacketRentalStatus.RETURNED.value
        rental.returned_at = datetime.now()
        if service:
            rental.service_name = service.name

    db.commit()
    for rental in rentals:
        db.refresh(rental)
        if rental.service:
            rental.service_name = rental.service.name
    return rentals


def get_booking_rental_warning(db: Session, booking_id: int) -> dict:
    """Kiểm tra cảnh báo vợt chưa trả lúc thanh toán / trả sân."""
    query = (
        select(RacketRental)
        .where(RacketRental.booking_id == booking_id)
        .order_by(RacketRental.id.desc())
    )
    rentals = list(db.scalars(query))
    unreturned = [r for r in rentals if r.status == RacketRentalStatus.RENTING.value]

    out_rentals = []
    for r in rentals:
        s_name = r.service.name if r.service else "Vợt cầu lông"
        out_rentals.append(
            RacketRentalOut(
                id=r.id,
                booking_id=r.booking_id,
                service_id=r.service_id,
                service_name=s_name,
                service_order_id=r.service_order_id,
                quantity=r.quantity,
                status=r.status,
                rented_at=r.rented_at,
                returned_at=r.returned_at,
                note=r.note,
                created_at=r.created_at,
            )
        )

    return {
        "booking_id": booking_id,
        "has_unreturned_rackets": len(unreturned) > 0,
        "unreturned_count": sum(r.quantity for r in unreturned),
        "rentals": out_rentals,
    }
