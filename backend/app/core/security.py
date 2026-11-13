import os
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Union

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User, UserRole, UserStatus

SECRET_KEY = os.getenv("SECRET_KEY", "badminton_secret_key_super_secure_2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 ngày

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Dùng HTTPBearer khớp với luồng Swagger UI hiện tại của dự án
# auto_error=False để chủ động trả về lỗi 401 rõ ràng kèm header WWW-Authenticate
security = HTTPBearer(auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Union[timedelta, None] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Không thể xác thực thông tin đăng nhập. Vui lòng cung cấp Bearer Token hợp lệ.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise credentials_exception

    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: Optional[str] = payload.get("sub")
        if user_id is None or not str(user_id).isdigit():
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception

    # Chặn tài khoản bị khóa
    if user.status == UserStatus.LOCKED or user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản của bạn đã bị khóa (LOCKED). Vui lòng liên hệ quản trị viên.",
        )

    return user


def require_roles(*allowed_roles: UserRole):
    """
    Dependency kiểm tra quyền truy cập theo vai trò (ADMIN, STAFF, CUSTOMER).
    Hỗ trợ truyền dạng:
      - require_roles(UserRole.ADMIN, UserRole.STAFF)
      - hoặc require_roles([UserRole.ADMIN, UserRole.STAFF])
    """
    # Cho phép truyền cả list/tuple hoặc các tham số rời rạc
    roles_list: List[UserRole] = []
    for item in allowed_roles:
        if isinstance(item, (list, tuple, set)):
            roles_list.extend(item)
        else:
            roles_list.append(item)

    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles_list:
            allowed_names = [r.value for r in roles_list]
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Bạn không có quyền thực hiện thao tác này. Yêu cầu vai trò: {', '.join(allowed_names)}.",
            )
        return current_user

    return role_checker