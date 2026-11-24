from sqlalchemy import JSON, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class PublicPricing(Base):
    __tablename__ = "public_pricing"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    revision: Mapped[int]
    rules: Mapped[list[dict]] = mapped_column(JSON)
