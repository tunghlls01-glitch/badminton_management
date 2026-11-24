import sys
import os
import bcrypt

# Thêm thư mục backend vào sys.path để Python nhận diện gói 'app'
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../../"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Kiểm tra lại xem dự án của bạn dùng app.database hay app.db.session
# (Nếu project của bạn dùng app.database thì đổi dòng dưới thành: from app.database import SessionLocal, engine, Base)
try:
    from backend.app.database import SessionLocal, engine, Base
except ImportError:
    from app.db.session import SessionLocal, engine, Base

from app.models.user import User, UserRole, UserStatus

def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        if db.query(User).first():
            print("Database đã có dữ liệu users. Bỏ qua seed.")
            return

        users_to_create = []

        # 1. Admin
        users_to_create.append(
            User(
                full_name="Quản Trị Viên Hệ Thống",
                email="admin@badminton.com",
                phone="0901000001",
                hashed_password=hash_password("admin123"),
                role=UserRole.ADMIN,
                status=UserStatus.ACTIVE
            )
        )

        # 2. Staff
        staff_data = [
            ("Lễ Tân Nguyễn Văn A", "staff1@badminton.com", "0902000001"),
            ("Thu Ngân Trần Thị B", "staff2@badminton.com", "0902000002")
        ]
        for name, email, phone in staff_data:
            users_to_create.append(
                User(
                    full_name=name,
                    email=email,
                    phone=phone,
                    hashed_password=hash_password("staff123"),
                    role=UserRole.STAFF,
                    status=UserStatus.ACTIVE
                )
            )

        # 3. Customers
        customer_names = [
            "Lê Hoàng Long", "Phạm Minh Tuấn", "Vũ Quốc Bảo", "Đỗ Trung Hiếu",
            "Nguyễn Tiến Khang", "Trịnh Hoàng Anh", "Đặng Thùy Dung", "Bùi Gia Hưng",
            "Mai Phương Thảo", "Trần Đình Trọng"
        ]
        for i, name in enumerate(customer_names, start=1):
            users_to_create.append(
                User(
                    full_name=name,
                    email=f"customer{i}@gmail.com",
                    phone=f"09830000{i:02d}",
                    hashed_password=hash_password("customer123"),
                    role=UserRole.CUSTOMER,
                    status=UserStatus.ACTIVE if i != 10 else UserStatus.LOCKED
                )
            )

        db.add_all(users_to_create)
        db.commit()
        print(f"Đã seed thành công {len(users_to_create)} users vào MySQL!")

    except Exception as e:
        print(f"Lỗi khi seed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()