from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

class ServiceOrderItemBase(BaseModel):
    service_id: int = Field(..., description="ID của dịch vụ (nước, cầu, vợt...)")
    quantity: int = Field(1, gt=0, description="Số lượng đặt (> 0)")

class ServiceOrderItemCreate(ServiceOrderItemBase):
    pass

class ServiceOrderItemResponse(BaseModel):
    id: int
    service_order_id: int
    service_id: int
    service_name: Optional[str] = None
    service_unit: Optional[str] = None
    quantity: int
    unit_price: float
    amount: float

    model_config = ConfigDict(from_attributes=True)

ServiceOrderItemOut = ServiceOrderItemResponse
