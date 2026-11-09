USE app_db;
SET NAMES utf8mb4;

-- Xóa bảng cũ nếu đã tạo lỗi trước đó (để làm sạch schema)
DROP TABLE IF EXISTS booking_slots;
DROP TABLE IF EXISTS bookings;

-- 1. BẢNG bookings (Đơn đặt sân)
CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    booking_type VARCHAR(50) NOT NULL DEFAULT 'VÃNG LAI', -- VÃNG LAI / CỐ ĐỊNH
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'ĐANG GIỮ CHỖ', -- ĐANG GIỮ CHỖ / CHỜ THANH TOÁN / ĐÃ XÁC NHẬN / HOÀN THÀNH / ĐÃ HỦY
    note TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_bookings_customer (customer_id),
    INDEX idx_bookings_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. BẢNG booking_slots (Chi tiết ô giờ & Giữ chỗ tạm 10 phút)
CREATE TABLE IF NOT EXISTS booking_slots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NULL,
    court_id INT NOT NULL,
    held_by_user_id INT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    price DECIMAL(12, 2) NOT NULL DEFAULT 0,
    hold_until DATETIME NULL, -- Cột giữ chỗ tạm 10 phút
    status VARCHAR(50) NOT NULL DEFAULT 'ĐANG GIỮ CHỖ', -- ĐANG GIỮ CHỖ / ĐÃ ĐẶT / ĐÃ KHÓA
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Index tối ưu truy vấn lọc slot bận và hiển thị Lưới Slot
    INDEX idx_court_slot_lookup (court_id, start_time, end_time, hold_until),
    INDEX idx_hold_until (hold_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- SEED 5 DỮ LIỆU MẪU ĐỂ THỰC HIỆN TRUY VẤN
-- =============================================================================

-- Thêm 5 đơn đặt sân mẫu vào bảng bookings
INSERT INTO bookings (id, customer_id, booking_type, total_amount, status, note, created_at) VALUES
(1, 1, 'VÃNG LAI', 120000.00, 'ĐÃ XÁC NHẬN', 'Khách đặt qua web sáng 8/11', '2026-11-08 07:30:00'),
(2, 1, 'VÃNG LAI', 240000.00, 'ĐÃ XÁC NHẬN', 'Đặt 2 tiếng sân VIP tối 8/11', '2026-11-08 15:00:00'),
(3, 2, 'VÃNG LAI', 80000.00,  'ĐANG GIỮ CHỖ', 'Đang giữ chỗ 10 phút chưa thanh toán', '2026-11-08 17:55:00'),
(4, 2, 'CỐ ĐỊNH',  150000.00, 'HOÀN THÀNH', 'Lịch cố định hàng tuần', '2026-11-08 06:00:00'),
(5, 1, 'VÃNG LAI', 80000.00,  'ĐÃ HỦY', 'Khách báo bận hủy lịch', '2026-11-08 09:00:00');

-- Thêm 5 khung giờ mẫu tương ứng vào bảng booking_slots (ngày 2026-11-08)
INSERT INTO booking_slots (id, booking_id, court_id, held_by_user_id, start_time, end_time, price, hold_until, status) VALUES
(1, 1, 1, 1, '2026-11-08 08:00:00', '2026-11-08 09:00:00', 120000.00, NULL, 'ĐÃ ĐẶT'),
(2, 2, 4, 1, '2026-11-08 18:00:00', '2026-11-08 19:00:00', 120000.00, NULL, 'ĐÃ ĐẶT'),
(3, 3, 2, 2, '2026-11-08 19:00:00', '2026-11-08 20:00:00', 80000.00, NOW() + INTERVAL 10 MINUTE, 'ĐANG GIỮ CHỖ'),
(4, NULL, 3, 2, '2026-11-08 10:00:00', '2026-11-08 10:10:00', 80000.00, '2026-11-08 10:10:00', 'ĐANG GIỮ CHỖ'),
(5, 4, 5, 2, '2026-11-08 07:00:00', '2026-11-08 08:00:00', 150000.00, NULL, 'ĐÃ ĐẶT');

SELECT 
    id AS slot_id,
    court_id,
    start_time,
    end_time,
    status,
    held_by_user_id,
    hold_until
FROM booking_slots
WHERE 
    start_time >= '2026-11-08 00:00:00' 
    AND end_time <= '2026-11-08 23:59:59'
    AND (
        status = 'ĐÃ ĐẶT' 
        OR status = 'ĐÃ KHÓA'
        OR (status = 'ĐANG GIỮ CHỖ' AND hold_until > NOW())
    )
ORDER BY court_id ASC, start_time ASC;