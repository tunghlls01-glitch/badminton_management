from datetime import date, time
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


class PriceRuleBase(BaseModel):
    court_id: int = Field(..., examples=[1], description="ID sân")
    day_of_week: Literal["WEEKDAY", "WEEKEND"] = Field(
        default="WEEKDAY",
        examples=["WEEKDAY"],
        description="Loại ngày: WEEKDAY (Ngày thường T2-T6) hoặc WEEKEND (Cuối tuần T7-CN)",
    )
    start_time: time = Field(..., examples=["06:00:00"], description="Giờ bắt đầu")
    end_time: time = Field(..., examples=["16:00:00"], description="Giờ kết thúc")
    hourly_rate: float = Field(..., gt=0, examples=[80000.0], description="Giá thuê mỗi giờ (VNĐ)")

    @model_validator(mode="after")
    def validate_time_order(self):
        if self.start_time >= self.end_time:
            raise ValueError("Giờ bắt đầu (start_time) phải nhỏ hơn giờ kết thúc (end_time)!")
        return self


class PriceRuleCreate(PriceRuleBase):
    pass


class PriceRuleUpdate(BaseModel):
    day_of_week: Optional[Literal["WEEKDAY", "WEEKEND"]] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    hourly_rate: Optional[float] = Field(default=None, gt=0)


class PriceRuleResponse(PriceRuleBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class TinhTienRequest(BaseModel):
    san_id: int = Field(..., examples=[1], description="ID sân")
    ngay: date = Field(..., examples=["2026-11-14"], description="Ngày đặt sân (YYYY-MM-DD)")
    gio_bat_dau: time = Field(..., examples=["15:00:00"])
    gio_ket_thuc: time = Field(..., examples=["18:00:00"])