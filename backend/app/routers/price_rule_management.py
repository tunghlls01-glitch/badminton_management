from typing import List, Literal, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.crud import price_rule_service
from app.db.session import get_db
from app.schemas.price_rule import (
    PriceRuleCreate,
    PriceRuleResponse,
    PriceRuleUpdate,
    TinhTienRequest,
)

router = APIRouter(prefix="/price-rules", tags=["Price Rules"])


@router.get("", response_model=List[PriceRuleResponse])
def get_all_price_rules(
    court_id: Optional[int] = Query(default=None, description="Lọc theo ID sân"),
    day_of_week: Optional[Literal["WEEKDAY", "WEEKEND"]] = Query(
        default=None, description="Lọc theo loại ngày: WEEKDAY hoặc WEEKEND"
    ),
    db: Session = Depends(get_db),
):
    """Danh sách quy tắc giá theo khung giờ và ngày thường/cuối tuần"""
    return price_rule_service.list_price_rules(db, court_id=court_id, day_of_week=day_of_week)


@router.get("/{rule_id}", response_model=PriceRuleResponse)
def get_price_rule_detail(rule_id: int, db: Session = Depends(get_db)):
    """Chi tiết 1 quy tắc giá"""
    return price_rule_service.get_price_rule(db, rule_id)


@router.post("", response_model=PriceRuleResponse, status_code=status.HTTP_201_CREATED)
def create_price_rule(data: PriceRuleCreate, db: Session = Depends(get_db)):
    """Thêm quy tắc giá mới (Tự động chặn trùng khung giờ)"""
    return price_rule_service.create_price_rule(db, data)


@router.put("/{rule_id}", response_model=PriceRuleResponse)
def update_price_rule(rule_id: int, data: PriceRuleUpdate, db: Session = Depends(get_db)):
    """Sửa quy tắc giá (Tự động chặn trùng khung giờ)"""
    return price_rule_service.update_price_rule(db, rule_id, data)


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_price_rule(rule_id: int, db: Session = Depends(get_db)):
    """Xóa quy tắc giá"""
    price_rule_service.delete_price_rule(db, rule_id)


@router.post("/tinh-tien")
def api_tinh_tien(payload: TinhTienRequest, db: Session = Depends(get_db)):
    """API kiểm thử hàm dùng chung tinh_tien(san_id, ngay, gio_bat_dau, gio_ket_thuc)"""
    return price_rule_service.tinh_tien(
        db=db,
        san_id=payload.san_id,
        ngay=payload.ngay,
        gio_bat_dau=payload.gio_bat_dau,
        gio_ket_thuc=payload.gio_ket_thuc,
    )