from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

# Schema cơ sở (chứa các field chung)
class CourtBase(BaseModel):
    name: Optional[str] = Field(None, max_length=50, example="Sân Cầu Lông A1")
    court_name: Optional[str] = Field(None, max_length=50, example="Sân Cầu Lông A1")
    status: Optional[str] = Field("Active", max_length=20, example="Active")
    description: Optional[str] = Field(None, max_length=255, example="Sân thảm tiêu chuẩn thi đấu")

    def get_name(self) -> str:
        return self.name or self.court_name or "Sân mới"

# Schema cho Request tạo mới Sân (POST)
class CourtCreate(CourtBase):
    pass

# Schema cho Request cập nhật Sân (PUT/PATCH)
class CourtUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=50)
    court_name: Optional[str] = Field(None, max_length=50)
    status: Optional[str] = Field(None, max_length=20)
    description: Optional[str] = Field(None, max_length=255)

# Schema trả về cho API Response (GET)
class CourtResponse(BaseModel):
    id: int
    name: str
    court_name: Optional[str] = None
    status: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    image_url: Optional[str] = None

    class Config:
        from_attributes = True
