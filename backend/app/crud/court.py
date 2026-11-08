"""CRUD cho bảng courts."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.court import Court
from app.schemas.court import CourtCreate, CourtUpdate


def get_courts(
    db: Session, keyword: str | None = None, status: str | None = None
) -> list[Court]:
    query = select(Court).order_by(Court.id.asc())
    if keyword:
        query = query.where(Court.name.contains(keyword))
    if status:
        query = query.where(Court.status == status)
    return list(db.scalars(query))


def get_court(db: Session, court_id: int) -> Court | None:
    return db.get(Court, court_id)


def create_court(db: Session, data: CourtCreate) -> Court:
    court = Court(**data.model_dump())
    db.add(court)
    db.commit()
    db.refresh(court)
    return court


def update_court(db: Session, court: Court, data: CourtUpdate) -> Court:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(court, field, value)
    db.commit()
    db.refresh(court)
    return court


def delete_court(db: Session, court: Court) -> None:
    db.delete(court)
    db.commit()
