"""
SQLAlchemy ORM models — mapping ke tabel MySQL.
"""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, DateTime, Enum, ForeignKey
)
from sqlalchemy.orm import relationship
from app.database import Base


class UploadHistory(Base):
    __tablename__ = "upload_history"

    id            = Column(Integer, primary_key=True, index=True, autoincrement=True)
    filename      = Column(String(255), nullable=False)          # nama unik di server
    original_name = Column(String(255), nullable=False)          # nama asli file user
    uploaded_at   = Column(DateTime, default=datetime.utcnow, nullable=False)
    total_columns = Column(Integer, default=0, nullable=False)
    sheet_name    = Column(String(255), nullable=True)
    status        = Column(
        Enum("success", "partial", "failed"),
        default="success",
        nullable=False,
    )

    columns = relationship(
        "ColumnResult",
        back_populates="upload",
        cascade="all, delete-orphan",
    )


class ColumnResult(Base):
    __tablename__ = "column_results"

    id          = Column(Integer, primary_key=True, index=True, autoincrement=True)
    upload_id   = Column(Integer, ForeignKey("upload_history.id"), nullable=False)
    column_name = Column(String(255), nullable=False)   # nama asli dari Excel
    mapped_to   = Column(String(100), nullable=True)    # nama target jika match
    category    = Column(
        Enum("matched", "missing", "irrelevant"),
        nullable=False,
    )

    upload = relationship("UploadHistory", back_populates="columns")
