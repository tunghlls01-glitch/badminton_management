from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

# Schema cơ sở (chứa các field chung)
class CourtBase(BaseModel):
    court_name: str = Field(..., max_length=50, example="Sân Cầu Lông A1")
    court_type: Optional[str] = Field(None, max_length=30, example="Sân Thảm Standard")
    status: Optional[str] = Field("HOẠT ĐỘNG", max_length=20, example="HOẠT ĐỘNG")
    description: Optional[str] = Field(None, example="Sân thảm tiêu chuẩn thi đấu")
    image_url: Optional[str] = Field(None, max_length=255, example="https://example.com/court-a1.jpg")

# Schema cho Request tạo mới Sân (POST)
class CourtCreate(CourtBase):
    pass

# Schema cho Request cập nhật Sân (PUT/PATCH)
class CourtUpdate(BaseModel):
    court_name: Optional[str] = Field(None, max_length=50)
    court_type: Optional[str] = Field(None, max_length=30)
    status: Optional[str] = Field(None, max_length=20)
    description: Optional[str] = None
    image_url: Optional[str] = Field(None, max_length=255)

# Schema trả về cho API Response (GET)
class CourtResponse(CourtBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True