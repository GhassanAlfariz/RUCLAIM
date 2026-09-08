"""
FastAPI entry point — RU Claim Excel Column Extractor API
"""

import os
import uuid
import pandas as pd
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import engine, Base, get_db
from app.column_matcher import analyze_columns
from app.schemas import UploadResponseOut, UploadSummaryOut, UploadDetailOut, ColumnResultOut
from app import crud

# Buat tabel jika belum ada
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="RU Claim - Excel Column Extractor",
    version="1.0.0",
    description="Upload file Excel, deteksi kolom target, simpan ke riwayat.",
)

# CORS — izinkan frontend dev server (React Vite default port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ============================================================
# ENDPOINT: Upload Excel
# ============================================================
@app.post("/upload", response_model=UploadResponseOut, tags=["Upload"])
async def upload_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload file Excel (.xlsx / .xls).
    - Ekstrak semua header dari sheet pertama.
    - Deteksi kolom target menggunakan regex.
    - Simpan hasil ke database.
    - Return ringkasan matched / missing / irrelevant.
    """
    # Validasi ekstensi
    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=400,
            detail="Hanya file .xlsx atau .xls yang diperbolehkan.",
        )

    # Simpan file sementara
    unique_name = f"{uuid.uuid4().hex}_{file.filename}"
    file_path   = os.path.join(UPLOAD_DIR, unique_name)
    contents    = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    # Baca Excel dengan pandas
    try:
        xl         = pd.ExcelFile(file_path)
        sheet_name = xl.sheet_names[0]

        # --- Auto-detect baris header yang sebenarnya ---
        # Banyak file Excel punya judul/info di baris atas sebelum header kolom.
        # Strategi: scan tiap baris, cari baris pertama yang punya
        # >= MIN_REAL_COLS kolom terisi (non-NaN, non-empty).
        MIN_REAL_COLS = 4   # minimal 4 kolom terisi agar dianggap baris header

        df_raw = xl.parse(sheet_name, header=None)
        header_row = 0  # default fallback

        for i, row in df_raw.iterrows():
            filled = [
                c for c in row
                if pd.notna(c) and str(c).strip() != ""
            ]
            if len(filled) >= MIN_REAL_COLS:
                header_row = i
                break

        # Parse ulang dengan header di baris yang terdeteksi
        df      = xl.parse(sheet_name, header=header_row)
        headers = [str(c).strip() for c in df.columns.tolist()]

    except Exception as e:
        os.remove(file_path)
        raise HTTPException(
            status_code=422,
            detail=f"Gagal membaca file Excel: {str(e)}",
        )

    # Analisis kolom
    result = analyze_columns(headers)

    # Simpan ke DB
    upload = crud.save_upload_result(
        db=db,
        original_name=file.filename,
        filename=unique_name,
        sheet_name=sheet_name,
        total_columns=len(headers),
        result=result,
    )

    return UploadResponseOut(
        message="File berhasil diproses.",
        upload_id=upload.id,
        original_name=file.filename,
        sheet_name=sheet_name,
        total_columns=len(headers),
        status=upload.status,
        matched=result.matched,
        missing=result.missing,
        irrelevant=result.irrelevant,
    )


# ============================================================
# ENDPOINT: Riwayat — daftar semua upload
# ============================================================
@app.get("/history", response_model=list[UploadSummaryOut], tags=["History"])
def get_history(db: Session = Depends(get_db)):
    """Ambil semua riwayat upload (ringkasan, terbaru dulu)."""
    uploads = crud.get_all_uploads(db)
    result  = []
    for u in uploads:
        matched    = [c for c in u.columns if c.category == "matched"]
        missing    = [c for c in u.columns if c.category == "missing"]
        irrelevant = [c for c in u.columns if c.category == "irrelevant"]
        result.append(UploadSummaryOut(
            id=u.id,
            original_name=u.original_name,
            uploaded_at=u.uploaded_at,
            total_columns=u.total_columns,
            sheet_name=u.sheet_name,
            status=u.status,
            matched_count=len(matched),
            missing_count=len(missing),
            irrelevant_count=len(irrelevant),
        ))
    return result


# ============================================================
# ENDPOINT: Detail satu upload
# ============================================================
@app.get("/history/{upload_id}", response_model=UploadDetailOut, tags=["History"])
def get_history_detail(upload_id: int, db: Session = Depends(get_db)):
    """Ambil detail satu upload beserta 3 kelompok kolom."""
    upload = crud.get_upload_by_id(db, upload_id)
    if not upload:
        raise HTTPException(status_code=404, detail="Upload tidak ditemukan.")

    matched    = [ColumnResultOut.from_orm(c) for c in upload.columns if c.category == "matched"]
    missing    = [ColumnResultOut.from_orm(c) for c in upload.columns if c.category == "missing"]
    irrelevant = [ColumnResultOut.from_orm(c) for c in upload.columns if c.category == "irrelevant"]

    return UploadDetailOut(
        id=upload.id,
        filename=upload.filename,
        original_name=upload.original_name,
        uploaded_at=upload.uploaded_at,
        total_columns=upload.total_columns,
        sheet_name=upload.sheet_name,
        status=upload.status,
        matched=matched,
        missing=missing,
        irrelevant=irrelevant,
    )


# ============================================================
# ENDPOINT: Hapus riwayat
# ============================================================
@app.delete("/history/{upload_id}", tags=["History"])
def delete_history(upload_id: int, db: Session = Depends(get_db)):
    """Hapus satu riwayat upload beserta semua data kolomnya."""
    success = crud.delete_upload(db, upload_id)
    if not success:
        raise HTTPException(status_code=404, detail="Upload tidak ditemukan.")
    return {"message": f"Upload #{upload_id} berhasil dihapus."}


# ============================================================
# Health check
# ============================================================
@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "app": "RU Claim Excel Column Extractor"}
