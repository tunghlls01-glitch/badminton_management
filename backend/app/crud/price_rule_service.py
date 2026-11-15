from datetime import date, time
from decimal import Decimal
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.court import Court
from app.models.price_rule import PriceRule, PriceRuleStatus
from app.schemas.price_rule import PriceRuleCreate, PriceRuleUpdate

DAY_STR_TO_INT = {"WEEKDAY": 0, "WEEKEND": 1}
DAY_INT_TO_STR = {0: "WEEKDAY", 1: "WEEKEND"}


def _normalize_day_to_int(day_val: Optional[str]) -> int:
    if not day_val:
        return 0
    upper_val = str(day_val).strip().upper()
    if upper_val in DAY_STR_TO_INT:
        return DAY_STR_TO_INT[upper_val]
    raise HTTPException(
        status_code=400,
        detail="Giá trị day_of_week chỉ chấp nhận 'WEEKDAY' (ngày thường) hoặc 'WEEKEND' (cuối tuần)!",
    )


def _format_rule_response(rule: PriceRule) -> dict:
    return {
        "id": rule.id,
        "court_id": rule.court_id,
        "day_of_week": DAY_INT_TO_STR.get(rule.day_of_week, "WEEKDAY"),
        "start_time": rule.start_time,
        "end_time": rule.end_time,
        "hourly_rate": float(rule.price_per_hour),
    }


def _time_to_minutes(t: time) -> int:
    return t.hour * 60 + t.minute


def _check_time_overlap(
    db: Session,
    court_id: int,
    day_int: int,
    start_time: time,
    end_time: time,
    exclude_rule_id: Optional[int] = None,
) -> None:
    query = db.query(PriceRule).filter(
        PriceRule.court_id == court_id,
        PriceRule.day_of_week == day_int,
        PriceRule.status == PriceRuleStatus.Active,
        PriceRule.start_time < end_time,
        PriceRule.end_time > start_time,
    )
    if exclude_rule_id is not None:
        query = query.filter(PriceRule.id != exclude_rule_id)

    conflict = query.first()
    if conflict:
        day_label = DAY_INT_TO_STR.get(day_int, str(day_int))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Khung giờ {start_time.strftime('%H:%M')} - {end_time.strftime('%H:%M')} ({day_label}) "
                f"bị trùng với quy tắc giá hiện có ({conflict.start_time.strftime('%H:%M')} - "
                f"{conflict.end_time.strftime('%H:%M')})!"
            ),
        )


def list_price_rules(
    db: Session, court_id: Optional[int] = None, day_of_week: Optional[str] = None
) -> List[dict]:
    query = db.query(PriceRule).filter(PriceRule.status == PriceRuleStatus.Active)
    if court_id is not None:
        query = query.filter(PriceRule.court_id == court_id)
    if day_of_week is not None:
        query = query.filter(PriceRule.day_of_week == _normalize_day_to_int(day_of_week))

    rules = query.order_by(PriceRule.court_id, PriceRule.day_of_week, PriceRule.start_time).all()
    return [_format_rule_response(r) for r in rules]


