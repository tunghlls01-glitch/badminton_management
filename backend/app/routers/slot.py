from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

# Import get_db session từ thư mục db của bạn
from app.db.session import get_db
from app.schemas.slot import (
    SlotGridResponse,
    SlotHoldRequest,
    SlotHoldResponse,
    SlotReleaseRequest,
)
from app.crud.slot import (
    get_slot_grid_by_date,
    hold_slots,
    release_slots,
)

router = APIRouter(prefix="/slots", tags=["Slots"])


@router.get("/grid", response_model=SlotGridResponse)
def get_slot_grid(
    target_date: date = Query(..., alias="date", description="Ngày cần xem dạng YYYY-MM-DD"),
    db: Session = Depends(get_db)
):
    courts_data = get_slot_grid_by_date(db=db, query_date=target_date)

    return SlotGridResponse(
        date=str(target_date),
        operating_hours={
            "open": "06:00",
            "close": "22:00",
            "slot_duration_minutes": 60
        },
        courts=courts_data
    )


@router.post("/hold", response_model=SlotHoldResponse)
def create_slot_hold(
    payload: SlotHoldRequest,
    db: Session = Depends(get_db)
):
    return hold_slots(db=db, payload=payload)


@router.post("/release")
def release_slot_hold(
    payload: SlotReleaseRequest,
    db: Session = Depends(get_db)
):
    return release_slots(db=db, payload=payload)