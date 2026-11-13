-- ====================================================================
-- SCRIPT KHỞI TẠO BẢNG & SEED 15 DỊCH VỤ MẪU SÂN CẦU LÔNG
-- Hệ thống Quản lý Sân Cầu Lông (Badminton Court Management System)
-- ====================================================================

SET NAMES utf8mb4;
USE app_db;

-- 1. Bảng services
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

-- 3. Bảng service_orders (đơn dịch vụ kèm booking hoặc khách vãng lai)
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

-- 4. Bảng service_order_items (chi tiết món trong đơn)
-- 2. Bảng service_orders
CREATE TABLE IF NOT EXISTS service_orders (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    booking_id     INT NULL,
    created_by     INT NULL,
    total_price    DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    status         ENUM('Pending', 'Confirmed', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Pending',
    note           VARCHAR(255) NULL,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_service_orders_booking (booking_id),
    INDEX idx_service_orders_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Bảng service_order_items
CREATE TABLE IF NOT EXISTS service_order_items (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    service_order_id INT NOT NULL,
    service_id       INT NOT NULL,
    quantity         INT NOT NULL DEFAULT 1,
    unit_price       DECIMAL(12, 2) NOT NULL,
    amount           DECIMAL(12, 2) NOT NULL,
    INDEX idx_soi_order_id (service_order_id),
    INDEX idx_soi_service_id (service_id)
    INDEX idx_soi_order (service_order_id),
    INDEX idx_soi_service (service_id),
    CONSTRAINT fk_soi_order FOREIGN KEY (service_order_id) REFERENCES service_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_soi_service FOREIGN KEY (service_id) REFERENCES services(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Bảng service_stock_logs
CREATE TABLE IF NOT EXISTS service_stock_logs (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    service_id      INT NOT NULL,
    created_by      INT NULL,
    change_type     ENUM('Import', 'Sale', 'Return', 'Adjustment') NOT NULL,
    quantity_change INT NOT NULL,
    quantity_before INT NOT NULL,
    quantity_after  INT NOT NULL,
    note            VARCHAR(255) NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_stock_logs_service (service_id),
    INDEX idx_stock_logs_type (change_type),
    CONSTRAINT fk_stock_logs_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- SEED 15 DỊCH VỤ MẪU
-- ====================================================================
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
  ('Nước khoáng Lavie 500ml', 'NƯỚC', 'Nước khoáng thiên nhiên đóng chai ướp lạnh', 'Chai', 10000.00, 120, 'Active'),
  ('Nước tinh khiết Aquafina 500ml', 'NƯỚC', 'Nước tinh khiết đóng chai ướp lạnh', 'Chai', 10000.00, 100, 'Active'),
  ('Nước tăng lực Red Bull 250ml', 'NƯỚC', 'Nước tăng lực bò húc Thái Lan bổ sung năng lượng', 'Lon', 20000.00, 80, 'Active'),
  ('Nước điện giải Pocari Sweat 500ml', 'NƯỚC', 'Thức uống bù nước và ion khoáng thể thao chuyên dụng', 'Chai', 20000.00, 90, 'Active'),
  ('Nước chanh muối Revive 500ml', 'NƯỚC', 'Nước bù khoáng Isotonic vị chanh muối giải khát', 'Chai', 15000.00, 85, 'Active'),
  ('Trà xanh Không Độ 500ml', 'NƯỚC', 'Trà xanh đóng chai giải nhiệt thanh mát', 'Chai', 15000.00, 60, 'Active'),
  ('Ống cầu lông Yonex Aerosensa 50', 'ỐNG CẦU', 'Ống 12 quả cầu lông cao cấp tiêu chuẩn thi đấu quốc tế', 'Ống', 520000.00, 20, 'Active'),
  ('Ống cầu lông Victor Master No.1', 'ỐNG CẦU', 'Ống 12 quả lông vũ độ bền cao, bay đầm và chuẩn xác', 'Ống', 450000.00, 25, 'Active'),
  ('Ống cầu lông Ba Sao Pro', 'ỐNG CẦU', 'Ống 12 quả cầu lông Ba Sao chất lượng cao tập luyện và thi đấu', 'Ống', 220000.00, 40, 'Active'),
  ('Quả cầu lông lẻ Ba Sao Pro', 'ỐNG CẦU', 'Bán lẻ từng quả cầu lông Ba Sao Pro sử dụng ngay trên sân', 'Quả', 20000.00, 100, 'Active'),
  ('Thuê vợt Yonex Astrox', 'THUÊ VỢT', 'Cho thuê vợt cầu lông Yonex thân dẻo, đầm đầu trợ lực tốt', 'Cây/Lượt', 50000.00, 15, 'Active'),
  ('Thuê vợt Lining Windstorm', 'THUÊ VỢT', 'Cho thuê vợt cầu lông Lining trọng lượng siêu nhẹ, dễ vung thủ', 'Cây/Lượt', 40000.00, 12, 'Active'),
  ('Quấn cán vợt Yonex AC102EX', 'KHÁC', 'Quấn cán cao su non bám tay, thấm hút mồ hôi tối đa', 'Cái', 35000.00, 60, 'Active'),
  ('Tất thi đấu Victor chống trượt', 'KHÁC', 'Tất dệt sợi cotton dày dặn có hạt silicon chống trượt chân', 'Đôi', 45000.00, 30, 'Active'),
  ('Băng cổ tay thấm mồ hôi Yonex', 'KHÁC', 'Băng bảo vệ cổ tay thể thao co giãn êm ái', 'Cái', 30000.00, 25, 'Active');
