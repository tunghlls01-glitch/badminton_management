"""Các hằng số quy định về giờ mở cửa, slot đặt sân, trạng thái sân."""
from datetime import time
from enum import Enum


class CourtStatus(str, Enum):
    ACTIVE = "HOẠT ĐỘNG"
    MAINTENANCE = "BẢO TRÌ"


class DayType(str, Enum):
    WEEKDAY = "WEEKDAY"  # Ngày thường (Thứ 2 - Thứ 6)
    WEEKEND = "WEEKEND"  # Cuối tuần (Thứ 7 - Chủ Nhật)


# Giờ mở cửa: 06:00 - 22:00, slot 1 giờ
OPEN_TIME = time(6, 0, 0)
CLOSE_TIME = time(22, 0, 0)
SLOT_DURATION_MINUTES = 60
