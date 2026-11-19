from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy import and_, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload
from app.core.security import get_password_hash, require_roles
from app.db.session import get_db
from app.models.user import User, UserRole, UserStatus
from app.models.booking import Booking, BookingStatus
from app.models.booking_slot import BookingSlot
from app.schemas.user import UserResponse
from app.schemas.admin_users import StaffCreate, StaffUpdate, StatusUpdate

router = APIRouter(prefix="/admin", tags=["Admin users"],
                   dependencies=[Depends(require_roles(UserRole.ADMIN))])


def find_user(db, user_id, role):
    user = db.query(User).filter(User.id == user_id, User.role == role).first()
    if user is None:
        raise HTTPException(404, "Không tìm thấy tài khoản.")
    return user


def search_users(db, role, q):
    query = db.query(User).filter(User.role == role)
    if q and q.strip():
        term = q.strip()
        fields = [User.full_name.contains(term, autoescape=True),
                  User.phone.contains(term, autoescape=True)]
        if role == UserRole.STAFF:
            fields.append(User.email.contains(term, autoescape=True))
        query = query.filter(or_(*fields))
    return query


def commit_user(db, user):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Email hoặc số điện thoại đã được sử dụng.")
    db.refresh(user)
    return user


@router.get("/staff")
def list_staff(q: str | None = Query(None, max_length=100),
               status: UserStatus | None = None,
               page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
               db: Session = Depends(get_db)):
    query = search_users(db, UserRole.STAFF, q)
    active = query.filter(User.status == UserStatus.ACTIVE).count()
    locked = query.filter(User.status == UserStatus.LOCKED).count()
    if status:
        query = query.filter(User.status == status)
    users = query.order_by(User.id).offset((page-1)*limit).limit(limit).all()
    return dict(items=[UserResponse.model_validate(user) for user in users],
                total=query.count(), page=page, limit=limit,
                active_count=active, locked_count=locked)


@router.get("/staff/{user_id}", response_model=UserResponse)
def get_staff(user_id: int = Path(gt=0), db: Session = Depends(get_db)):
    return find_user(db, user_id, UserRole.STAFF)


@router.post("/staff", response_model=UserResponse, status_code=201)
def create_staff(payload: StaffCreate, db: Session = Depends(get_db)):
    user = User(**payload.model_dump(exclude={"password"}),
                hashed_password=get_password_hash(payload.password), role=UserRole.STAFF)
    db.add(user)
    return commit_user(db, user)


@router.put("/staff/{user_id}", response_model=UserResponse)
def update_staff(payload: StaffUpdate, user_id: int = Path(gt=0),
                 db: Session = Depends(get_db)):
    user = find_user(db, user_id, UserRole.STAFF)
    for key, value in payload.model_dump().items():
        setattr(user, key, value)
    return commit_user(db, user)


@router.patch("/staff/{user_id}/status", response_model=UserResponse)
def update_status(payload: StatusUpdate, user_id: int = Path(gt=0),
                  db: Session = Depends(get_db)):
    user = find_user(db, user_id, UserRole.STAFF)
    user.status = payload.status
    return commit_user(db, user)


def customer_rows(db, users):
    ids = [user.id for user in users]
    stats = {}
    if ids:
        stats = {user_id: (count, last) for user_id, count, last in db.query(
            Booking.user_id, func.count(Booking.id), func.max(Booking.created_at)
        ).filter(Booking.user_id.in_(ids)).group_by(Booking.user_id).all()}
    return [dict(**UserResponse.model_validate(user).model_dump(),
                 total_bookings=stats.get(user.id, (0, None))[0],
                 last_booking_at=stats.get(user.id, (0, None))[1]) for user in users]


@router.get("/customers")
def list_customers(q: str | None = Query(None, max_length=100),
                   page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
                   db: Session = Depends(get_db)):
    query = search_users(db, UserRole.CUSTOMER, q)
    users = query.order_by(User.id).offset((page-1)*limit).limit(limit).all()
    return dict(items=customer_rows(db, users), total=query.count(), page=page, limit=limit)


@router.get("/customers/{user_id}")
def get_customer(user_id: int = Path(gt=0), db: Session = Depends(get_db)):
    return customer_rows(db, [find_user(db, user_id, UserRole.CUSTOMER)])[0]


@router.get("/customers/{user_id}/bookings")
def customer_bookings(user_id: int = Path(gt=0),
                      date_from: date | None = None, date_to: date | None = None,
                      status: BookingStatus | None = None,
                      page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
                      db: Session = Depends(get_db)):
    find_user(db, user_id, UserRole.CUSTOMER)
    if date_from and date_to and date_from > date_to:
        raise HTTPException(422, "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.")
    query = db.query(Booking).filter(Booking.user_id == user_id)
    conditions = []
    if date_from:
        conditions.append(func.date(BookingSlot.start_at) >= date_from)
    if date_to:
        conditions.append(func.date(BookingSlot.start_at) <= date_to)
    if conditions:
        query = query.filter(Booking.booking_slots.any(and_(*conditions)))
    if status:
        query = query.filter(Booking.status == status)
    total = query.count()
    bookings = query.options(
        selectinload(Booking.booking_slots).selectinload(BookingSlot.court),
        selectinload(Booking.payments),
    ).order_by(Booking.created_at.desc(), Booking.id.desc()).offset((page-1)*limit).limit(limit).all()
    items = []
    for booking in bookings:
        items.append(dict(
            id=booking.id, booking_code=booking.booking_code,
            total_price=booking.total_price, booking_status=booking.status,
            created_at=booking.created_at,
            slots=[dict(id=slot.id, court_id=slot.court_id, court_name=slot.court.name,
                        play_date=slot.start_at.date(), start_at=slot.start_at,
                        end_at=slot.end_at, amount=slot.amount)
                   for slot in sorted(booking.booking_slots, key=lambda s: (s.start_at, s.id))],
            payments=[dict(id=p.id, amount=p.amount, payment_status=p.payment_status)
                      for p in sorted(booking.payments, key=lambda p: p.id)],
        ))
    return dict(items=items, total=total, page=page, limit=limit)
