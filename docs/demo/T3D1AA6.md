# T3D1AA6 · Demo ghép nối tài khoản và phân quyền

Nguyễn Anh Tùng 2 · PTIT-K25-001

Phần phụ trách gồm tài khoản, xác thực, phân quyền, hồ sơ, quản lý nhân viên và khách hàng. Luồng đặt sân, POS và thanh toán của nhóm cung cấp dữ liệu để đối chiếu trong lịch sử khách hàng.

## Chuẩn bị

- Chạy backend với MySQL thử nghiệm theo README và mở frontend qua Live Server.
- Tạo tài khoản Admin thử nghiệm, một sân hoạt động và một dịch vụ còn hàng.
- Mở các hồ sơ trình duyệt riêng cho Admin, khách hàng và lễ tân.
- Chọn ca sân có giờ bắt đầu nằm trong khoảng thời gian cho phép check-in khi đến bước lễ tân.

## Kịch bản bảo vệ

1. Dùng Admin tạo nhân viên thử nghiệm. Đăng nhập bằng tài khoản nhân viên và kiểm tra điều hướng dành cho lễ tân.
2. Trên trang khách hàng, đăng ký tài khoản rồi đăng nhập bằng số điện thoại. Sửa họ tên trong hồ sơ và tải lại để xác nhận đã lưu.
3. Xác nhận một lượt đặt sân bằng số điện thoại của chính tài khoản khách. Ghi lại mã đặt để tìm tại quầy.
4. Dùng lễ tân tìm mã đặt, check-in, gắn dịch vụ rồi thanh toán. Đối chiếu tổng tiền với tiền sân và tiền dịch vụ trên hóa đơn.
5. Dùng Admin tìm khách theo số điện thoại, mở lịch sử và đối chiếu mã đặt, sân, trạng thái hoàn thành và số tiền thanh toán.
6. Khóa nhân viên trong trang quản trị. Dùng tab lễ tân đang mở để kiểm tra phiên cũ bị từ chối.

## Kiểm tra hồi quy

- Gửi đăng ký với số điện thoại sai định dạng hoặc họ tên chỉ chứa khoảng trắng. API trả HTTP 422 và giữ nguyên dữ liệu tài khoản.
- Đăng nhập từ form bằng email và bằng số điện thoại.
- Dùng tài khoản khách truy cập chức năng quản trị. API trả HTTP 403.

Từ thư mục `backend`, chạy bộ kiểm thử có sẵn:

```powershell
python -m unittest discover -s tests -v
```
