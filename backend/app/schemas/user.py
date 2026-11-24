from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from app.models.user import UserRole, UserStatus

class UserBase(BaseModel):
    full_name: str
    email: EmailStr
    phone: str
    role: Optional[UserRole] = UserRole.CUSTOMER
    status: Optional[UserStatus] = UserStatus.ACTIVE

class UserCreate(UserBase):
    full_name: str = Field(min_length=2, max_length=100)
    phone: str = Field(pattern=r"^(0[35789][0-9]{8}|\+84[35789][0-9]{8})$")
    password: str = Field(min_length=8, max_length=72)

    @field_validator("full_name", "phone", mode="before")
    @classmethod
    def trim_identity_fields(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("email")
    @classmethod
    def validate_email_length(cls, value: str) -> str:
        if len(value) > 100:
            raise ValueError("Email tối đa 100 ký tự.")
        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if not value.strip() or len(value.encode("utf-8")) > 72:
            raise ValueError("Mật khẩu phải có nội dung và tối đa 72 byte UTF-8.")
        return value

class UserResponse(UserBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
# phần task auth 
class UserLogin(BaseModel):
    account: str  # Nhận email hoặc số điện thoại
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class CurrentUserResponse(UserResponse):
    avatar: str | None = None


class TokenPayload(BaseModel):
    sub: Optional[str] = None
