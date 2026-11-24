from datetime import time
from typing import Literal

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.public_pricing import PublicPricing
from app.models.user import UserRole


class PublicPriceRule(BaseModel):
    id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=100)
    day_type: Literal["WEEKDAY", "WEEKEND", "ALL"]
    start_time: time
    end_time: time
    price: int = Field(ge=0, le=999999999)


class PublicPricingTable(BaseModel):
    revision: int = Field(ge=0)
    rules: list[PublicPriceRule] = Field(max_length=100)

    @model_validator(mode="after")
    def validate_rules(self):
        ids = set()
        for index, rule in enumerate(self.rules):
            if rule.id in ids:
                raise ValueError("Mã quy tắc bị trùng.")
            ids.add(rule.id)
            if rule.start_time >= rule.end_time:
                raise ValueError("Giờ kết thúc phải sau giờ bắt đầu.")
            for other in self.rules[:index]:
                same_day = rule.day_type == other.day_type or "ALL" in (rule.day_type, other.day_type)
                if same_day and rule.start_time < other.end_time and other.start_time < rule.end_time:
                    raise ValueError("Các quy tắc giá bị trùng khung giờ.")
        return self


DEFAULT_PRICING = PublicPricingTable(revision=0, rules=[
    PublicPriceRule(id=1, name="Giờ vàng buổi sáng", day_type="WEEKDAY", start_time=time(6), end_time=time(11), price=120000),
    PublicPriceRule(id=2, name="Giờ tiêu chuẩn trưa", day_type="WEEKDAY", start_time=time(11), end_time=time(17), price=90000),
    PublicPriceRule(id=3, name="Giờ cao điểm tối", day_type="WEEKDAY", start_time=time(17), end_time=time(22), price=180000),
    PublicPriceRule(id=4, name="Cuối tuần trọn gói", day_type="WEEKEND", start_time=time(6), end_time=time(22), price=150000),
])


def get_public_pricing(db: Session = Depends(get_db)) -> PublicPricingTable:
    record = db.get(PublicPricing, 1)
    if record is None:
        return DEFAULT_PRICING
    return PublicPricingTable(revision=record.revision, rules=record.rules)


def save_public_pricing(
    table: PublicPricingTable,
    db: Session = Depends(get_db),
    _admin=Depends(require_roles(UserRole.ADMIN)),
) -> PublicPricingTable:
    revision = table.revision + 1
    rules = [rule.model_dump(mode="json") for rule in table.rules]
    conflict = HTTPException(409, "Bảng giá đã được cập nhật ở phiên khác. Vui lòng tải lại trang.")
    if table.revision == 0:
        db.add(PublicPricing(id=1, revision=revision, rules=rules))
    else:
        result = db.execute(
            update(PublicPricing)
            .where(PublicPricing.id == 1, PublicPricing.revision == table.revision)
            .values(revision=revision, rules=rules)
        )
        if result.rowcount != 1:
            raise conflict
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise conflict from None
    return PublicPricingTable(revision=revision, rules=table.rules)
