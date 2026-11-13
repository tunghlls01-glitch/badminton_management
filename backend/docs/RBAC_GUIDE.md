# Hướng dẫn Phân quyền RBAC (Task T3D1B5C)

Tài liệu hướng dẫn các thành viên trong nhóm gắn xác thực JWT và phân quyền (`get_current_user`, `require_roles`) vào các API Router của dự án **Badminton Management**.

---

## 1. Mã lỗi chuẩn hóa

Hệ thống xử lý tập trung tại `app/core/security.py`:

- **`401 Unauthorized`**:
  - Không truyền header `Authorization: Bearer <token>`
  - Token sai định dạng, hết hạn hoặc sai chữ ký JWT
  - `user_id` trong token không tồn tại trong database
- **`403 Forbidden`**:
  - Tài khoản bị khóa (`user.status == UserStatus.LOCKED`)
  - Vai trò (`user.role`) của tài khoản không nằm trong danh sách được cấp phép truy cập API

---

## 2. Cách import và sử dụng trong Router

Trong file router của bạn (ví dụ `booking.py`, `services.py`, `court_management.py`), import từ `app.core.security` và `app.models.user`:

```python
from fastapi import APIRouter, Depends
from app.core.security import get_current_user, require_roles
from app.models.user import User, UserRole
```

### Trường hợp 1: Chỉ yêu cầu đăng nhập (Mọi Role đang ACTIVE đều dùng được)
Áp dụng cho: Xem thông tin cá nhân (`/auth/me`), xem lịch sử đặt sân của chính mình.

```python
@router.get("/my-history")
def get_my_history(current_user: User = Depends(get_current_user)):
    return {"user_id": current_user.id, "role": current_user.role}
```

---

### Trường hợp 2: Chỉ dành cho Quản trị viên (`ADMIN`)
Áp dụng cho: Thêm/sửa/xóa sân, cấu hình bảng giá (`price_rules`), quản lý danh mục dịch vụ, xem báo cáo doanh thu.

```python
@router.post("/courts")
def create_court(
    admin: User = Depends(require_roles(UserRole.ADMIN))
):
    return {"message": f"Admin {admin.full_name} đã tạo sân mới"}
```
---
### Trường hợp 3: Dùng chung cho Quản trị viên và Nhân viên (`ADMIN` & `STAFF`)
Áp dụng cho: Check-in khách hàng, khóa sân bảo trì (`court_blocks`), tạo đơn dịch vụ tại quầy (`services`), xác nhận thanh toán.

```python
@router.post("/service-orders")
def create_service_order(
    staff: User = Depends(require_roles(UserRole.ADMIN, UserRole.STAFF))
):
    return {"created_by": staff.id}
```
*(Lưu ý: `require_roles` hỗ trợ truyền cả dạng `require_roles(UserRole.ADMIN, UserRole.STAFF)` hoặc truyền list `require_roles([UserRole.ADMIN, UserRole.STAFF])` đều hoạt động như nhau).*

---

### Trường hợp 4: Dành riêng cho Khách hàng (`CUSTOMER`)
Áp dụng cho: Khách tự đặt lịch sân online.

```python
@router.post("/bookings")
def create_booking(
    customer: User = Depends(require_roles(UserRole.CUSTOMER))
):
    return {"customer_id": customer.id}
```
---
## 3. Cách test nhanh trên Swagger UI (`/docs`)

1. Gọi endpoint **`POST /auth/login`** với tài khoản hợp lệ để lấy chuỗi `access_token`.
2. Copy chuỗi `access_token` (không kèm chữ `Bearer`).
3. Bấm nút **Authorize** (biểu tượng ổ khóa ở góc trên bên phải Swagger UI), dán token vào ô **Value** và bấm **Authorize**.
4. Gọi thử các API được phân quyền:
   - Nếu dùng token của `CUSTOMER` gọi vào API yêu cầu `ADMIN` $\rightarrow$ Hệ thống trả về **`403 Forbidden`**.
   - Nếu tài khoản bị đổi `status = 'LOCKED'` trong DB $\rightarrow$ Mọi request tiếp theo sẽ bị chặn ngay với **`403 Forbidden`**.
   - Nếu chưa bấm Authorize (không có token) $\rightarrow$ Hệ thống trả về **`401 Unauthorized`**.