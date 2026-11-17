from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User, UserRole, UserStatus
from app.schemas.user import CurrentUserResponse, UserCreate, UserResponse, UserLogin, Token
from app.schemas.profile import PasswordChange
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/change-password")
def change_password(payload: PasswordChange, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    if not verify_password(payload.old_password, current_user.hashed_password):
        raise HTTPException(400, "Mật khẩu cũ không chính xác.")
    current_user.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    return {"message": "Đổi mật khẩu thành công."}


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == user_in.email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email da duoc dang ky trong he thong."
        )

    if db.query(User).filter(User.phone == user_in.phone).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="So dien thoai da duoc dang ky trong he thong."
        )

    hashed_pwd = get_password_hash(user_in.password)
    new_user = User(
        full_name=user_in.full_name,
        email=user_in.email,
        phone=user_in.phone,
        hashed_password=hashed_pwd,
        role=user_in.role if user_in.role else UserRole.CUSTOMER,
        status=user_in.status if user_in.status else UserStatus.ACTIVE,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post("/login", response_model=Token)
def login(login_in: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        (User.email == login_in.account) | (User.phone == login_in.account)
    ).first()

    if not user or not verify_password(login_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tai khoan hoac mat khau khong chinh xac."
        )

    if user.status == UserStatus.LOCKED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tai khoan da bi khoa."
        )

    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=CurrentUserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