def get_price_rule_entity(db: Session, rule_id: int) -> PriceRule:
    rule = db.query(PriceRule).filter(PriceRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy quy tắc giá id={rule_id}")
    return rule


def get_price_rule(db: Session, rule_id: int) -> dict:
    return _format_rule_response(get_price_rule_entity(db, rule_id))


def create_price_rule(db: Session, data: PriceRuleCreate) -> dict:
    if data.start_time >= data.end_time:
        raise HTTPException(status_code=400, detail="Giờ bắt đầu phải nhỏ hơn giờ kết thúc!")

    court = db.query(Court).filter(Court.id == data.court_id).first()
    if not court:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy sân id={data.court_id}")

    day_int = _normalize_day_to_int(data.day_of_week)
    _check_time_overlap(db, data.court_id, day_int, data.start_time, data.end_time)

    new_rule = PriceRule(
        court_id=data.court_id,
        day_of_week=day_int,
        start_time=data.start_time,
        end_time=data.end_time,
        price_per_hour=Decimal(str(data.hourly_rate)),
        status=PriceRuleStatus.Active,
    )
    db.add(new_rule)
    db.commit()
    db.refresh(new_rule)
    return _format_rule_response(new_rule)


def update_price_rule(db: Session, rule_id: int, data: PriceRuleUpdate) -> dict:
    rule = get_price_rule_entity(db, rule_id)
    update_dict = data.model_dump(exclude_unset=True)

    new_day_int = (
        _normalize_day_to_int(update_dict["day_of_week"])
        if "day_of_week" in update_dict and update_dict["day_of_week"] is not None
        else rule.day_of_week
    )
    new_start = update_dict.get("start_time", rule.start_time)
    new_end = update_dict.get("end_time", rule.end_time)

    if new_start >= new_end:
        raise HTTPException(status_code=400, detail="Giờ bắt đầu phải nhỏ hơn giờ kết thúc!")

    _check_time_overlap(db, rule.court_id, new_day_int, new_start, new_end, exclude_rule_id=rule.id)

    rule.day_of_week = new_day_int
    rule.start_time = new_start
    rule.end_time = new_end
    if "hourly_rate" in update_dict and update_dict["hourly_rate"] is not None:
        rule.price_per_hour = Decimal(str(update_dict["hourly_rate"]))

    db.add(rule)
    db.commit()
    db.refresh(rule)
    return _format_rule_response(rule)


def delete_price_rule(db: Session, rule_id: int) -> None:
    rule = get_price_rule_entity(db, rule_id)
    db.delete(rule)
    db.commit()


# ==============================================================================
# HÀM DÙNG CHUNG CHO MODULE ĐẶT SÂN (BOOKING) VÀ THANH TOÁN (PAYMENT)
# ==============================================================================
def tinh_tien(
    db: Session,
    san_id: int,
    ngay: date,
    gio_bat_dau: time,
    gio_ket_thuc: time,
) -> dict:
    if gio_bat_dau >= gio_ket_thuc:
        raise HTTPException(status_code=400, detail="Giờ bắt đầu phải nhỏ hơn giờ kết thúc!")

    day_int = 1 if ngay.weekday() >= 5 else 0
    day_label = DAY_INT_TO_STR[day_int]

    rules = (
        db.query(PriceRule)
        .filter(
            PriceRule.court_id == san_id,
            PriceRule.day_of_week == day_int,
            PriceRule.status == PriceRuleStatus.Active,
        )
        .order_by(PriceRule.start_time)
        .all()
    )

    if not rules:
        raise HTTPException(
            status_code=400,
            detail=f"Sân id={san_id} chưa được cấu hình bảng giá cho {day_label}!",
        )

    req_start_min = _time_to_minutes(gio_bat_dau)
    req_end_min = _time_to_minutes(gio_ket_thuc)

    total_amount = 0.0
    covered_minutes = 0
    breakdown = []

    for rule in rules:
        rule_start_min = _time_to_minutes(rule.start_time)
        rule_end_min = _time_to_minutes(rule.end_time)

        overlap_start = max(req_start_min, rule_start_min)
        overlap_end = min(req_end_min, rule_end_min)

        if overlap_start < overlap_end:
            duration_minutes = overlap_end - overlap_start
            duration_hours = duration_minutes / 60.0
            rate = float(rule.price_per_hour)
            segment_cost = round(duration_hours * rate, 2)

            total_amount += segment_cost
            covered_minutes += duration_minutes

            breakdown.append({
                "from": f"{overlap_start // 60:02d}:{overlap_start % 60:02d}",
                "to": f"{overlap_end // 60:02d}:{overlap_end % 60:02d}",
                "hours": round(duration_hours, 2),
                "hourly_rate": rate,
                "amount": segment_cost,
            })

    expected_minutes = req_end_min - req_start_min
    if covered_minutes < expected_minutes:
        raise HTTPException(
            status_code=400,
            detail=f"Khoảng giờ đặt ({gio_bat_dau.strftime('%H:%M')} - {gio_ket_thuc.strftime('%H:%M')}) có phần chưa được cấu hình giá ({day_label})!",
        )

    return {
        "court_id": san_id,
        "play_date": ngay,
        "day_type": day_label,
        "start_time": gio_bat_dau,
        "end_time": gio_ket_thuc,
        "total_hours": round(expected_minutes / 60.0, 2),
        "total_amount": round(total_amount, 2),
        "breakdown": breakdown,
    }