"""Điểm khởi động của backend.

Chạy:   uvicorn app.main:app --reload
Tài liệu API tự sinh: http://127.0.0.1:8000/docs
"""
import traceback
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from sqlalchemy.exc import OperationalError, SQLAlchemyError

from app import models  # noqa: F401 - import để SQLAlchemy biết các bảng
from app.models import maintenance_block  # noqa: F401 - đăng ký bảng court_maintenance_blocks
from app.core.config import BASE_DIR, settings
from app.crud import court_service
from app.db.session import Base, engine

from app.seeds.seed_courts import seed_courts
from app.routers import auth, health, items, reception, service_orders, services, racket_rentals

from app.routers import slot
from app.routers import booking
from app.routers import court_management, price_rule_management, maintenance_blocks
from app.routers import profile, admin_users, analytics, notification
from app.routers import admin_overview

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Tự tạo các bảng còn thiếu khi server khởi động (bảng đã có thì bỏ qua).
    try:
        Base.metadata.create_all(bind=engine)
        # Keep existing court records when adding support for saved photos.
        with engine.begin() as connection:
            columns = inspect(connection).get_columns("courts")
            if not any(column["name"] == "image_url" for column in columns):
                connection.execute(text("ALTER TABLE courts ADD COLUMN image_url VARCHAR(500) NULL"))
            try:
                connection.execute(text("ALTER TABLE courts MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Active'"))
            except Exception:
                pass
        # create_all() tạo bảng còn thiếu nhưng không thêm cột vào bảng đã tồn tại.
        # Bổ sung cột giữ chỗ một lần khi khởi động nếu database cũ chưa có.
        booking_columns = {
            column["name"] for column in inspect(engine).get_columns("bookings")
        }
        if "hold_expires_at" not in booking_columns:
            with engine.begin() as connection:
                connection.execute(
                    text("ALTER TABLE bookings ADD COLUMN hold_expires_at DATETIME NULL")
                )
            print("[DB] Đã thêm cột bookings.hold_expires_at")
        payment_columns = {
            column["name"] for column in inspect(engine).get_columns("payments")
        }
        if "receipt_path" not in payment_columns:
            with engine.begin() as connection:
                connection.execute(
                    text("ALTER TABLE payments ADD COLUMN receipt_path VARCHAR(255) NULL")
                )
            print("[DB] Đã thêm cột payments.receipt_path")
        added_courts = seed_courts()
        if added_courts:
            print(f"[SEED] Đã thêm {added_courts} sân mẫu vào database")
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

@app.get(court_service.COURT_IMAGE_URL + "/{filename}", include_in_schema=False)
def court_image(filename: str):
    media_type = court_service.IMAGE_TYPES.get(Path(filename).suffix.lower())
    image = court_service.UPLOAD_DIR / filename
    if not media_type or image.name != filename or not image.is_file():
        raise HTTPException(status_code=404, detail="Không tìm thấy ảnh sân.")
    return FileResponse(image, media_type=media_type, headers={"X-Content-Type-Options": "nosniff"})

@app.exception_handler(SQLAlchemyError)
async def database_error(request: Request, exc: SQLAlchemyError):
    print(f"[DB] {request.method} {request.url.path}: {type(exc).__name__}")
    return JSONResponse(status_code=500, content={"detail": "Máy chủ không xử lý được dữ liệu. Vui lòng thử lại."})

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
app.include_router(admin_overview.router, prefix="/api")
app.include_router(court_management.router, prefix="/api")
app.include_router(price_rule_management.router, prefix="/api")
app.include_router(maintenance_blocks.router, prefix="/api")
app.include_router(notification.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")

@app.get("/")
def root():
    return {"message": f"{settings.APP_NAME} đang chạy. Xem tài liệu API tại /docs"}


frontend_dir = BASE_DIR.parent / "frontend"
if frontend_dir.is_dir():
    app.mount("/web", StaticFiles(directory=frontend_dir, html=True), name="frontend")
