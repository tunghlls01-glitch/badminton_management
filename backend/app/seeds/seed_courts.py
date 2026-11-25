"""Seed the six courts from sql/seed_courts.sql using the current schema.

Run from backend: python -m app.seeds.seed_courts
Existing courts with the same name are kept unchanged.
"""
from datetime import datetime, time, timedelta
from decimal import Decimal
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.db.session import SessionLocal
from app.models.court import Court, CourtStatus
from app.models.price_rule import PriceRule, PriceRuleStatus
from app.models.court_block import CourtBlock, CourtBlockStatus
from app.models.public_pricing import PublicPricing


SAMPLE_COURTS = [
    ("Sân số 1", "Sân thảm tiêu chuẩn thi đấu, ánh sáng chống chói.", CourtStatus.Active),
    ("Sân số 2", "Sân thảm chất lượng cao, độ bám tốt, thích hợp đánh đơn và đôi.", CourtStatus.Active),
    ("Sân số 3", "Thảm PVC 5 lớp đàn hồi cao, giảm chấn thương khớp gối.", CourtStatus.Active),
    ("Sân số 4 (VIP)", "Sân phòng lạnh riêng biệt, khán đài mini, nước uống miễn phí.", CourtStatus.Active),
    ("Sân số 5 (VIP)", "Sân thi đấu chuyên nghiệp, hệ thống camera xem lại pha bóng.", CourtStatus.Active),
    ("Sân số 6", "Sân đang thay thảm mới và bảo trì dàn đèn chiếu sáng.", CourtStatus.Maintenance),
]


def seed_courts():
    try:
        with SessionLocal.begin() as db:
            existing = {name for (name,) in db.query(Court.name).all()}
            added = 0
            for name, description, status in SAMPLE_COURTS:
                if name not in existing:
                    db.add(Court(name=name, description=description, status=status))
                    added += 1
            return added
    except Exception as e:
        print(f"[SEED] Bỏ qua seed courts do lỗi: {e}")
        return 0


def seed_price_rules_and_blocks():
    try:
        with SessionLocal.begin() as db:
            # 1. Price rules
            existing_rules_count = db.query(PriceRule).count()
            if existing_rules_count == 0:
                courts = db.query(Court).all()
                for court in courts:
                    is_vip = "VIP" in court.name
                    weekday_rates = [
                        (time(6, 0), time(17, 0), Decimal("120000" if is_vip else "80000")),
                        (time(17, 0), time(22, 0), Decimal("180000" if is_vip else "120000")),
                    ]
                    weekend_rates = [
                        (time(6, 0), time(17, 0), Decimal("150000" if is_vip else "100000")),
                        (time(17, 0), time(22, 0), Decimal("220000" if is_vip else "150000")),
                    ]
                    for start_t, end_t, rate in weekday_rates:
                        db.add(PriceRule(court_id=court.id, day_of_week=0, start_time=start_t, end_time=end_t, price_per_hour=rate, status=PriceRuleStatus.Active))
                    for start_t, end_t, rate in weekend_rates:
                        db.add(PriceRule(court_id=court.id, day_of_week=1, start_time=start_t, end_time=end_t, price_per_hour=rate, status=PriceRuleStatus.Active))
                print(f"[SEED] Đã thêm price rules cho {len(courts)} sân.")

            # 2. Court block mẫu cho Sân số 6
            existing_blocks_count = db.query(CourtBlock).count()
            if existing_blocks_count == 0:
                court6 = db.query(Court).filter(Court.name.like("%6%")).first()
                if court6:
                    now = datetime.now()
                    db.add(CourtBlock(
                        court_id=court6.id,
                        created_by=1,
                        start_at=now.replace(hour=6, minute=0, second=0, microsecond=0),
                        end_at=(now + timedelta(days=2)).replace(hour=22, minute=0, second=0, microsecond=0),
                        reason="Bảo trì thay mặt thảm PVC mới và dàn đèn",
                        status=CourtBlockStatus.Active
                    ))
                    print("[SEED] Đã thêm 1 court block bảo trì cho Sân 6.")

            # 3. Public pricing
            if db.query(PublicPricing).count() == 0:
                from app.routers.public_pricing import DEFAULT_PRICING
                db.add(PublicPricing(
                    id=1,
                    revision=1,
                    rules=[r.model_dump(mode="json") for r in DEFAULT_PRICING.rules]
                ))
                print("[SEED] Đã khởi tạo public pricing.")
    except Exception as e:
        print(f"[SEED] Lỗi khi seed price rules & blocks: {e}")


if __name__ == "__main__":
    added = seed_courts()
    print(f"Added {added} sample courts.")
    seed_price_rules_and_blocks()

