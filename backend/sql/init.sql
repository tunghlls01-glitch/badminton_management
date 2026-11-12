-- Tạo database app_db + bảng items, users, payments, invoices + dữ liệu mẫu.
-- Cách chạy bằng MySQL Workbench:
--   File > Open SQL Script... > chọn file này > bấm nút tia sét (Execute) > Refresh ô SCHEMAS.
-- Chạy lại nhiều lần không lỗi (đã có thì bỏ qua), chỉ là dữ liệu mẫu sẽ bị thêm lặp.

SET NAMES utf8mb4; -- để tiếng Việt không bị lỗi font

CREATE DATABASE IF NOT EXISTS app_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE app_db;

-- 1. Bảng mẫu items
CREATE TABLE IF NOT EXISTS items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  description TEXT NULL,
  price       DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Bảng users (Người dùng / Khách hàng / Nhân viên / Admin)
CREATE TABLE IF NOT EXISTS users (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  full_name       VARCHAR(100) NOT NULL,
  email           VARCHAR(100) NOT NULL UNIQUE,
  phone           VARCHAR(15) NOT NULL UNIQUE,
  hashed_password VARCHAR(255) NOT NULL,
  role            ENUM('ADMIN', 'STAFF', 'CUSTOMER') NOT NULL DEFAULT 'CUSTOMER',
  status          ENUM('ACTIVE', 'LOCKED') NOT NULL DEFAULT 'ACTIVE',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email),
  INDEX idx_users_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Module Thanh toán
CREATE TABLE IF NOT EXISTS payments (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  booking_id       INT NULL,
  service_order_id INT NULL,
  amount           DECIMAL(12, 2) NOT NULL,
  payment_method   VARCHAR(20) NOT NULL COMMENT 'CASH, BANK_TRANSFER, QR_VNPAY',
  payment_status   VARCHAR(20) NOT NULL DEFAULT 'SUCCESS' COMMENT 'PENDING, SUCCESS, FAILED',
  transaction_code VARCHAR(100) NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_payments_booking_id (booking_id),
  INDEX idx_payments_service_order_id (service_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Module Hóa đơn tổng kết
CREATE TABLE IF NOT EXISTS invoices (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  invoice_code         VARCHAR(30) NOT NULL UNIQUE,
  booking_id           INT NULL,
  customer_id          INT NOT NULL,
  total_court_amount   DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_service_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  grand_total          DECIMAL(12, 2) NOT NULL,
  created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_invoices_booking_id (booking_id),
  INDEX idx_invoices_customer_id (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Module Dịch vụ, Kho hàng và Đơn dịch vụ
CREATE TABLE IF NOT EXISTS services (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  category       ENUM('NƯỚC', 'ỐNG CẦU', 'THUÊ VỢT', 'KHÁC') NOT NULL DEFAULT 'KHÁC',
  description    VARCHAR(255) NULL,
  unit           VARCHAR(30) NOT NULL,
  price          DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  stock_quantity INT NOT NULL DEFAULT 0,
  status         ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_services_category (category),
  INDEX idx_services_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_stock_logs (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  service_id      INT NOT NULL,
  change_type     ENUM('Nhập hàng', 'Bán lẻ', 'Điều chỉnh') NOT NULL,
  quantity_change INT NOT NULL,
  quantity_before INT NOT NULL,
  quantity_after  INT NOT NULL,
  note            VARCHAR(255) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_stock_logs_service_id (service_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_orders (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  booking_id     INT NULL,
  total_price    DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  status         ENUM('PENDING', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  note           VARCHAR(255) NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_service_orders_booking_id (booking_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_order_items (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  service_order_id INT NOT NULL,
  service_id       INT NOT NULL,
  quantity         INT NOT NULL DEFAULT 1,
  unit_price       DECIMAL(12, 2) NOT NULL,
  amount           DECIMAL(12, 2) NOT NULL,
  INDEX idx_soi_order_id (service_order_id),
  INDEX idx_soi_service_id (service_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dữ liệu mẫu 15 dịch vụ sân cầu lông
INSERT INTO services (name, category, description, unit, price, stock_quantity, status) VALUES
  ('Nước khoáng Lavie 500ml', 'NƯỚC', 'Nước khoáng thiên nhiên ướp lạnh', 'Chai', 10000.00, 120, 'Active'),
  ('Nước tinh khiết Aquafina 500ml', 'NƯỚC', 'Nước tinh khiết đóng chai ướp lạnh', 'Chai', 10000.00, 100, 'Active'),
  ('Nước tăng lực Red Bull 250ml', 'NƯỚC', 'Bò húc Thái Lan bổ sung năng lượng', 'Lon', 20000.00, 80, 'Active'),
  ('Nước điện giải Pocari Sweat 500ml', 'NƯỚC', 'Nước bù điện giải thể thao chuyên dụng', 'Chai', 20000.00, 90, 'Active'),
  ('Nước chanh muối Revive 500ml', 'NƯỚC', 'Nước bù khoáng vị chanh muối giải khát', 'Chai', 15000.00, 85, 'Active'),
  ('Trà xanh Không Độ 500ml', 'NƯỚC', 'Trà xanh đóng chai giải nhiệt thanh mát', 'Chai', 15000.00, 60, 'Active'),
  ('Ống cầu lông Yonex Aerosensa 50', 'ỐNG CẦU', 'Ống 12 quả cầu lông tiêu chuẩn thi đấu', 'Ống', 520000.00, 20, 'Active'),
  ('Ống cầu lông Victor Master No.1', 'ỐNG CẦU', 'Ống 12 quả lông vũ độ bền cao, bay đầm', 'Ống', 450000.00, 25, 'Active'),
  ('Ống cầu lông Ba Sao Pro', 'ỐNG CẦU', 'Ống 12 quả cầu lông Ba Sao tập luyện và thi đấu', 'Ống', 220000.00, 40, 'Active'),
  ('Quả cầu lông lẻ Ba Sao Pro', 'ỐNG CẦU', 'Bán lẻ từng quả cầu lông Ba Sao Pro', 'Quả', 20000.00, 100, 'Active'),
  ('Thuê vợt Yonex Astrox', 'THUÊ VỢT', 'Cho thuê vợt Yonex thân dẻo trợ lực tốt', 'Cây/Lượt', 50000.00, 15, 'Active'),
  ('Thuê vợt Lining Windstorm', 'THUÊ VỢT', 'Cho thuê vợt Lining siêu nhẹ, dễ thủ', 'Cây/Lượt', 40000.00, 12, 'Active'),
  ('Quấn cán vợt Yonex AC102EX', 'KHÁC', 'Quấn cán cao su non bám tay, thấm mồ hôi', 'Cái', 35000.00, 60, 'Active'),
  ('Tất thi đấu Victor chống trượt', 'KHÁC', 'Tất sợi cotton có hạt silicon chống trượt', 'Đôi', 45000.00, 30, 'Active'),
  ('Băng cổ tay thấm mồ hôi Yonex', 'KHÁC', 'Băng bảo vệ cổ tay thể thao co giãn êm', 'Cái', 30000.00, 25, 'Active');

-- Dữ liệu mẫu kiểm tra
INSERT INTO items (name, description, price) VALUES
  ('Cơm rang dưa bò', 'Món mẫu để kiểm tra API', 45000),
  ('Trà đá', 'Dữ liệu mẫu số 2', 5000);
