"""Schemas (Pydantic models) cho Lịch sử biến động tồn kho"""
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

from app.models.service_stock_log import StockChangeType


class ServiceStockLogCreate(BaseModel):
    """Dữ liệu gửi lên khi nhập hàng, xuất kho hoặc điều chỉnh kiểm kê"""
    service_id: int
    created_by: int | None = None
    change_type: StockChangeType = Field(examples=[StockChangeType.IMPORT])
    quantity_change: int = Field(examples=[50], description="Số dương nếu nhập/hoàn trả, số âm nếu xuất/bán")
    note: str | None = Field(default=None, max_length=255, examples=["Nhập hàng đợt đầu tháng"])


class ServiceStockLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    service_id: int
    created_by: int | None
    change_type: StockChangeType
    quantity_change: int
    quantity_before: int
    quantity_after: int
    note: str | None
    created_at: datetime
