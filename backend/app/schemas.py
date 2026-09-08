"""
Pydantic schemas untuk request/response FastAPI.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


# ------------------------------------------------------------------
# Response: satu baris kolom
# ------------------------------------------------------------------
class ColumnResultOut(BaseModel):
    id:          int
    column_name: str
    mapped_to:   Optional[str]
    category:    str   # "matched" | "missing" | "irrelevant"

    class Config:
        from_attributes = True


# ------------------------------------------------------------------
# Response: detail upload (dipakai di endpoint /history/{id})
# ------------------------------------------------------------------
class UploadDetailOut(BaseModel):
    id:            int
    filename:      str
    original_name: str
    uploaded_at:   datetime
    total_columns: int
    sheet_name:    Optional[str]
    status:        str
    matched:       list[ColumnResultOut]
    missing:       list[ColumnResultOut]
    irrelevant:    list[ColumnResultOut]

    class Config:
        from_attributes = True


# ------------------------------------------------------------------
# Response: ringkasan upload (dipakai di list /history)
# ------------------------------------------------------------------
class UploadSummaryOut(BaseModel):
    id:             int
    original_name:  str
    uploaded_at:    datetime
    total_columns:  int
    sheet_name:     Optional[str]
    status:         str
    matched_count:  int
    missing_count:  int
    irrelevant_count: int

    class Config:
        from_attributes = True


# ------------------------------------------------------------------
# Response: hasil upload langsung
# ------------------------------------------------------------------
class UploadResponseOut(BaseModel):
    message:        str
    upload_id:      int
    original_name:  str
    sheet_name:     Optional[str]
    total_columns:  int
    status:         str
    matched:        list[dict]
    missing:        list[str]
    irrelevant:     list[str]
