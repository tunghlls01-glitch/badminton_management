from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.service import ServiceCategory, ServiceStatus

class ServiceBase(BaseModel):
    name: str
    category: Optional[ServiceCategory] = ServiceCategory.KHAC
    description: Optional[str] = None
    unit: str
    price: float = 0.0
    stock_quantity: int = 0
    status: Optional[ServiceStatus] = ServiceStatus.ACTIVE

class ServiceCreate(ServiceBase):
    pass

class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[ServiceCategory] = None
    description: Optional[str] = None
    unit: Optional[str] = None
    price: Optional[float] = None
    stock_quantity: Optional[int] = None
    status: Optional[ServiceStatus] = None

class ServiceResponse(ServiceBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Alias để dùng đồng thời cả ServiceResponse và ServiceOut
ServiceOut = ServiceResponse
