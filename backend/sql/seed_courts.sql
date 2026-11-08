-- ========================================================
-- FILE SQL: TẠO BẢNG & SEED DỮ LIỆU SÂN CẦU LÔNG VÀ BẢNG GIÁ
-- ========================================================
USE app_db;
SET NAMES utf8mb4;

-- 1. Bảng courts (Sân cầu lông)
CREATE TABLE IF NOT EXISTS courts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    court_type VARCHAR(100) NOT NULL DEFAULT 'Tiêu chuẩn',
    description TEXT NULL,
    image_url VARCHAR(500) NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'HOẠT ĐỘNG', -- HOẠT ĐỘNG / BẢO TRÌ
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Bảng price_rules (Bảng giá theo khung giờ và loại ngày)
CREATE TABLE IF NOT EXISTS price_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    day_type VARCHAR(50) NOT NULL, -- WEEKDAY / WEEKEND
    court_type VARCHAR(100) NULL,
    price_per_hour DECIMAL(12, 2) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Bảng court_blocks (Khóa sân theo khung giờ / slot)
CREATE TABLE IF NOT EXISTS court_blocks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    court_id INT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    reason VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_court_blocks_court FOREIGN KEY (court_id) REFERENCES courts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================================
-- SEED 6 SÂN VÀ BẢNG GIÁ KHUNG GIỜ 6:00 - 22:00 (SLOT 1 GIỜ)
-- ========================================================

-- Xóa dữ liệu cũ nếu muốn làm mới (tuỳ chọn):
-- DELETE FROM court_blocks;
-- DELETE FROM price_rules;
-- DELETE FROM courts;

-- Seed 6 sân
INSERT INTO courts (name, court_type, description, image_url, status) VALUES
('Sân số 1', 'Tiêu chuẩn', 'Sân thảm tiêu chuẩn thi đấu, ánh sáng chống chói.', 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea', 'HOẠT ĐỘNG'),
('Sân số 2', 'Tiêu chuẩn', 'Sân thảm chất lượng cao, độ bám tốt, thích hợp đánh đơn và đôi.', 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea', 'HOẠT ĐỘNG'),
('Sân số 3', 'Thảm PVC cao cấp', 'Thảm PVC 5 lớp đàn hồi cao, giảm chấn thương khớp gối.', 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea', 'HOẠT ĐỘNG'),
('Sân số 4 (VIP)', 'VIP', 'Sân phòng lạnh riêng biệt, khán đài mini, nước uống miễn phí.', 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea', 'HOẠT ĐỘNG'),
('Sân số 5 (VIP)', 'VIP', 'Sân thi đấu chuyên nghiệp, hệ thống camera xem lại pha bóng.', 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea', 'HOẠT ĐỘNG'),
('Sân số 6', 'Tiêu chuẩn', 'Sân đang thay thảm mới và bảo trì dàn đèn chiếu sáng.', 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea', 'BẢO TRÌ');

-- Seed bảng giá PriceRule (Khung giờ 06:00 - 22:00, slot 1 giờ)
-- Ngày thường (WEEKDAY - Thứ 2 đến Thứ 6):
--   06:00 - 17:00: Giờ thường (80,000 VND / giờ)
--   17:00 - 22:00: Giờ cao điểm (120,000 VND / giờ)
-- Cuối tuần (WEEKEND - Thứ 7 & Chủ Nhật):
--   06:00 - 17:00: Ban ngày (100,000 VND / giờ)
--   17:00 - 22:00: Giờ vàng cuối tuần (150,000 VND / giờ)
INSERT INTO price_rules (start_time, end_time, day_type, court_type, price_per_hour) VALUES
('06:00:00', '17:00:00', 'WEEKDAY', 'Tiêu chuẩn', 80000.00),
('17:00:00', '22:00:00', 'WEEKDAY', 'Tiêu chuẩn', 120000.00),
('06:00:00', '17:00:00', 'WEEKEND', 'Tiêu chuẩn', 100000.00),
('17:00:00', '22:00:00', 'WEEKEND', 'Tiêu chuẩn', 150000.00),
('06:00:00', '17:00:00', 'WEEKDAY', 'VIP', 120000.00),
('17:00:00', '22:00:00', 'WEEKDAY', 'VIP', 180000.00),
('06:00:00', '17:00:00', 'WEEKEND', 'VIP', 150000.00),
('17:00:00', '22:00:00', 'WEEKEND', 'VIP', 220000.00);

-- Seed mẫu 1 lịch khóa sân (CourtBlock) cho Sân 6 đang bảo trì
INSERT INTO court_blocks (court_id, start_time, end_time, reason) VALUES
(6, '2026-11-08 06:00:00', '2026-11-08 22:00:00', 'Bảo trì thay mặt thảm PVC mới');
