from pydantic import BaseModel

class ServiceOrderItemBase(BaseModel):
    service_id: int
    quantity: int = 1
    unit_price: float
    amount: float

class ServiceOrderItemCreate(BaseModel):
    service_id: int
    quantity: int = 1

class ServiceOrderItemResponse(ServiceOrderItemBase):
    id: int
    service_order_id: int

    class Config:
        from_attributes = True

ServiceOrderItemOut = ServiceOrderItemResponse
