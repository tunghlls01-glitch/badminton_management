"""Điểm khởi động của backend.

Chạy:   uvicorn app.main:app --reload
Tài liệu API tự sinh: http://127.0.0.1:8000/docs
"""
import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError

from app import models  # noqa: F401 - import để SQLAlchemy biết các bảng
from app.core.config import settings
from app.db.session import Base, engine
from app.routers import auth, health, items, services
from app.routers import slot
from app.routers import booking
from app.routers import court_management

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Tự tạo các bảng còn thiếu khi server khởi động (bảng đã có thì bỏ qua).
    try:
        Base.metadata.create_all(bind=engine)
        print(f"[DB] Đã kết nối MySQL {settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}")
    except OperationalError as error:
        print("[DB] KHÔNG kết nối được MySQL! Kiểm tra MySQL đã bật chưa và file .env.")
        if "Unknown database" in str(error.orig):
            print("[DB] Chưa có database -> mở MySQL Workbench, chạy file sql/init.sql")
        print(f"[DB] Chi tiết: {error.orig}")
    yield


app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

# Global Exception Handler: in toàn bộ traceback ra terminal và trả về JSON
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    print("\n" + "=" * 60)
    print(f"[ERROR 500] {request.method} {request.url}")
    print(tb)
    print("=" * 60 + "\n")
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal Server Error",
            "error": str(exc),
            "type": type(exc).__name__,
            "traceback": tb,
        },
    )

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Đăng ký các router
app.include_router(health.router, prefix="/api")
app.include_router(items.router, prefix="/api")
app.include_router(booking.router, prefix="/api")
app.include_router(services.router, prefix="/api")
app.include_router(slot.router, prefix="/api/v1")
app.include_router(auth.router)
app.include_router(court_management.router, prefix="/api")

@app.get("/")
def root():
    return {"message": f"{settings.APP_NAME} đang chạy. Xem tài liệu API tại /docs"}
