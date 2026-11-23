"""Seed dữ liệu mẫu đa dạng cho module Báo cáo doanh thu & Thống kê:
- Doanh thu theo ngày/tháng (tiền sân và dịch vụ)
- Tỉ lệ lấp đầy sân và khung giờ
- Booking huỷ và không đến (NO_SHOW)
- Đơn dịch vụ và top dịch vụ bán chạy
Chạy: python app/seeds/seed_analytics_data.py
"""
import os
import random
import sys
from datetime import date, datetime, time, timedelta
from decimal import Decimal

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.db.session import SessionLocal, engine, Base
from app.models.booking import Booking, BookingChannel, BookingStatus
from app.models.booking_slot import BookingSlot, BookingSlotStatus
from app.models.court import Court, CourtStatus
from app.models.invoice import Invoice
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.models.service import Service
from app.models.service_order import ServiceOrder, ServiceOrderStatus
from app.models.service_order_item import ServiceOrderItem
from app.models.user import User, UserRole

def seed_analytics():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Kiểm tra xem đã có booking nào chưa
        existing_count = db.query(Booking).count()
        if existing_count > 10:
            print(f"Database đã có {existing_count} bookings. Bỏ qua seed.")
            return

        # 1. Đảm bảo có users và courts
        customers = db.query(User).filter(User.role == UserRole.CUSTOMER).all()
        if not customers:
            print("Chưa có users. Vui lòng chạy seed_users.py trước!")
            return

        courts = db.query(Court).all()
        if not courts:
            print("Chưa có sân. Vui lòng tạo sân trước!")
            return

        services = db.query(Service).all()
        if not services:
            print("Chưa có dịch vụ. Vui lòng kiểm tra bảng services!")
            return

        staff_members = db.query(User).filter(User.role.in_([UserRole.STAFF, UserRole.ADMIN])).all()

        print(f"Bắt đầu seed dữ liệu với {len(customers)} khách hàng, {len(courts)} sân và {len(services)} dịch vụ...")

        # Danh sách lý do hủy mẫu
        cancel_reasons = [
            "Khách bận việc đột xuất công ty",
            "Thời tiết mưa lớn ngập đường",
            "Thành viên trong nhóm bị chấn thương",
            "Đổi lịch sinh hoạt sang tuần sau",
            "Nhầm lịch đặt",
        ]

        # Khung giờ chơi phổ biến (06:00 đến 22:00)
        # Giờ cao điểm: 17:00 -> 21:00
        # Giờ thường: 06:00 -> 09:00, 14:00 -> 17:00
        # Giờ vắng: 10:00 -> 13:00

        # Khoảng thời gian seed: từ 01/10/2026 đến 19/11/2026 (50 ngày)
        start_date = date(2026, 10, 15)
        end_date = date(2026, 11, 19)
        current_date = start_date

        random.seed(42)  # Để dữ liệu mẫu ổn định và tái lặp được

        booking_counter = 1000
        invoice_counter = 2000

        while current_date <= end_date:
            day_dow = current_date.weekday()
            is_weekend = day_dow >= 5

            # Số lượng lượt đặt trong ngày (cuối tuần đông hơn ngày thường)
            daily_booking_count = random.randint(12, 22) if is_weekend else random.randint(7, 15)

            for _ in range(daily_booking_count):
                booking_counter += 1
                customer = random.choice(customers)
                court = random.choice(courts)
                is_vip = "VIP" in court.name

                # Chọn khung giờ với xác suất giờ cao điểm cao hơn
                peak_chance = random.random()
                if peak_chance < 0.55:
                    slot_hour = random.choice([17, 18, 19, 20, 21])
                elif peak_chance < 0.85:
                    slot_hour = random.choice([6, 7, 8, 15, 16])
                else:
                    slot_hour = random.choice([9, 10, 11, 13, 14])

                slot_start = datetime.combine(current_date, time(slot_hour, 0))
                slot_end = datetime.combine(current_date, time(slot_hour + 1, 0))

                # Giá sân
                if slot_hour >= 17:
                    price_per_hr = Decimal("180000") if is_vip else Decimal("120000")
                else:
                    price_per_hr = Decimal("120000") if is_vip else Decimal("80000")

                slot_amount = price_per_hr

                # Quyết định trạng thái của booking
                status_roll = random.random()
                if current_date < date(2026, 11, 19):
                    if status_roll < 0.78:
                        b_status = BookingStatus.Completed
                    elif status_roll < 0.88:
                        b_status = BookingStatus.Cancelled
                    elif status_roll < 0.95:
                        b_status = BookingStatus.NO_SHOW
                    else:
                        b_status = BookingStatus.Confirmed
                else:
                    # Ngày hôm nay 19/11/2026
                    if slot_hour < 12:
                        b_status = BookingStatus.Completed
                    elif slot_hour < 16:
                        b_status = BookingStatus.CHECKED_IN
                    else:
                        b_status = BookingStatus.Confirmed

                created_dt = slot_start - timedelta(days=random.randint(1, 3), hours=random.randint(1, 8))
                if created_dt > slot_start:
                    created_dt = slot_start - timedelta(hours=3)

                note = None
                if b_status == BookingStatus.Cancelled:
                    note = f"Hủy đặt sân | Lý do: {random.choice(cancel_reasons)}"
                elif b_status == BookingStatus.NO_SHOW:
                    note = "Khách không đến nhận sân và không liên lạc được"

                booking = Booking(
                    booking_code=f"BK{current_date.strftime('%y%m%d')}-{booking_counter:04d}",
                    user_id=customer.id,
                    booking_channel=random.choice([BookingChannel.Online, BookingChannel.Counter]),
                    total_price=slot_amount,
                    status=b_status,
                    note=note,
                    created_at=created_dt,
                    updated_at=created_dt,
                )
                db.add(booking)
                db.flush()

                # Tạo BookingSlot
                b_slot_status = BookingSlotStatus.Cancelled if b_status == BookingStatus.Cancelled else BookingSlotStatus.Active
                bslot = BookingSlot(
                    booking_id=booking.id,
                    court_id=court.id,
                    start_at=slot_start,
                    end_at=slot_end,
                    duration_minutes=60,
                    price_per_hour=price_per_hr,
                    amount=slot_amount,
                    status=b_slot_status,
                )
                db.add(bslot)

                # Nếu là Completed, tạo thêm ServiceOrder (nếu có khách mua đồ) và Invoice, Payment
                if b_status == BookingStatus.Completed:
                    total_svc_amt = Decimal("0.00")

                    # 60% booking có kèm dịch vụ (nước, cầu, thuê vợt)
                    if random.random() < 0.60:
                        svc_order = ServiceOrder(
                            booking_id=booking.id,
                            total_price=Decimal("0.00"),
                            status=ServiceOrderStatus.COMPLETED,
                            note=f"Dịch vụ tại sân {court.name}",
                            created_at=slot_start + timedelta(minutes=10),
                            updated_at=slot_start + timedelta(minutes=45),
                        )
                        db.add(svc_order)
                        db.flush()

                        # Chọn 1-3 dịch vụ ngẫu nhiên
                        chosen_services = random.sample(services, k=random.randint(1, min(3, len(services))))
                        for svc in chosen_services:
                            qty = random.randint(1, 3)
                            u_price = Decimal(str(svc.price))
                            item_amt = u_price * qty
                            total_svc_amt += item_amt

                            item = ServiceOrderItem(
                                service_order_id=svc_order.id,
                                service_id=svc.id,
                                quantity=qty,
                                unit_price=u_price,
                                amount=item_amt,
                            )
                            db.add(item)

                        svc_order.total_price = total_svc_amt

                    # Hóa đơn (Invoice)
                    invoice_counter += 1
                    discount_val = Decimal("0.00")
                    disc_reason = None
                    if random.random() < 0.15:  # 15% khách có voucher giảm giá
                        discount_val = Decimal("20000.00")
                        disc_reason = "Ưu đãi khách hàng thân thiết"

                    grand_total = max(Decimal("0.00"), slot_amount + total_svc_amt - discount_val)
                    assigned_staff = random.choice(staff_members) if staff_members else None
                    invoice = Invoice(
                        invoice_code=f"INV-{current_date.strftime('%Y%m%d')}-{invoice_counter:04d}",
                        booking_id=booking.id,
                        customer_id=customer.id,
                        staff_id=assigned_staff.id if assigned_staff else None,
                        total_court_amount=slot_amount,
                        total_service_amount=total_svc_amt,
                        discount_amount=discount_val,
                        discount_reason=disc_reason,
                        grand_total=grand_total,
                        created_at=slot_end + timedelta(minutes=5),
                    )
                    db.add(invoice)
                    db.flush()

                    # Bản ghi thanh toán (Payment)
                    payment = Payment(
                        booking_id=booking.id,
                        invoice_id=invoice.id,
                        amount=grand_total,
                        payment_method=random.choice([PaymentMethod.CASH, PaymentMethod.BANK_TRANSFER]),
                        payment_status=PaymentStatus.SUCCESS,
                        transaction_code=f"TXN{random.randint(100000, 999999)}",
                        created_at=slot_end + timedelta(minutes=5),
                    )
                    db.add(payment)

            # Mỗi ngày thêm 2-4 đơn dịch vụ bán lẻ (khách vãng lai mua nước/cầu trực tiếp tại quầy)
            retail_count = random.randint(2, 5)
            for _ in range(retail_count):
                retail_svc = random.sample(services, k=random.randint(1, 2))
                retail_order = ServiceOrder(
                    booking_id=None,
                    total_price=Decimal("0.00"),
                    status=ServiceOrderStatus.COMPLETED,
                    note="Khách vãng lai mua tại quầy lễ tân",
                    created_at=datetime.combine(current_date, time(random.randint(8, 20), random.randint(0, 59))),
                )
                db.add(retail_order)
                db.flush()

                r_total = Decimal("0.00")
                for svc in retail_svc:
                    qty = random.randint(1, 4)
                    u_price = Decimal(str(svc.price))
                    amt = u_price * qty
                    r_total += amt
                    db.add(ServiceOrderItem(
                        service_order_id=retail_order.id,
                        service_id=svc.id,
                        quantity=qty,
                        unit_price=u_price,
                        amount=amt,
                    ))
                retail_order.total_price = r_total

            current_date += timedelta(days=1)

        db.commit()
        print("Đã seed thành công dữ liệu mẫu phong phú cho Analytics!")

    except Exception as e:
        db.rollback()
        print(f"Lỗi khi seed dữ liệu: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_analytics()
