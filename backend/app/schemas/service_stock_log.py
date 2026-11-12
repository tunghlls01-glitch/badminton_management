from datetime import datetime
from typing import Optional
from pydantic import BaseModel
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

class ServiceStockLogResponse(ServiceStockLogBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Alias
ServiceStockLogOut = ServiceStockLogResponse
