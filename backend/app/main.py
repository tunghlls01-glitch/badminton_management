"""Điểm khởi động của backend.

Chạy:   uvicorn app.main:app --reload
Tài liệu API tự sinh: http://127.0.0.1:8000/docs
"""
import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app import models  # noqa: F401 - import để SQLAlchemy biết các bảng
from app.core.config import settings
from app.db.session import Base, engine
from app.routers import auth, health, items, reception, service_orders, services, racket_rentals
from app.routers import slot
from app.routers import booking
from app.routers import court_management, price_rule_management
from app.routers import profile, admin_users, analytics, notification

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Tự tạo các bảng còn thiếu khi server khởi động (bảng đã có thì bỏ qua).
    try:
        Base.metadata.create_all(bind=engine)
        print(f"[DB] Đã kết nối MySQL {settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}")
        # Đảm bảo cột status của bảng services hỗ trợ DELETED cho soft delete
        with engine.begin() as conn:
            try:
                conn.execute(text("ALTER TABLE services MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Active'"))
            except Exception:
                pass
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
        },
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        },
    )

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

# Đăng ký các router
app.include_router(health.router, prefix="/api")
app.include_router(items.router, prefix="/api")
app.include_router(booking.router, prefix="/api")
app.include_router(reception.router, prefix="/api")
app.include_router(services.router, prefix="/api")
app.include_router(service_orders.router, prefix="/api")
app.include_router(racket_rentals.router)
app.include_router(slot.router, prefix="/api/v1")
app.include_router(auth.router)
app.include_router(auth.router, prefix="/api")
app.include_router(profile.router, prefix="/api")
app.include_router(admin_users.router, prefix="/api")
app.include_router(court_management.router, prefix="/api")
app.include_router(price_rule_management.router, prefix="/api")
app.include_router(notification.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
@app.get("/")
def root():
    return {"message": f"{settings.APP_NAME} đang chạy. Xem tài liệu API tại /docs"}
