from datetime import time
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.court import Court, CourtStatus, PriceRule, PriceRuleStatus


def get_courts(db: Session) -> list[Court]:
    query = select(Court).order_by(Court.id.asc())
    courts = list(db.scalars(query))
    if not courts:
        default_courts = [
            Court(id=1, name="Sân 1", description="Sân tiêu chuẩn thảm PVC", status=CourtStatus.Active),
            Court(id=2, name="Sân 2", description="Sân tiêu chuẩn thảm PVC", status=CourtStatus.Active),
            Court(id=3, name="Sân 3", description="Sân tiêu chuẩn thảm PVC", status=CourtStatus.Active),
            Court(id=4, name="Sân 4", description="Sân tiêu chuẩn thảm PVC", status=CourtStatus.Active),
            Court(id=5, name="Sân 5 (VIP)", description="Sân VIP có quạt phun sương & đèn LED", status=CourtStatus.Active),
        ]
        db.add_all(default_courts)
        db.commit()

        default_rules = [
            PriceRule(court_id=1, day_of_week=1, start_time=time(5, 0), end_time=time(23, 0), price_per_hour=Decimal("50000"), status=PriceRuleStatus.Active),
            PriceRule(court_id=2, day_of_week=1, start_time=time(5, 0), end_time=time(23, 0), price_per_hour=Decimal("50000"), status=PriceRuleStatus.Active),
            PriceRule(court_id=3, day_of_week=1, start_time=time(5, 0), end_time=time(23, 0), price_per_hour=Decimal("50000"), status=PriceRuleStatus.Active),
            PriceRule(court_id=4, day_of_week=1, start_time=time(5, 0), end_time=time(23, 0), price_per_hour=Decimal("50000"), status=PriceRuleStatus.Active),
            PriceRule(court_id=5, day_of_week=1, start_time=time(5, 0), end_time=time(23, 0), price_per_hour=Decimal("80000"), status=PriceRuleStatus.Active),
        ]
        db.add_all(default_rules)
        db.commit()

        courts = list(db.scalars(query))
    return courts


def get_court(db: Session, court_id: int) -> Court | None:
    return db.get(Court, court_id)


def get_court_price_per_hour(db: Session, court_id: int) -> Decimal:
    rule = db.scalar(
        select(PriceRule)
        .where(PriceRule.court_id == court_id, PriceRule.status == PriceRuleStatus.Active)
        .limit(1)
    )
    if rule:
        return rule.price_per_hour
    court = db.get(Court, court_id)
    if court and "VIP" in court.name.upper():
        return Decimal("80000")
    return Decimal("50000")
