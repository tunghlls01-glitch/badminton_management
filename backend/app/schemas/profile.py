import base64
import binascii
import re
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    full_name: str
    phone: str
    email: str
    avatar: str | None


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    full_name: str = Field(min_length=1, max_length=100)
    phone: str = Field(pattern=r"^(0[35789][0-9]{8}|\+84[35789][0-9]{8})$")
    avatar: str | None = Field(default=None, max_length=1_400_000)

    @field_validator("avatar")
    @classmethod
    def validate_avatar(cls, value):
        if value is None:
            return value
        match = re.fullmatch(r"data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)", value)
        if not match:
            raise ValueError("Avatar phải là ảnh PNG, JPEG hoặc WebP.")
        try:
            content = base64.b64decode(match[2], validate=True)
        except (ValueError, binascii.Error):
            raise ValueError("Dữ liệu avatar không hợp lệ.")
        signatures = {
            "png": content.startswith(b"\x89PNG\r\n\x1a\n"),
            "jpeg": content.startswith(b"\xff\xd8\xff"),
            "webp": content.startswith(b"RIFF") and content[8:12] == b"WEBP",
        }
        if len(content) > 1024 * 1024 or not signatures[match[1]]:
            raise ValueError("Avatar phải là ảnh hợp lệ, tối đa 1 MB.")
        return value


class PasswordChange(BaseModel):
    model_config = ConfigDict(extra="forbid")
    old_password: str = Field(min_length=1, max_length=1024)
    new_password: str = Field(min_length=1, max_length=72)
    confirm_password: str = Field(min_length=1, max_length=72)

    @model_validator(mode="after")
    def validate_passwords(self):
        if not self.new_password.strip():
            raise ValueError("Mật khẩu mới không được để trống.")
        if self.new_password != self.confirm_password:
            raise ValueError("Xác nhận mật khẩu mới không khớp.")
        if len(self.new_password.encode("utf-8")) > 72:
            raise ValueError("Mật khẩu mới tối đa 72 byte UTF-8.")
        return self
