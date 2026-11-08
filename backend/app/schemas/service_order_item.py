"""Schemas (Pydantic models) cho Chi tiết món trong đơn dịch vụ."""
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.service import ServiceOut


class ServiceOrderItemCreate(BaseModel):
    service_id: int
    quantity: int = Field(gt=0, default=1, examples=[2])


class ServiceOrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    service_order_id: int
    service_id: int
    quantity: int
    unit_price: float
    amount: float
    service: ServiceOut | None = None
