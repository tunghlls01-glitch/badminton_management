from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from app.models.user import UserStatus


class StaffUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str = Field(min_length=1, max_length=100)
    phone: str = Field(pattern=r"^(0[35789][0-9]{8}|\+84[35789][0-9]{8})$")
    email: EmailStr = Field(max_length=100)

    @field_validator("full_name", "phone", "email", mode="before")
    @classmethod
    def trim_text(cls, value):
        return value.strip() if isinstance(value, str) else value


class StaffCreate(StaffUpdate):
    password: str = Field(min_length=1, max_length=72)
    status: UserStatus = UserStatus.ACTIVE

    @field_validator("password")
    @classmethod
    def validate_password(cls, value):
        if not value.strip() or len(value.encode("utf-8")) > 72:
            raise ValueError("Mật khẩu không được trống và tối đa 72 byte UTF-8.")
        return value


class StatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: UserStatus
