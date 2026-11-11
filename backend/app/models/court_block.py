import enum
from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship

from app.db.session import Base


class CourtBlockStatus(str, enum.Enum):
    Active = "Active"
    Cancelled = "Cancelled"


class CourtBlock(Base):
    __tablename__ = "court_blocks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    court_id = Column(Integer, ForeignKey("courts.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, default=1)
    start_at = Column(DateTime, nullable=False)
    end_at = Column(DateTime, nullable=False)
    reason = Column(String(255), nullable=True)
    status = Column(Enum(CourtBlockStatus), default=CourtBlockStatus.Active, server_default="Active", nullable=False)

    # Alias nếu code dùng start_time/end_time
    @property
    def start_time(self):
        return self.start_at

    @start_time.setter
    def start_time(self, val):
        self.start_at = val

    @property
    def end_time(self):
        return self.end_at

    @end_time.setter
    def end_time(self, val):
        self.end_at = val

    court = relationship("Court", back_populates="blocks")
