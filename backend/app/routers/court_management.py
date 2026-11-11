from typing import List
from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from app.crud import court_service
from app.db.session import get_db
from app.schemas.court import CourtCreate, CourtResponse, CourtUpdate

router = APIRouter(prefix="/courts", tags=["Court Management"])


@router.get("", response_model=List[CourtResponse])
def list_courts(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Lấy danh sách sân"""
    return court_service.get_all_courts(db, skip=skip, limit=limit)


@router.get("/{court_id}", response_model=CourtResponse)
def get_court(court_id: int, db: Session = Depends(get_db)):
    """Chi tiết 1 sân"""
    return court_service.get_court_by_id(db, court_id)


@router.post("", response_model=CourtResponse, status_code=status.HTTP_201_CREATED)
def create_court(data: CourtCreate, db: Session = Depends(get_db)):
    """Thêm mới sân"""
    return court_service.create_new_court(db, data)


@router.put("/{court_id}", response_model=CourtResponse)
def update_court(court_id: int, data: CourtUpdate, db: Session = Depends(get_db)):
    """Sửa thông tin sân / Đổi trạng thái hoạt động - bảo trì"""
    return court_service.update_existing_court(db, court_id, data)


@router.delete("/{court_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_court(court_id: int, db: Session = Depends(get_db)):
    """Xóa sân (Không cho xóa nếu sân đã có booking)"""
    court_service.delete_court_with_check(db, court_id)


@router.post("/{court_id}/upload-image", response_model=CourtResponse)
async def upload_court_image(
    court_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload ảnh sân"""
    return await court_service.save_court_image(db, court_id, file)