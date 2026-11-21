from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.crud.admin_overview import get_overview, search_bookings
from app.crud.booking import vietnam_now
from app.db.session import get_db
from app.models.user import UserRole
from app.schemas.admin_overview import AdminOverview, OverviewBooking

router = APIRouter(
    prefix="/admin/overview",
    tags=["Admin overview"],
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)


@router.get("", response_model=AdminOverview, response_model_exclude_none=True)
def overview(day: date | None = None, db: Session = Depends(get_db)):
    now = vietnam_now()
    return get_overview(db, day or now.date(), now)


@router.get("/search", response_model=list[OverviewBooking])
def search(q: str = Query(min_length=1, max_length=100), db: Session = Depends(get_db)):
    return search_bookings(db, q, vietnam_now())
