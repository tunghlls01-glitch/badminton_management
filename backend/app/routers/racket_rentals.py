from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.crud import racket_rental as rental_crud
from app.db.session import get_db
from app.models.user import User
from app.schemas.racket_rental import (
    BookingRentalWarningOut,
    RacketRentalCreate,
    RacketRentalOut,
    RacketRentalReturn,
)

router = APIRouter(prefix="/api/racket-rentals", tags=["Racket Rentals (Thuê & Trả vợt)"])


@router.get("", response_model=List[RacketRentalOut])
def list_racket_rentals(
    booking_id: Optional[int] = Query(None, description="Lọc theo mã booking"),
    status: Optional[str] = Query(None, description="Lọc theo trạng thái: RENTING hoặc RETURNED"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy danh sách các lượt thuê vợt."""
    rentals = rental_crud.get_rentals(
        db=db, booking_id=booking_id, status=status, skip=skip, limit=limit
    )
    results = []
    for r in rentals:
        s_name = r.service.name if r.service else "Vợt cầu lông"
        results.append(
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
    return results


@router.post("", response_model=RacketRentalOut, status_code=status.HTTP_201_CREATED)
def create_racket_rental(
    data: RacketRentalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tạo mới một lượt thuê vợt cho Booking."""
    try:
        rental = rental_crud.create_rental(db=db, data=data)
        return RacketRentalOut(
            id=rental.id,
            booking_id=rental.booking_id,
            service_id=rental.service_id,
            service_name=rental.service.name if rental.service else "Vợt cầu lông",
            service_order_id=rental.service_order_id,
            quantity=rental.quantity,
            status=rental.status,
            rented_at=rental.rented_at,
            returned_at=rental.returned_at,
            note=rental.note,
            created_at=rental.created_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{rental_id}/return", response_model=RacketRentalOut)
def return_racket_rental(
    rental_id: int,
    body: Optional[RacketRentalReturn] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Đánh dấu một lượt thuê là ĐÃ TRẢ VỢT và tự động hoàn lại tồn kho khả dụng."""
    try:
        note_text = body.note if body else None
        rental = rental_crud.return_rental(db=db, rental_id=rental_id, note=note_text)
        return RacketRentalOut(
            id=rental.id,
            booking_id=rental.booking_id,
            service_id=rental.service_id,
            service_name=rental.service.name if rental.service else "Vợt cầu lông",
            service_order_id=rental.service_order_id,
            quantity=rental.quantity,
            status=rental.status,
            rented_at=rental.rented_at,
            returned_at=rental.returned_at,
            note=rental.note,
            created_at=rental.created_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/warning/{booking_id}", response_model=BookingRentalWarningOut)
def check_booking_rental_warning(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Kiểm tra cảnh báo vợt chưa hoàn trả trước khi thanh toán cho Booking."""
    return rental_crud.get_booking_rental_warning(db=db, booking_id=booking_id)


@router.post("/return-all/{booking_id}", response_model=List[RacketRentalOut])
def return_all_booking_rackets(
    booking_id: int,
    body: Optional[RacketRentalReturn] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Thu hồi nhanh toàn bộ vợt chưa trả của Booking tại quầy lễ tân."""
    try:
        note_text = body.note if body else "Thu hồi tại quầy thanh toán"
        rentals = rental_crud.return_all_rackets_for_booking(
            db=db, booking_id=booking_id, note=note_text
        )
        results = []
        for r in rentals:
            s_name = r.service.name if r.service else "Vợt cầu lông"
            results.append(
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
        return results
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
