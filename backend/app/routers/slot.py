from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

# Import get_db session từ thư mục db của bạn[cite: 1]
from app.db.session import get_db
from app.schemas.slot import SlotGridResponse
from app.crud.slot import get_slot_grid_by_date

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