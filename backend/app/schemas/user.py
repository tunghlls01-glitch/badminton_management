from datetime import datetime
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.models.user import UserRole, UserStatus

class UserBase(BaseModel):
    full_name: str
    email: EmailStr
    phone: str
    role: Optional[UserRole] = UserRole.CUSTOMER
    status: Optional[UserStatus] = UserStatus.ACTIVE

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True