from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.service_order import ServiceOrderStatus
from app.schemas.service_order_item import ServiceOrderItemCreate, ServiceOrderItemResponse

class ServiceOrderBase(BaseModel):
    booking_id: Optional[int] = Field(None, description="ID của booking (để trống nếu bán lẻ cho khách vãng lai)")
    note: Optional[str] = Field(None, description="Ghi chú đơn hàng (ví dụ: Nước uống mang vào sân 2)")

class ServiceOrderCreate(ServiceOrderBase):
    items: List[ServiceOrderItemCreate] = Field(..., min_length=1, description="Danh sách các món đặt")

class ServiceOrderAddItem(BaseModel):
    service_id: int = Field(..., description="ID dịch vụ cần thêm")
    quantity: int = Field(1, gt=0, description="Số lượng thêm (> 0)")

class ServiceOrderStatusUpdate(BaseModel):
    status: ServiceOrderStatus

class ServiceOrderResponse(BaseModel):
    id: int
    booking_id: Optional[int] = None
    total_price: float
    status: ServiceOrderStatus
    note: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: List[ServiceOrderItemResponse] = []

    model_config = ConfigDict(from_attributes=True)

ServiceOrderOut = ServiceOrderResponse

class BookingServiceSummary(BaseModel):
    """Schema phục vụ module Thanh toán lấy tổng tiền dịch vụ của một booking."""
    booking_id: int
    total_service_amount: float
    total_orders: int
    orders: List[ServiceOrderResponse] = []
    has_unreturned_rackets: bool = False
    unreturned_rackets_count: int = 0
