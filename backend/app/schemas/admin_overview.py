from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

from app.models.booking import BookingStatus


class OverviewCell(BaseModel):
    start: str
    state: Literal["free", "booked", "hold", "locked"]
    reason: str | None = None
    booking_id: int | None = None


class OverviewCourt(BaseModel):
    id: int
    name: str
    cells: list[OverviewCell]


class OverviewBookingSlot(BaseModel):
    court: str
    start: datetime
    end: datetime


class OverviewBooking(BaseModel):
    id: int
    code: str
    customer: str
    total: Decimal
    status: BookingStatus
    slots: list[OverviewBookingSlot]


class OverviewRevenue(BaseModel):
    date: date
    amount: Decimal


class AdminOverview(BaseModel):
    date: date
    today: date
    revenue: list[OverviewRevenue]
    booked_court_value: Decimal
    booking_count: int
    confirmed_count: int
    courts_in_use: int
    courts_free: int
    open: str
    close: str
    courts: list[OverviewCourt]
    pending_count: int
    next_pending_id: int | None
    checkin_count: int
    next_checkin_id: int | None
    recent: list[OverviewBooking]
