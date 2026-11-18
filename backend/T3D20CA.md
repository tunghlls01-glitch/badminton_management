# T3D20CA — Admin quản lý nhân viên và khách hàng

Nguyễn Anh Tùng · hạn 20/11/2026.

## Tích hợp

Nhánh dựa trên origin/develop tại 0a123b6, đã fetch remote ngày 19/11/2026. Đã đối chiếu User, auth/security, Booking, BookingSlot, Payment, crud/booking, reception và menu quản trị. PR đang mở #22 và #23 nhắm main, không được tự merge vào task.

User chưa có username riêng. Tên đăng nhập trong Figma ánh xạ email hoặc SĐT theo /auth/login hiện có. API tìm nhân viên qua full_name/phone/email. Form gửi email làm tên đăng nhập, không gửi username riêng. Vai trò nhân viên luôn do server đặt STAFF. PUT sửa họ tên, email và SĐT, mật khẩu chỉ dùng khi tạo. Đổi trạng thái qua PATCH riêng.

Frontend có trang frontend/pages/admin-users.html, mở từ menu Admin Nhân viên và Khách hàng. Trang nối API thật, hỗ trợ thêm/sửa/khóa/mở khóa, tìm kiếm, phân trang và lịch sử lọc ngày/trạng thái. Logo chung nằm tại frontend/assets/images/logo.svg.

Không cần migration hoặc cấu hình mới. Dùng các bảng và unique constraint email/phone hiện có. Hai file đang sửa trước task (seed_users.py, sql/init.sql) không thuộc commit này.

## Quyền và lỗi

Tất cả route /api/admin cần Authorization Bearer token của ADMIN. 401 khi chưa xác thực, 403 khi sai quyền/tài khoản khóa, 404 khi ID không tồn tại hoặc sai vai trò, 409 khi email/SĐT trùng, 422 khi dữ liệu không hợp lệ.

Khóa nhân viên dùng User.status. /auth/login và get_current_user hiện có đọc trạng thái trong DB, nên token đã phát hành cũng bị chặn khi tài khoản đang khóa. Mở khóa khôi phục truy cập. Không xóa tài khoản hoặc lịch sử.

Đăng ký công khai được cố định CUSTOMER/ACTIVE để client không tự đăng ký Admin rồi gọi API quản trị. Đây là thay đổi tích hợp tại auth.register, giữ response và trường input cũ. Handler 500 chung chỉ trả detail, traceback tiếp tục ghi trong log server.

## Endpoint

| Method | Route | Tham số/body |
|---|---|---|
| GET | /api/admin/staff | q, status ACTIVE/LOCKED, page, limit |
| GET | /api/admin/staff/{id} | ID dương |
| POST | /api/admin/staff | full_name, email, phone, password, status tùy chọn |
| PUT | /api/admin/staff/{id} | full_name, email, phone bắt buộc |
| PATCH | /api/admin/staff/{id}/status | status ACTIVE hoặc LOCKED |
| GET | /api/admin/customers | q theo tên/SĐT, page, limit |
| GET | /api/admin/customers/{id} | ID CUSTOMER |
| GET | /api/admin/customers/{id}/bookings | page, limit, date_from, date_to, status |

page bắt đầu 1, limit mặc định 20 và tối đa 100. q tối đa 100 ký tự, ký tự %/_ được tìm theo nghĩa literal. Tìm kiếm chữ hoa/thường và dấu theo collation database hiện có (init.sql dùng utf8mb4_unicode_ci).

Họ tên 1–100 ký tự sau trim. Email hợp lệ tối đa 100 ký tự, SĐT di động Việt Nam 10 số hoặc +84. Mật khẩu không trống và tối đa 72 byte UTF-8 theo bcrypt hiện có. Trường ngoài allowlist bị từ chối.

Ví dụ POST /api/admin/staff

```json
{"full_name":"Nguyễn Văn A","email":"staff@example.com","phone":"0912345678","password":"Staff-pass-123","status":"ACTIVE"}
```

Response 201 chứa id, full_name, email, phone, role, status, created_at, updated_at. Không chứa mật khẩu/hash.

Danh sách trả dạng

```json
{"items":[],"total":0,"page":1,"limit":20}
```

Danh sách nhân viên bổ sung active_count và locked_count theo q, trước lọc status. Danh sách/chi tiết khách bổ sung total_bookings và last_booking_at (thời điểm tạo lượt đặt gần nhất, null nếu chưa đặt). Thống kê tính từ Booking.user_id, bao gồm lượt đã hủy.

## Lịch sử đặt sân

Booking.user_id là khách đặt sân, created_by là người thao tác, không dùng để tìm lịch sử khách. Đã đối chiếu luồng tạo đặt sân tại crud/booking và invoice tại reception.

Lọc ngày theo ngày bắt đầu chơi của BookingSlot, bao gồm hai ngày biên. Cả hai điều kiện áp dụng trên cùng một slot. Một booking có thể gồm nhiều sân/ca, trả toàn bộ slots của lượt đặt khi ít nhất một slot khớp. Phân trang theo booking, không theo slot.

status nhận Pending, Confirmed, CHECKED_IN, NO_SHOW, Completed, Cancelled, Expired. Sắp xếp created_at giảm dần rồi id giảm dần. Khoảng ngày đảo ngược trả 422.

Mỗi item có id, booking_code, total_price, booking_status, created_at, slots và payments. slots gồm id, court_id, court_name, play_date, start_at, end_at, amount. payments gồm id, amount và payment_status PENDING/SUCCESS/FAILED/REFUNDED từ Payment. Mảng payments rỗng nghĩa chưa có giao dịch được ghi nhận. Không suy diễn trạng thái thanh toán từ trạng thái đặt sân. total_price là tổng tiền của Booking, không cộng dịch vụ/hóa đơn ngoài trường đó.

Các quan hệ được tải bằng selectinload, thống kê khách dùng GROUP BY cho cả trang, tránh N+1. Khách chưa có lịch sử trả items rỗng, total 0. Khách không tồn tại hoặc ID của STAFF/ADMIN trả 404.

## Kiểm thử

Trong backend chạy

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Test dùng ASGI, SQLite riêng, JWT, bcrypt, ORM và router thật. Kiểm tra quyền đọc/ghi, khóa/mở khóa với đăng nhập và token, chống nâng quyền, ID Admin, sửa/tạo/trùng/sai dữ liệu, tìm kiếm/phân trang, lịch sử đúng khách/ngày/trạng thái, khách trống/không tồn tại, dữ liệu response và hồi quy hồ sơ.

Chưa kiểm chứng giao diện quản trị trực tiếp trong trình duyệt, chưa chạy kiểm thử end-to-end với MySQL hoặc các nhánh chưa merge. Đã kiểm tra cú pháp JavaScript, ID HTML và đường dẫn script. SQLite không xác minh collation MySQL cho tìm kiếm tiếng Việt không dấu.
