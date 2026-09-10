"""
FastAPI entry point — RU Claim Excel Column Extractor API
"""

import os
import re
import uuid
import math
import logging
import traceback
import pandas as pd
import numpy as np
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

# ── Logging: tampilkan ke terminal dengan format jelas ───────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("ruclaim")

from app.database import engine, Base, get_db, check_db_connection, init_db
from app.column_matcher import analyze_columns
from app.schemas import UploadResponseOut, UploadSummaryOut, UploadDetailOut, ColumnResultOut
from app import crud

# Batas ukuran file: 50 MB
MAX_FILE_SIZE = 50 * 1024 * 1024

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ── Startup / shutdown lifecycle ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=== RU Claim API starting up ===")
    ok = init_db()
    if not ok:
        logger.warning(
            "Tabel DB gagal dibuat saat startup. "
            "Endpoint yang butuh DB akan error sampai koneksi pulih."
        )
    else:
        logger.info("Database OK")
    yield
    logger.info("=== RU Claim API shutting down ===")


app = FastAPI(
    title="RU Claim - Excel Column Extractor",
    version="1.0.0",
    description="Upload file Excel, deteksi kolom target, simpan ke riwayat.",
    lifespan=lifespan,
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


# ── Helper: konversi nilai pandas/numpy ke tipe JSON-safe ───────────────────
def _to_json_safe(val):
    """Pastikan nilai bisa di-serialize ke JSON tanpa error."""
    if val is None:
        return None
    if hasattr(val, "isoformat"):        # datetime, date, pd.Timestamp
        return val.isoformat()
    if isinstance(val, float):
        if math.isnan(val) or math.isinf(val):
            return None
        return val
    if isinstance(val, np.integer):      # numpy int8/16/32/64
        return int(val)
    if isinstance(val, np.floating):     # numpy float32/64
        v = float(val)
        return None if (math.isnan(v) or math.isinf(v)) else v
    if isinstance(val, np.bool_):
        return bool(val)
    if hasattr(val, "item"):             # numpy scalar lainnya
        return val.item()
    return val


def _rows_to_safe_list(records: list[dict]) -> list[dict]:
    """Pastikan semua nilai dalam list of dict JSON-serializable."""
    return [
        {k: _to_json_safe(v) for k, v in row.items()}
        for row in records
    ]


def _to_scalar(v):
    """Pastikan v adalah scalar, bukan Series (terjadi saat nama kolom duplikat)."""
    if hasattr(v, "iloc"):
        return v.iloc[0] if len(v) > 0 else ""
    return v


def _clean_val(v) -> str:
    """Bersihkan nilai: hapus 00:00:00, strip nan/NaT."""
    v = _to_scalar(v)
    s = str(v).strip()
    if s.lower() in ("nan", "nat", "none", ""):
        return ""
    s = re.sub(r"[\sT]00:00:00(\.\d+)?$", "", s).strip()
    return s


# ============================================================
# ENDPOINT: Health check + status DB
# ============================================================
@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "app": "RU Claim Excel Column Extractor"}


@app.get("/health", tags=["Health"])
def health_check():
    """Cek status aplikasi dan koneksi database."""
    db_info = check_db_connection()
    return {"app": "ok", "database": db_info}


