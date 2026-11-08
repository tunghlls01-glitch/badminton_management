-- ============================================================
-- Khởi tạo Database và 12 Bảng Quản Lý Sân Cầu Lông (RK Badminton)
-- ============================================================
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS app_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE app_db;

-- 0. Bảng Items (Base mẫu)
CREATE TABLE IF NOT EXISTS items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  description TEXT NULL,
  price       DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1. Bảng Users
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  phone         VARCHAR(15) NULL,
  email         VARCHAR(100) NULL,
  password_hash VARCHAR(255) NULL DEFAULT '',
  role          ENUM('Admin', 'Receptionist', 'Customer') NOT NULL DEFAULT 'Customer',
  status        ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Bảng Courts
CREATE TABLE IF NOT EXISTS courts (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50) NOT NULL,
  description VARCHAR(255) NULL,
  status      ENUM('Active', 'Maintenance', 'Inactive') NOT NULL DEFAULT 'Active',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Bảng Price_Rules
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

-- 4. Bảng Court_Blocks
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

-- 5. Bảng Bookings
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

-- 6. Bảng Booking_Slots
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

-- 7. Bảng Payments
CREATE TABLE IF NOT EXISTS payments (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  booking_id       INT NOT NULL,
  amount           DECIMAL(10, 2) NOT NULL,
  payment_method   ENUM('Cash', 'Transfer', 'Momo', 'Card') NOT NULL DEFAULT 'Cash',
  payment_status   ENUM('Unpaid', 'Paid', 'Failed', 'Refunded') NOT NULL DEFAULT 'Unpaid',
  transaction_code VARCHAR(100) NULL,
  payment_date     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Bảng Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  booking_id      INT UNIQUE NOT NULL,
  invoice_number  VARCHAR(50) UNIQUE NOT NULL,
  subtotal        DECIMAL(10, 2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  tax_amount      DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_amount    DECIMAL(10, 2) NOT NULL DEFAULT 0,
  status          ENUM('Draft', 'Issued', 'Cancelled') NOT NULL DEFAULT 'Draft',
  issued_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Bảng Services
CREATE TABLE IF NOT EXISTS services (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  description    VARCHAR(255) NULL,
  unit           VARCHAR(30) NOT NULL,
  price          DECIMAL(10, 2) NOT NULL DEFAULT 0,
  stock_quantity INT NOT NULL DEFAULT 0,
  status         ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Bảng Service_Orders
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

-- 11. Bảng Service_Order_Items
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

-- 12. Bảng Service_Stock_Logs
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
INSERT IGNORE INTO users (id, name, phone, email, role, status) VALUES
  (1, 'Khách vãng lai', '0901234567', 'khach@gmail.com', 'Customer', 'Active'),
  (2, 'Minh Anh', '0987654321', 'minhanh@gmail.com', 'Customer', 'Active'),
  (3, 'Ngô Tiến Khang', '0912345678', 'khang@badminton.com', 'Receptionist', 'Active'),
  (4, 'Admin Quản Trị', '0999888777', 'admin@badminton.com', 'Admin', 'Active');

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
