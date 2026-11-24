from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from app.db.session import Base  # Đổi đúng đường dẫn Base nếu project bạn đặt tên khác


class CourtMaintenanceBlock(Base):
    __tablename__ = "court_maintenance_blocks"

    id = Column(Integer, primary_key=True, index=True)
    court_id = Column(
        Integer,
        ForeignKey("courts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reason = Column(String(255), nullable=False, default="Bảo trì định kỳ")
    start_at = Column(DateTime, nullable=False)
    end_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)