from datetime import datetime
from decimal import Decimal
from typing import Optional, Union
from pydantic import BaseModel, Field
from app.models.service import ServiceCategory, ServiceStatus

class ServiceBase(BaseModel):
    name: str = Field(..., max_length=150, examples=["Nước suối Aquafina 500ml"])
    category: Optional[Union[ServiceCategory, str]] = Field(default=ServiceCategory.OTHER)
    unit_price: Decimal = Field(..., gt=0, examples=[10000.0], description="Giá dịch vụ phải lớn hơn 0")
    stock_quantity: int = Field(default=0, ge=0, examples=[50])
    unit: str = Field(default="chai", max_length=30, examples=["chai"])
    image_url: Optional[str] = Field(default=None, max_length=500)
    description: Optional[str] = Field(default=None)
    status: Optional[Union[ServiceStatus, str]] = Field(default=ServiceStatus.ACTIVE)

    @property
    def price(self) -> Decimal:
        return self.unit_price

class ServiceCreate(ServiceBase):
    pass

class ServiceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=150)
    category: Optional[Union[ServiceCategory, str]] = None
    unit_price: Optional[Decimal] = Field(default=None, gt=0, description="Giá dịch vụ phải lớn hơn 0")
    stock_quantity: Optional[int] = Field(default=None, ge=0)
    unit: Optional[str] = Field(default=None, max_length=30)
    image_url: Optional[str] = None
    description: Optional[str] = None
    status: Optional[Union[ServiceStatus, str]] = None

class ServiceResponse(ServiceBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

ServiceOut = ServiceResponse
