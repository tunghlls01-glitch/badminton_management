"""Schemas (Pydantic models) cho Sản phẩm / Dịch vụ"""
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field

from app.models.service import ServiceCategory, ServiceStatus


class ServiceBase(BaseModel):
    name: str = Field(min_length=1, max_length=100, examples=["Nước khoáng Lavie 500ml"])
    category: ServiceCategory = Field(default=ServiceCategory.KHAC, examples=[ServiceCategory.NUOC])
    description: str | None = Field(default=None, max_length=255, examples=["Nước đóng chai ướp lạnh"])
    unit: str = Field(min_length=1, max_length=30, examples=["Chai"])
    price: Decimal = Field(ge=0, examples=[10000.0])
    stock_quantity: int = Field(default=0, ge=0, examples=[100])
    status: ServiceStatus = Field(default=ServiceStatus.ACTIVE, examples=[ServiceStatus.ACTIVE])


class ServiceCreate(ServiceBase):
    """FE gửi lên khi tạo mới dịch vụ/sản phẩm"""
    pass


class ServiceUpdate(BaseModel):
    """FE gửi lên khi chỉnh sửa thông tin dịch vụ"""
    name: str | None = Field(default=None, min_length=1, max_length=100)
    category: ServiceCategory | None = None
    description: str | None = None
    unit: str | None = Field(default=None, min_length=1, max_length=30)
    price: Decimal | None = Field(default=None, ge=0)
    stock_quantity: int | None = Field(default=None, ge=0)
    status: ServiceStatus | None = None


class ServiceOut(ServiceBase):
    """Response trả về cho Frontend"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    price: float
    created_at: datetime
    updated_at: datetime
