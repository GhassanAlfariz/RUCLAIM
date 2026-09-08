"""
CRUD operations — interaksi antara FastAPI dan database MySQL.
"""

from datetime import datetime
from sqlalchemy.orm import Session
from app.models import UploadHistory, ColumnResult
from app.column_matcher import MatchResult


def save_upload_result(
    db: Session,
    original_name: str,
    filename: str,
    sheet_name: str | None,
    total_columns: int,
    result: MatchResult,
) -> UploadHistory:
    """
    Simpan hasil upload + deteksi kolom ke DB dalam satu transaksi.
    """
    # Tentukan status: success jika semua target match, partial jika ada yang missing
    if len(result.missing) == 0:
        status = "success"
    elif len(result.matched) > 0:
        status = "partial"
    else:
        status = "failed"

    # Simpan record upload
    upload = UploadHistory(
        filename=filename,
        original_name=original_name,
        uploaded_at=datetime.utcnow(),
        total_columns=total_columns,
        sheet_name=sheet_name,
        status=status,
    )
    db.add(upload)
    db.flush()  # dapatkan upload.id sebelum commit

    # Simpan kolom matched
    for item in result.matched:
        db.add(ColumnResult(
            upload_id=upload.id,
            column_name=item["column_name"],
            mapped_to=item["mapped_to"],
            category="matched",
        ))

    # Simpan kolom missing (nama target, bukan nama kolom asli)
    for target_name in result.missing:
        db.add(ColumnResult(
            upload_id=upload.id,
            column_name=target_name,
            mapped_to=target_name,
            category="missing",
        ))

    # Simpan kolom irrelevant
    for col in result.irrelevant:
        db.add(ColumnResult(
            upload_id=upload.id,
            column_name=col,
            mapped_to=None,
            category="irrelevant",
        ))

    db.commit()
    db.refresh(upload)
    return upload


def get_all_uploads(db: Session) -> list[UploadHistory]:
    """Ambil semua riwayat upload, terbaru dulu."""
    return (
        db.query(UploadHistory)
        .order_by(UploadHistory.uploaded_at.desc())
        .all()
    )


def get_upload_by_id(db: Session, upload_id: int) -> UploadHistory | None:
    """Ambil satu upload beserta semua kolom-kolomnya."""
    return (
        db.query(UploadHistory)
        .filter(UploadHistory.id == upload_id)
        .first()
    )


def delete_upload(db: Session, upload_id: int) -> bool:
    """Hapus upload + kolom terkait (cascade). Return True jika berhasil."""
    upload = get_upload_by_id(db, upload_id)
    if not upload:
        return False
    db.delete(upload)
    db.commit()
    return True
