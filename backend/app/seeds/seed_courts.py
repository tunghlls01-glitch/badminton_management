"""Seed the six courts from sql/seed_courts.sql using the current schema.

Run from backend: python -m app.seeds.seed_courts
Existing courts with the same name are kept unchanged.
"""
from app.db.session import SessionLocal
from app.models.court import Court, CourtStatus


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


if __name__ == "__main__":
    print(f"Added {seed_courts()} sample courts.")
