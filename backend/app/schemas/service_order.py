from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from app.models.service_order import ServiceOrderStatus
from app.schemas.service_order_item import ServiceOrderItemCreate, ServiceOrderItemResponse

class ServiceOrderBase(BaseModel):
    booking_id: Optional[int] = None
    total_price: float = 0.0
    status: Optional[ServiceOrderStatus] = ServiceOrderStatus.PENDING
    note: Optional[str] = None

class ServiceOrderCreate(BaseModel):
    booking_id: Optional[int] = None
    note: Optional[str] = None
    items: List[ServiceOrderItemCreate]

class ServiceOrderStatusUpdate(BaseModel):
    status: ServiceOrderStatus

class ServiceOrderResponse(ServiceOrderBase):
    id: int
    created_at: datetime
    updated_at: datetime
    items: List[ServiceOrderItemResponse] = []

    class Config:
        from_attributes = True

ServiceOrderOut = ServiceOrderResponse
