"""CRUD cho bảng court_blocks."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.court_block import CourtBlock
from app.schemas.court_block import CourtBlockCreate, CourtBlockUpdate


def get_court_blocks(db: Session, court_id: int | None = None) -> list[CourtBlock]:
    query = select(CourtBlock).order_by(CourtBlock.start_time.asc())
    if court_id:
        query = query.where(CourtBlock.court_id == court_id)
    return list(db.scalars(query))


def get_court_block(db: Session, block_id: int) -> CourtBlock | None:
    return db.get(CourtBlock, block_id)


def create_court_block(db: Session, data: CourtBlockCreate) -> CourtBlock:
    block = CourtBlock(**data.model_dump())
    db.add(block)
    db.commit()
    db.refresh(block)
    return block


def update_court_block(db: Session, block: CourtBlock, data: CourtBlockUpdate) -> CourtBlock:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(block, field, value)
    db.commit()
    db.refresh(block)
    return block


def delete_court_block(db: Session, block: CourtBlock) -> None:
    db.delete(block)
    db.commit()
