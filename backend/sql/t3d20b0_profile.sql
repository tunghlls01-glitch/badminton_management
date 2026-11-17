-- Chạy một lần trên database hiện có trước khi khởi động phiên bản T3D20B0.
USE app_db;
ALTER TABLE users ADD COLUMN avatar MEDIUMTEXT NULL AFTER phone;
