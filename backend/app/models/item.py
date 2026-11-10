"""Model Item mẫu của template (dùng để kiểm tra nhanh CRUD)."""
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text, func
from app.db.session import Base

class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(100), nullable=False, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)