-- ============================================================
-- Khởi tạo Database và các Bảng Quản Lý Sân Cầu Lông (RK Badminton)
-- ============================================================
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

-- 2. Bảng Users (Người dùng / Khách hàng / Nhân viên / Admin)
CREATE TABLE IF NOT EXISTS users (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  full_name       VARCHAR(100) NOT NULL,
  email           VARCHAR(100) NOT NULL UNIQUE,
  phone           VARCHAR(15) NOT NULL UNIQUE,
  hashed_password VARCHAR(255) NOT NULL DEFAULT '',
  role            ENUM('ADMIN', 'STAFF', 'CUSTOMER') NOT NULL DEFAULT 'CUSTOMER',
  status          ENUM('ACTIVE', 'LOCKED') NOT NULL DEFAULT 'ACTIVE',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Bảng Courts (Sân cầu lông)
CREATE TABLE IF NOT EXISTS courts (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50) NOT NULL,
  description VARCHAR(255) NULL,
  status      ENUM('Active', 'Maintenance', 'Inactive') NOT NULL DEFAULT 'Active',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Bảng Price_Rules (Bảng giá theo khung giờ & thứ trong tuần)
CREATE TABLE IF NOT EXISTS price_rules (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  court_id       INT NOT NULL,
  day_of_week    TINYINT NOT NULL, -- 1: Thứ 2 ... 7: CN
  start_time     TIME NOT NULL,
  end_time       TIME NOT NULL,
  price_per_hour DECIMAL(10, 2) NOT NULL,
  status         ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  FOREIGN KEY (court_id) REFERENCES courts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Bảng Court_Blocks (Khóa sân để bảo trì / sự kiện)
CREATE TABLE IF NOT EXISTS court_blocks (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  court_id   INT NOT NULL,
  created_by INT NOT NULL,
  start_at   DATETIME NOT NULL,
  end_at     DATETIME NOT NULL,
  reason     VARCHAR(255) NULL,
  status     ENUM('Active', 'Cancelled') NOT NULL DEFAULT 'Active',
  FOREIGN KEY (court_id) REFERENCES courts(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Bảng Bookings (Đơn đặt sân)
CREATE TABLE IF NOT EXISTS bookings (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  booking_code    VARCHAR(30) UNIQUE NOT NULL,
  user_id         INT NOT NULL,
  created_by      INT NULL,
  booking_channel ENUM('Online', 'Counter', 'Admin') NOT NULL DEFAULT 'Counter',
  total_price     DECIMAL(10, 2) NOT NULL DEFAULT 0,
  status          ENUM('Pending', 'Confirmed', 'Completed', 'Cancelled', 'Expired') NOT NULL DEFAULT 'Pending',
  note            VARCHAR(255) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Bảng Booking_Slots (Chi tiết slot giờ đặt của từng sân)
CREATE TABLE IF NOT EXISTS booking_slots (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  booking_id       INT NOT NULL,
  court_id         INT NOT NULL,
  start_at         DATETIME NOT NULL,
  end_at           DATETIME NOT NULL,
  duration_minutes INT NOT NULL,
  price_per_hour   DECIMAL(10, 2) NOT NULL,
  amount           DECIMAL(10, 2) NOT NULL,
  status           ENUM('Active', 'Cancelled') NOT NULL DEFAULT 'Active',
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (court_id) REFERENCES courts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Bảng Payments (Thanh toán)
CREATE TABLE IF NOT EXISTS payments (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  booking_id       INT NULL,
  service_order_id INT NULL,
  amount           DECIMAL(12, 2) NOT NULL,
  payment_method   VARCHAR(20) NOT NULL DEFAULT 'CASH',
  payment_status   VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
  transaction_code VARCHAR(100) NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_payments_booking_id (booking_id),
  INDEX idx_payments_service_order_id (service_order_id),
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Bảng Invoices (Hóa đơn)
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
  INDEX idx_invoices_customer_id (customer_id),
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Bảng Services (Danh mục nước, thuê vợt, cầu lông, phụ kiện)
CREATE TABLE IF NOT EXISTS services (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  description    VARCHAR(255) NULL,
  unit           VARCHAR(30) NOT NULL,
  price          DECIMAL(10, 2) NOT NULL DEFAULT 0,
  stock_quantity INT NOT NULL DEFAULT 0,
  status         ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Bảng Service_Orders (Đơn gọi dịch vụ theo booking)
CREATE TABLE IF NOT EXISTS service_orders (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  booking_id  INT NOT NULL,
  created_by  INT NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  status      ENUM('Pending', 'Confirmed', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Pending',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Bảng Service_Order_Items (Chi tiết từng dịch vụ trong đơn)
CREATE TABLE IF NOT EXISTS service_order_items (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  service_order_id INT NOT NULL,
  service_id       INT NOT NULL,
  quantity         INT NOT NULL DEFAULT 1,
  unit_price       DECIMAL(10, 2) NOT NULL,
  amount           DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (service_order_id) REFERENCES service_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Bảng Service_Stock_Logs (Nhật ký xuất nhập tồn dịch vụ)
CREATE TABLE IF NOT EXISTS service_stock_logs (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  service_id      INT NOT NULL,
  created_by      INT NOT NULL,
  change_type     ENUM('Import', 'Sale', 'Return', 'Adjustment') NOT NULL,
  quantity_change INT NOT NULL,
  quantity_before INT NOT NULL,
  quantity_after  INT NOT NULL,
  note            VARCHAR(255) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- DỮ LIỆU MẪU BAN ĐẦU
-- ============================================================
INSERT INTO items (name, description, price) VALUES
  ('Cơm rang dưa bò', 'Món mẫu để kiểm tra API', 45000),
  ('Trà đá', 'Dữ liệu mẫu số 2', 5000);

INSERT IGNORE INTO users (id, full_name, email, phone, hashed_password, role, status) VALUES
  (1, 'Khách vãng lai', 'khach@gmail.com', '0901234567', '', 'CUSTOMER', 'ACTIVE'),
  (2, 'Minh Anh', 'minhanh@gmail.com', '0987654321', '', 'CUSTOMER', 'ACTIVE'),
  (3, 'Ngô Tiến Khang', 'khang@badminton.com', '0912345678', '', 'STAFF', 'ACTIVE'),
  (4, 'Admin Quản Trị', 'admin@badminton.com', '0999888777', '', 'ADMIN', 'ACTIVE');

INSERT IGNORE INTO courts (id, name, description, status) VALUES
  (1, 'Sân 1', 'Sân tiêu chuẩn thảm PVC', 'Active'),
  (2, 'Sân 2', 'Sân tiêu chuẩn thảm PVC', 'Active'),
  (3, 'Sân 3', 'Sân tiêu chuẩn thảm PVC', 'Active'),
  (4, 'Sân 4', 'Sân tiêu chuẩn thảm PVC', 'Active'),
  (5, 'Sân 5 (VIP)', 'Sân VIP có quạt phun sương & đèn LED chuyên nghiệp', 'Active');

INSERT IGNORE INTO price_rules (id, court_id, day_of_week, start_time, end_time, price_per_hour, status) VALUES
  (1, 1, 1, '05:00:00', '23:00:00', 50000, 'Active'),
  (2, 2, 1, '05:00:00', '23:00:00', 50000, 'Active'),
  (3, 3, 1, '05:00:00', '23:00:00', 50000, 'Active'),
  (4, 4, 1, '05:00:00', '23:00:00', 50000, 'Active'),
  (5, 5, 1, '05:00:00', '23:00:00', 80000, 'Active');

INSERT IGNORE INTO services (id, name, description, unit, price, stock_quantity, status) VALUES
  (1, 'Nước suối Aquafina 500ml', 'Nước uống đóng chai', 'Chai', 10000, 100, 'Active'),
  (2, 'Nước tăng lực Revive', 'Nước bù khoáng thể thao', 'Chai', 15000, 50, 'Active'),
  (3, 'Ống cầu lông Yonex AS-40', 'Cầu lông thi đấu cao cấp', 'Ống', 320000, 20, 'Active'),
  (4, 'Quấn cán vợt VS', 'Quấn cán thấm hút mồ hôi', 'Cái', 20000, 80, 'Active'),
  (5, 'Thuê vợt Yonex Astrox', 'Vợt cầu lông cho mượn/thuê', 'Cây/Giờ', 30000, 10, 'Active');
