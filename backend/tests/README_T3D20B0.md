# T3D20B0 — Hồ sơ cá nhân và đổi mật khẩu

## Chuẩn bị database

- Database mới: chạy `backend/sql/init.sql` như hướng dẫn dự án.
- Database đã có bảng `users`: chạy **một lần** `backend/sql/t3d20b0_profile.sql` trên database đang sử dụng. Nếu DB_NAME khác `app_db`, sửa lệnh USE tương ứng. `create_all()` không tự thêm cột vào bảng cũ.
- Cài lại `backend/requirements.txt` để bảo đảm có `passlib` (hàm hash hiện có đang sử dụng thư viện này).

## API (Bearer token của phiên đăng nhập hiện tại)

- `GET /api/profile`: chỉ trả `full_name`, `phone`, `avatar`, `email`.
- `PUT /api/profile`: gửi `full_name`, `phone`, tùy chọn `avatar`. Không gửi avatar thì giữ nguyên; avatar là data URL ảnh PNG/JPEG/WebP tối đa 1 MB, hoặc null. Trường ngoài phạm vi bị từ chối, gồm email và role. SĐT phải là số di động Việt Nam dạng 10 chữ số hoặc +84, không trùng tài khoản khác.
- `POST /auth/change-password`: gửi `old_password`, `new_password`, `confirm_password`. Dùng prefix `/auth` sẵn có của dự án. Mật khẩu mới không trống, khớp xác nhận, tối đa 72 byte UTF-8 theo giới hạn bcrypt. Kiểm tra hash mật khẩu cũ trong DB và hash mật khẩu mới trước khi lưu.

## Giao diện

Chạy backend và Live Server theo README, đăng nhập rồi mở `frontend/pages/profile.html`. Bấm tên tài khoản trên trang khách hàng hoặc “Hồ sơ cá nhân” trong menu quản trị/lễ tân cũng mở trang này. Trang sử dụng token và axios client hiện có, hiển thị email chỉ đọc, có đúng hai form thông tin cá nhân và đổi mật khẩu.

## Kiểm tra

Trong thư mục `backend`:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Kiểm thử API qua ASGI với SQLite riêng: xác thực, tài khoản khóa, đọc/cập nhật hồ sơ, dữ liệu không hợp lệ, email/quyền chỉ đọc, SĐT trùng, cách ly hai người dùng, xác nhận mật khẩu, mật khẩu cũ sai, hash lưu DB và đăng nhập với mật khẩu mới/cũ.

Kiểm tra giao diện với backend/MySQL: tải hồ sơ, lưu họ tên/SĐT, chọn ảnh rồi tải lại trang, thử SĐT không hợp lệ, thử mật khẩu cũ sai và xác nhận không khớp, đổi thành công rồi đăng nhập bằng mật khẩu mới. Giao diện dùng `textContent`/giá trị input để hiển thị dữ liệu và thông báo.

## Git

Nhánh yêu cầu: `feature/t3d20b0-ho-so-ca-nhan`.

Commit message: `T3D20B0: implement personal profile and password change`.
