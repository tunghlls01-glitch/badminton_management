"""Schemas (Pydantic models) cho Đơn đặt dịch vụ"""
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

from app.models.service_order import ServiceOrderStatus
from app.schemas.service_order_item import (
    ServiceOrderItemCreate,
    ServiceOrderItemOut,
)


class ServiceOrderCreate(BaseModel):
    """Tạo đơn dịch vụ (khách đặt tại quầy hoặc gộp cùng lịch đặt sân)"""
    booking_id: int | None = Field(
        default=None,
        description="ID lịch đặt sân nếu đi kèm booking, hoặc None nếu là khách vãng lai mua tại quầy",
    )
    created_by: int | None = Field(default=None, description="ID nhân viên hoặc user tạo đơn")
    note: str | None = Field(default=None, max_length=255, examples=["Khách thanh toán tiền mặt"])
    items: list[ServiceOrderItemCreate] = Field(min_length=1)


class ServiceOrderStatusUpdate(BaseModel):
    status: ServiceOrderStatus = Field(examples=[ServiceOrderStatus.COMPLETED])


class ServiceOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    booking_id: int | None
    created_by: int | None
    total_price: float
    status: ServiceOrderStatus
    note: str | None
    created_at: datetime
    updated_at: datetime
    items: list[ServiceOrderItemOut] = []
