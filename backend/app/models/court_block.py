import enum
from sqlalchemy import Column, Integer, DateTime, Text, Enum, ForeignKey
from sqlalchemy.orm import relationship

from app.db.session import Base


class CourtBlockReason(str, enum.Enum):
    Maintenance = "Maintenance"
    Event = "Event"
    Other = "Other"


class CourtBlock(Base):
    __tablename__ = "court_blocks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    court_id = Column(Integer, ForeignKey("courts.id", ondelete="CASCADE"), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    reason = Column(Enum(CourtBlockReason), default=CourtBlockReason.Maintenance, nullable=False)
    note = Column(Text, nullable=True)

    court = relationship("Court", back_populates="blocks")
