from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.service import ServiceCategory, ServiceStatus


class ServiceBase(BaseModel):
    name: str = Field(..., max_length=150, examples=["Nước suối Aquafina 500ml"])
    category: ServiceCategory = Field(default=ServiceCategory.OTHER, examples=[ServiceCategory.DRINK])
    unit_price: Decimal = Field(..., ge=0, examples=[10000.0])
    stock_quantity: int = Field(default=0, ge=0, examples=[50])
    unit: str = Field(default="chai", max_length=30, examples=["chai"])
    image_url: Optional[str] = Field(default=None, max_length=500)
    description: Optional[str] = Field(default=None)
    status: ServiceStatus = Field(default=ServiceStatus.ACTIVE, examples=[ServiceStatus.ACTIVE])


class ServiceCreate(ServiceBase):
    pass


class ServiceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=150)
    category: Optional[ServiceCategory] = None
    unit_price: Optional[Decimal] = Field(default=None, ge=0)
    stock_quantity: Optional[int] = Field(default=None, ge=0)
    unit: Optional[str] = Field(default=None, max_length=30)
    image_url: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ServiceStatus] = None


class ServiceResponse(ServiceBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime

ServiceOut = ServiceResponse