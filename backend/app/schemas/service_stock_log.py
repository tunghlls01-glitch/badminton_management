from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.models.service_stock_log import StockChangeType

class ServiceStockLogBase(BaseModel):
    service_id: int
    change_type: StockChangeType
    quantity_change: int
    quantity_before: int
    quantity_after: int
    note: Optional[str] = None

class ServiceStockLogCreate(BaseModel):
    service_id: int
    change_type: StockChangeType
    quantity_change: int
    note: Optional[str] = None

class StockImportRequest(BaseModel):
    """Dữ liệu gửi lên khi nhập thêm hàng vào kho."""
    quantity: int = Field(..., gt=0, description="Số lượng nhập thêm (phải > 0)")
    note: Optional[str] = Field("Nhập thêm hàng", description="Ghi chú đợt nhập")

class StockAdjustRequest(BaseModel):
    """Dữ liệu gửi lên khi kiểm kê điều chỉnh tồn kho."""
    actual_quantity: int = Field(..., ge=0, description="Số lượng thực tế sau kiểm kê (>= 0)")
    note: str = Field(..., min_length=1, description="Lý do điều chỉnh (bắt buộc)")

class ServiceStockLogResponse(ServiceStockLogBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Alias
ServiceStockLogOut = ServiceStockLogResponse
