from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.court import Court
from app.models.booking import Booking, BookingStatus
from app.models.booking_slot import BookingSlot, BookingSlotStatus
from app.models.maintenance_block import CourtMaintenanceBlock
from app.schemas.maintenance_block import (
    MaintenanceBlockCreate,
    MaintenanceBlockOut,
    AffectedBookingOut,
)

router = APIRouter(
    prefix="/courts/{court_id}/maintenance-blocks",
    tags=["Court Maintenance Blocks"],
)


def _find_affected_bookings(
    db: Session, court_id: int, start_at: datetime, end_at: datetime
) -> list[AffectedBookingOut]:
    rows = (
        db.query(Booking, BookingSlot)
        .join(BookingSlot, BookingSlot.booking_id == Booking.id)
        .filter(
            BookingSlot.court_id == court_id,
            BookingSlot.start_at < end_at,
            BookingSlot.end_at > start_at,
            BookingSlot.status != BookingSlotStatus.Cancelled,
            Booking.status.notin_([BookingStatus.Cancelled, BookingStatus.Expired]),
        )
        .all()
    )

    affected: list[AffectedBookingOut] = []
    seen_booking_ids: set[int] = set()

    for bk, slot in rows:
        if bk.id in seen_booking_ids:
            continue
        seen_booking_ids.add(bk.id)

        user_obj = getattr(bk, "user", None)
        customer_name = (
            getattr(user_obj, "full_name", None)
            or getattr(user_obj, "username", None)
            or bk.booking_code
        )
        affected.append(
            AffectedBookingOut(
                id=bk.id,
                customer_name=customer_name,
                start_at=slot.start_at,
                end_at=slot.end_at,
                status=bk.status.value if hasattr(bk.status, "value") else str(bk.status),
            )
        )
    return affected


def _serialize_block(db: Session, block: CourtMaintenanceBlock) -> MaintenanceBlockOut:
    return MaintenanceBlockOut(
        id=block.id,
        court_id=block.court_id,
        reason=block.reason,
        start_at=block.start_at,
        end_at=block.end_at,
        affected_bookings=_find_affected_bookings(
            db, block.court_id, block.start_at, block.end_at
        ),
    )


@router.get("", response_model=list[MaintenanceBlockOut])
def list_maintenance_blocks(court_id: int, db: Session = Depends(get_db)):
    court = db.query(Court).filter(Court.id == court_id).first()
    if not court:
        raise HTTPException(status_code=404, detail="Không tìm thấy sân")

    blocks = (
        db.query(CourtMaintenanceBlock)
        .filter(CourtMaintenanceBlock.court_id == court_id)
        .order_by(CourtMaintenanceBlock.start_at.desc())
        .all()
    )
    return [_serialize_block(db, b) for b in blocks]


@router.post("", response_model=MaintenanceBlockOut, status_code=status.HTTP_201_CREATED)
def create_maintenance_block(
    court_id: int,
    payload: MaintenanceBlockCreate,
    db: Session = Depends(get_db),
):
    court = db.query(Court).filter(Court.id == court_id).first()
    if not court:
        raise HTTPException(status_code=404, detail="Không tìm thấy sân")

    if payload.end_at <= payload.start_at:
        raise HTTPException(
            status_code=400,
            detail="Thời gian kết thúc phải lớn hơn thời gian bắt đầu",
        )

    block = CourtMaintenanceBlock(
        court_id=court_id,
        reason=payload.reason.strip(),
        start_at=payload.start_at,
        end_at=payload.end_at,
    )
    db.add(block)
    db.commit()
    db.refresh(block)
    return _serialize_block(db, block)


@router.delete("/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_maintenance_block(court_id: int, block_id: int, db: Session = Depends(get_db)):
    block = (
        db.query(CourtMaintenanceBlock)
        .filter(
            CourtMaintenanceBlock.id == block_id,
            CourtMaintenanceBlock.court_id == court_id,
        )
        .first()
    )
    if not block:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch khoá")

    db.delete(block)
    db.commit()