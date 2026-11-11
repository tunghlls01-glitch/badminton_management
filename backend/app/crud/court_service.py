import os
import uuid
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.crud import court as court_crud
from app.models.booking_slot import BookingSlot
from app.models.court import Court
from app.schemas.court import CourtCreate, CourtUpdate

UPLOAD_DIR = "static/uploads/courts"


def get_court_by_id(db: Session, court_id: int) -> Court:
    court = court_crud.get_court(db, court_id)
    if not court:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy sân id={court_id}")
    return court


def get_all_courts(db: Session, skip: int = 0, limit: int = 100):
    return court_crud.get_courts(db, skip=skip, limit=limit)


def create_new_court(db: Session, data: CourtCreate) -> Court:
    return court_crud.create_court(db, data)


def update_existing_court(db: Session, court_id: int, data: CourtUpdate) -> Court:
    court = get_court_by_id(db, court_id)
    return court_crud.update_court(db, court, data)


def delete_court_with_check(db: Session, court_id: int) -> None:
    court = get_court_by_id(db, court_id)

    # Ràng buộc nghiệp vụ: Sân đã có booking thì KHÔNG CHO XÓA (bắt lỗi 400)[cite: 1]
    has_booking = db.query(BookingSlot).filter(BookingSlot.court_id == court.id).first()
    if has_booking:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sân đã có lịch đặt (booking), không thể xóa! Vui lòng chuyển trạng thái sang BẢO TRÌ hoặc NGỪNG HOẠT ĐỘNG.",
        )

    court_crud.delete_court(db, court)


async def save_court_image(db: Session, court_id: int, file: UploadFile) -> Court:
    court = get_court_by_id(db, court_id)

    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File tải lên phải là định dạng hình ảnh!")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_ext = os.path.splitext(file.filename)[1]
    unique_filename = f"court_{court.id}_{uuid.uuid4().hex[:8]}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)

    court.image_url = f"/static/uploads/courts/{unique_filename}"
    db.add(court)
    db.commit()
    db.refresh(court)
    return court