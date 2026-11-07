-- Tạo database app_db + bảng items, payments, invoices + dữ liệu mẫu.
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

-- Dữ liệu mẫu kiểm tra
INSERT INTO items (name, description, price) VALUES
  ('Cơm rang dưa bò', 'Món mẫu để kiểm tra API', 45000),
  ('Trà đá', 'Dữ liệu mẫu số 2', 5000);
