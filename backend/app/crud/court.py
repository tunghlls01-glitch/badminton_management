"""CRUD cho bảng courts."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.court import Court
from app.schemas.court import CourtCreate, CourtUpdate


def get_courts(
    db: Session,
    keyword: str | None = None,
    status: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Court]:
    query = select(Court).order_by(Court.id.asc())
    if keyword:
        query = query.where(Court.name.contains(keyword))
    if status:
        query = query.where(Court.status == status)
    if skip:
        query = query.offset(skip)
    if limit:
        query = query.limit(limit)
    return list(db.scalars(query))


def get_court(db: Session, court_id: int) -> Court | None:
    return db.get(Court, court_id)


def create_court(db: Session, data: CourtCreate) -> Court:
    court_name = data.name or data.court_name or "Sân mới"
    status_val = data.status or "Active"
    if status_val == "HOẠT ĐỘNG":
        status_val = "Active"
    elif status_val == "BẢO TRÌ":
        status_val = "Maintenance"
    elif status_val == "NGỪNG HOẠT ĐỘNG":
        status_val = "Inactive"

    court = Court(
        name=court_name,
        description=data.description,
        status=status_val,
    )
    db.add(court)
    db.commit()
    db.refresh(court)
    return court


def update_court(db: Session, court: Court, data: CourtUpdate) -> Court:
    dump = data.model_dump(exclude_unset=True)
    if "name" in dump and dump["name"]:
        court.name = dump["name"]
    elif "court_name" in dump and dump["court_name"]:
        court.name = dump["court_name"]

    if "description" in dump:
        court.description = dump["description"]

    if "status" in dump and dump["status"]:
        status_val = dump["status"]
        if status_val == "HOẠT ĐỘNG":
            status_val = "Active"
        elif status_val == "BẢO TRÌ":
            status_val = "Maintenance"
        elif status_val == "NGỪNG HOẠT ĐỘNG":
            status_val = "Inactive"
        court.status = status_val

    db.commit()
    db.refresh(court)
    return court


def delete_court(db: Session, court: Court) -> None:
    db.delete(court)
    db.commit()