# ============================================================
# ENDPOINT: Upload Excel
# ============================================================
@app.post("/upload", tags=["Upload"])
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
    logger.info("Upload dimulai: '%s'", file.filename)

    # ── Validasi ekstensi ────────────────────────────────────
    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=400,
            detail="Hanya file .xlsx atau .xls yang diperbolehkan.",
        )

    # ── Baca & validasi ukuran ───────────────────────────────
    contents  = await file.read()
    file_size = len(contents)
    logger.info("Ukuran file: %.2f MB", file_size / (1024 * 1024))

    if file_size == 0:
        raise HTTPException(status_code=400, detail="File kosong.")

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=(
                f"Ukuran file terlalu besar ({file_size / (1024*1024):.1f} MB). "
                f"Maksimum {MAX_FILE_SIZE // (1024*1024)} MB."
            ),
        )

    # ── Simpan file sementara ────────────────────────────────
    unique_name = f"{uuid.uuid4().hex}_{file.filename}"
    file_path   = os.path.join(UPLOAD_DIR, unique_name)
    with open(file_path, "wb") as f:
        f.write(contents)
    del contents    # bebaskan RAM segera
    logger.info("File disimpan: %s", unique_name)

    # ── Baca Excel ───────────────────────────────────────────
    try:
        # Pilih engine sesuai ekstensi, dengan fallback otomatis
        is_xls     = file.filename.lower().endswith(".xls")
        engine_try = "xlrd" if is_xls else "openpyxl"
        engine_fb  = "openpyxl" if is_xls else "xlrd"

        try:
            xl = pd.ExcelFile(file_path, engine=engine_try)
        except Exception as e_try:
            logger.warning("Engine '%s' gagal (%s), coba '%s'", engine_try, e_try, engine_fb)
            try:
                xl = pd.ExcelFile(file_path, engine=engine_fb)
                engine_try = engine_fb
            except Exception as e_fb:
                raise ValueError(
                    f"File tidak bisa dibaca sebagai Excel. "
                    f"Pastikan file tidak corrupt. Detail: {e_fb}"
                )

        sheet_name = xl.sheet_names[0]
        logger.info("Sheet: %s (engine: %s)", xl.sheet_names, engine_try)

        MIN_REAL_COLS = 4

        df_raw = xl.parse(sheet_name, header=None, dtype=str, engine=engine_try)
        header_row = 0

        for i, row in df_raw.iterrows():
            filled = [
                c for c in row
                if pd.notna(c) and str(c).strip() not in ("", "nan")
            ]
            if len(filled) >= MIN_REAL_COLS:
                header_row = i
                break

        # ── Deteksi double-header ────────────────────────────
        def _is_subheader_row(row_series, total_cols: int) -> bool:
            vals = [
                str(v).strip() for v in row_series
                if pd.notna(v) and str(v).strip() not in ("", "nan")
            ]
            if not (2 <= len(vals) <= 5):
                return False
            if not all(len(v) <= 12 for v in vals):
                return False
            fill_ratio = len(vals) / max(total_cols, 1)
            return fill_ratio < 0.3

        next_row_idx = header_row + 1
        total_cols   = len(df_raw.columns)
        use_double   = (
            next_row_idx < len(df_raw) and
            _is_subheader_row(df_raw.iloc[next_row_idx], total_cols)
        )

        if use_double:
            logger.info("Double-header terdeteksi di row %d", next_row_idx)
            row1 = df_raw.iloc[header_row].tolist()
            row2 = df_raw.iloc[next_row_idx].tolist()

            last_parent   = ""
            parent_filled = []
            for v in row1:
                vs = str(v).strip() if pd.notna(v) and str(v).strip() not in ("nan",) else ""
                if vs:
                    last_parent = vs
                else:
                    vs = last_parent
                parent_filled.append(vs)

            headers = []
            for p, s in zip(parent_filled, row2):
                ss = str(s).strip() if pd.notna(s) and str(s).strip() not in ("", "nan") else ""
                headers.append(f"{p} {ss}".strip() if ss else p)

            data_start_row = next_row_idx + 1
            df = xl.parse(
                sheet_name, header=None, dtype=str,
                skiprows=list(range(data_start_row)),
                engine=engine_try,
            )
            df.columns = headers[: len(df.columns)]
        else:
            df      = xl.parse(sheet_name, header=header_row, dtype=str, engine=engine_try)
            headers = [str(c).strip() for c in df.columns.tolist()]

        # Bersihkan suffix pandas duplikat (.1, .2, ...)
        headers    = [re.sub(r"\.\d+$", "", h).strip() for h in headers]
        df.columns = headers[: len(df.columns)]

        logger.info("Kolom: %d | Contoh: %s", len(headers), headers[:5])

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Gagal baca Excel '%s': [%s] %s\n%s",
                     file.filename, type(e).__name__, e, traceback.format_exc())
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=422,
            detail=f"Gagal membaca file Excel: [{type(e).__name__}] {e}",
        )

    # ── Analisis kolom ───────────────────────────────────────
    result = analyze_columns(headers)
    logger.info("Matched: %d | Missing: %s | Irrelevant: %d",
                len(result.matched), result.missing, len(result.irrelevant))

    # ── Simpan ke DB ─────────────────────────────────────────
    try:
        upload = crud.save_upload_result(
            db=db,
            original_name=file.filename,
            filename=unique_name,
            sheet_name=sheet_name,
            total_columns=len(headers),
            result=result,
        )
        logger.info("Tersimpan upload_id=%d status=%s", upload.id, upload.status)
    except Exception as e:
        logger.error("Gagal simpan ke DB: [%s] %s\n%s",
                     type(e).__name__, e, traceback.format_exc())
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=500,
            detail=f"Gagal menyimpan ke database: [{type(e).__name__}] {e}",
        )

    # ── Ambil preview data ───────────────────────────────────
    col_map  = {m["column_name"]: m["mapped_to"] for m in result.matched}
    MAX_ROWS = 1000
    rows     = []
    for _, row in df.head(MAX_ROWS).iterrows():
        row_dict = {}
        for excel_col, target_name in col_map.items():
            if excel_col in df.columns:
                row_dict[target_name] = _clean_val(row[excel_col])
        rows.append(row_dict)

    rows = _rows_to_safe_list(rows)
    logger.info("Upload selesai: '%s' -> %d baris", file.filename, len(rows))

    return {
        "message": "File berhasil diproses.",
        "upload_id": upload.id,
        "original_name": file.filename,
        "sheet_name": sheet_name,
        "total_columns": len(headers),
        "total_rows": len(df),
        "preview_rows": len(rows),
        "status": upload.status,
        "matched": result.matched,
        "missing": result.missing,
        "irrelevant": result.irrelevant,
        "rows": rows,
        "col_headers": {m["mapped_to"]: m["column_name"] for m in result.matched},
    }


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
# ENDPOINT: Preview isi data kolom target dari file Excel
# ============================================================
@app.get("/history/{upload_id}/preview", tags=["History"])
def get_column_preview(upload_id: int, db: Session = Depends(get_db)):
    """
    Baca kembali file Excel dan kembalikan isi data (semua baris)
    untuk setiap kolom target yang berhasil di-match.
    """
    upload = crud.get_upload_by_id(db, upload_id)
    if not upload:
        raise HTTPException(status_code=404, detail="Upload tidak ditemukan.")

    file_path = os.path.join(UPLOAD_DIR, upload.filename)
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404,
            detail="File Excel sudah tidak tersedia di server.",
        )

    try:
        xl         = pd.ExcelFile(file_path)
        sheet_name = upload.sheet_name or xl.sheet_names[0]
        df_raw     = xl.parse(sheet_name, header=None, dtype=str)
        header_row = 0
        for i, row in df_raw.iterrows():
            filled = [
                c for c in row
                if pd.notna(c) and str(c).strip() not in ("", "nan")
            ]
            if len(filled) >= 4:
                header_row = i
                break
        df         = xl.parse(sheet_name, header=header_row, dtype=str)
        df.columns = [str(c).strip() for c in df.columns]
    except Exception as e:
        logger.error("Preview gagal baca file id=%d: [%s] %s", upload_id, type(e).__name__, e)
        raise HTTPException(status_code=422, detail=f"Gagal membaca file: {e}")

    matched_cols = {
        c.column_name: c.mapped_to
        for c in upload.columns
        if c.category == "matched"
    }

    preview = {}
    for excel_col, target_name in matched_cols.items():
        if excel_col in df.columns:
            values = [
                _clean_val(v)
                for v in df[excel_col].fillna("").astype(str).tolist()
            ]
            preview[target_name] = {
                "column_name": excel_col,
                "values": values,
            }

    return preview


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
