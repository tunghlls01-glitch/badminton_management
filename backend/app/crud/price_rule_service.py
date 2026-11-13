from datetime import date, time
from decimal import Decimal
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.court import Court
from app.models.price_rule import PriceRule, PriceRuleStatus
from app.schemas.price_rule import PriceRuleCreate, PriceRuleUpdate


def _time_to_minutes(t: time) -> int:
    return t.hour * 60 + t.minute


def _check_time_overlap(
    db: Session,
    court_id: int,
    day_of_week: str,
    start_time: time,
    end_time: time,
    exclude_rule_id: Optional[int] = None,
) -> None:
    """Chặn tạo/sửa quy tắc giá có khung giờ trùng lặp trên cùng sân và cùng loại ngày"""
    query = db.query(PriceRule).filter(
        PriceRule.court_id == court_id,
        PriceRule.day_of_week == day_of_week,
        PriceRule.status == PriceRuleStatus.Active,
        PriceRule.start_time < end_time,
        PriceRule.end_time > start_time,
    )
    if exclude_rule_id is not None:
        query = query.filter(PriceRule.id != exclude_rule_id)

    conflict = query.first()
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Khung giờ {start_time.strftime('%H:%M')} - {end_time.strftime('%H:%M')} ({day_of_week}) "
                f"bị trùng với quy tắc giá hiện có ({conflict.start_time.strftime('%H:%M')} - "
                f"{conflict.end_time.strftime('%H:%M')})!"
            ),
        )


def list_price_rules(
    db: Session, court_id: Optional[int] = None, day_of_week: Optional[str] = None
) -> List[PriceRule]:
    query = db.query(PriceRule).filter(PriceRule.status == PriceRuleStatus.Active)
    if court_id is not None:
        query = query.filter(PriceRule.court_id == court_id)
    if day_of_week is not None:
        query = query.filter(PriceRule.day_of_week == day_of_week.upper())

    return query.order_by(PriceRule.court_id, PriceRule.day_of_week, PriceRule.start_time).all()


def get_price_rule(db: Session, rule_id: int) -> PriceRule:
    rule = db.query(PriceRule).filter(PriceRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy quy tắc giá id={rule_id}")
    return rule


def create_price_rule(db: Session, data: PriceRuleCreate) -> PriceRule:
    court = db.query(Court).filter(Court.id == data.court_id).first()
    if not court:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy sân id={data.court_id}")

    _check_time_overlap(db, data.court_id, data.day_of_week, data.start_time, data.end_time)

    new_rule = PriceRule(
        court_id=data.court_id,
        day_of_week=data.day_of_week,
        start_time=data.start_time,
        end_time=data.end_time,
        hourly_rate=Decimal(str(data.hourly_rate)),
        status=PriceRuleStatus.Active,
    )
    db.add(new_rule)
    db.commit()
    db.refresh(new_rule)
    return new_rule


def update_price_rule(db: Session, rule_id: int, data: PriceRuleUpdate) -> PriceRule:
    rule = get_price_rule(db, rule_id)
    update_dict = data.model_dump(exclude_unset=True)

    new_day = update_dict.get("day_of_week", rule.day_of_week)
    new_start = update_dict.get("start_time", rule.start_time)
    new_end = update_dict.get("end_time", rule.end_time)

    if new_start >= new_end:
        raise HTTPException(status_code=400, detail="Giờ bắt đầu phải nhỏ hơn giờ kết thúc!")

    _check_time_overlap(db, rule.court_id, new_day, new_start, new_end, exclude_rule_id=rule.id)

    rule.day_of_week = new_day
    rule.start_time = new_start
    rule.end_time = new_end
    if "hourly_rate" in update_dict and update_dict["hourly_rate"] is not None:
        rule.hourly_rate = Decimal(str(update_dict["hourly_rate"]))

    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


def delete_price_rule(db: Session, rule_id: int) -> None:
    rule = get_price_rule(db, rule_id)
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
    """
    Tính tiền thuê sân theo ngày và khung giờ (hỗ trợ cắt qua nhiều khung giờ cao/thấp điểm).
    - ngay.weekday(): 0..4 (Thứ 2 - Thứ 6) -> 'WEEKDAY'
    - ngay.weekday(): 5..6 (Thứ 7 - CN)    -> 'WEEKEND'
    """
    if gio_bat_dau >= gio_ket_thuc:
        raise HTTPException(status_code=400, detail="Giờ bắt đầu phải nhỏ hơn giờ kết thúc!")

    day_type = "WEEKEND" if ngay.weekday() >= 5 else "WEEKDAY"

    rules = (
        db.query(PriceRule)
        .filter(
            PriceRule.court_id == san_id,
            PriceRule.day_of_week == day_type,
            PriceRule.status == PriceRuleStatus.Active,
        )
        .order_by(PriceRule.start_time)
        .all()
    )

    if not rules:
        raise HTTPException(
            status_code=400,
            detail=f"Sân id={san_id} chưa được cấu hình bảng giá cho {day_type}!",
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
            rate = float(rule.hourly_rate)
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
            detail=f"Khoảng giờ đặt ({gio_bat_dau.strftime('%H:%M')} - {gio_ket_thuc.strftime('%H:%M')}) có phần chưa được cấu hình giá ({day_type})!",
        )

    return {
        "court_id": san_id,
        "play_date": ngay,
        "day_type": day_type,
        "start_time": gio_bat_dau,
        "end_time": gio_ket_thuc,
        "total_hours": round(expected_minutes / 60.0, 2),
        "total_amount": round(total_amount, 2),
        "breakdown": breakdown,
    }