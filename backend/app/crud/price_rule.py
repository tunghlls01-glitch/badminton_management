"""CRUD cho bảng price_rules."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.price_rule import PriceRule
from app.schemas.price_rule import PriceRuleCreate, PriceRuleUpdate


def get_price_rules(db: Session, day_type: str | None = None) -> list[PriceRule]:
    query = select(PriceRule).order_by(PriceRule.day_type.asc(), PriceRule.start_time.asc())
    if day_type:
        query = query.where(PriceRule.day_type == day_type)
    return list(db.scalars(query))


def get_price_rule(db: Session, rule_id: int) -> PriceRule | None:
    return db.get(PriceRule, rule_id)


def create_price_rule(db: Session, data: PriceRuleCreate) -> PriceRule:
    rule = PriceRule(**data.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


def update_price_rule(db: Session, rule: PriceRule, data: PriceRuleUpdate) -> PriceRule:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)
    db.commit()
    db.refresh(rule)
    return rule


def delete_price_rule(db: Session, rule: PriceRule) -> None:
    db.delete(rule)
    db.commit()
