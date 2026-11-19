"""
Thông báo hệ thống gửi đến người dùng.

GET  /api/notifications        → Lấy danh sách thông báo của user hiện tại
POST /api/notifications/{id}/read  → Đánh dấu đã đọc
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.notification import Notification
from app.schemas.notification import NotificationOut

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=List[NotificationOut])
def get_my_notifications(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Lấy tất cả thông báo của user đang đăng nhập, mới nhất trước."""
    notifs = db.scalars(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    ).all()
    return notifs


@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Đếm số thông báo chưa đọc."""
    from sqlalchemy import func
    count = db.scalar(
        select(func.count(Notification.id))
        .where(Notification.user_id == current_user.id, Notification.is_read == 0)
    )
    return {"unread_count": count or 0}


@router.post("/{notification_id}/read")
def mark_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Đánh dấu thông báo là đã đọc."""
    notif = db.get(Notification, notification_id)
    if not notif:
        raise HTTPException(status_code=404, detail="Thông báo không tồn tại")
    if notif.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Không có quyền truy cập thông báo này")
    notif.is_read = True
    db.commit()
    return {"message": "Đã đánh dấu đọc"}


@router.post("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Đánh dấu tất cả thông báo là đã đọc."""
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == 0,
    ).update({"is_read": True})
    db.commit()
    return {"message": "Đã đánh dấu tất cả là đã đọc"}
