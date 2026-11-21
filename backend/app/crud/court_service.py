import uuid
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.crud import court as court_crud
from app.core.config import BASE_DIR
from app.models.booking_slot import BookingSlot
from app.models.court import Court
from app.schemas.court import CourtCreate, CourtUpdate

COURT_IMAGE_URL = "/static/uploads/courts"
UPLOAD_DIR = BASE_DIR / "static" / "uploads" / "courts"
IMAGE_EXTENSIONS = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
IMAGE_TYPES = {extension: mime for mime, extension in IMAGE_EXTENSIONS.items()}
IMAGE_TYPES[".jpeg"] = "image/jpeg"


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

    try:
        court_crud.delete_court(db, court)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Không thể xóa sân vì còn dữ liệu liên quan.") from exc


async def save_court_image(db: Session, court_id: int, file: UploadFile) -> Court:
    court = get_court_by_id(db, court_id)

    extension = IMAGE_EXTENSIONS.get(file.content_type)
    if extension is None:
        raise HTTPException(status_code=400, detail="Ảnh sân phải có định dạng PNG, JPEG hoặc WebP.")
    max_size = 5 * 1024 * 1024
    content = await file.read(max_size + 1)
    if not content or len(content) > max_size:
        raise HTTPException(status_code=400, detail="Ảnh sân phải có nội dung và không vượt quá 5 MB.")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    unique_filename = f"court_{court.id}_{uuid.uuid4().hex[:8]}{extension}"
    file_path = UPLOAD_DIR / unique_filename

    file_path.write_bytes(content)

    court.image_url = f"{COURT_IMAGE_URL}/{unique_filename}"
    db.add(court)
    db.commit()
    db.refresh(court)
    return court
