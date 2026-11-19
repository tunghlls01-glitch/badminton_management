from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.notification import NotificationType


class NotificationOut(BaseModel):
    id: int
    user_id: int
    booking_id: Optional[int] = None
    type: NotificationType
    title: str
    message: str
    admin_reason: Optional[str] = None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminCancelBookingRequest(BaseModel):
    admin_reason: str  # Bắt buộc - lý do hủy từ admin


class AdminCancelBookingOut(BaseModel):
    booking_id: int
    booking_code: str
    status: str
    refund_percent: int
    refund_amount: float
    policy_message: str
    message: str
    notification_sent: bool
    notification_message: str
