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

        MIN_REAL_COLS = 4

        df_raw = xl.parse(sheet_name, header=None, dtype=str)
        header_row = 0

        for i, row in df_raw.iterrows():
            filled = [
                c for c in row
                if pd.notna(c) and str(c).strip() not in ("", "nan")
            ]
            if len(filled) >= MIN_REAL_COLS:
                header_row = i
                break

        # --- Deteksi double-header ---
        # Cek baris tepat setelah header_row: jika >= 2 sel terisi DAN
        # semua isinya kata pendek (<=12 karakter), kemungkinan baris sub-header.
        # Kalau iya, gabungkan parent + sub sebagai nama kolom.
        def _is_subheader_row(row_series) -> bool:
            vals = [str(v).strip() for v in row_series
                    if pd.notna(v) and str(v).strip() not in ("", "nan")]
            return (2 <= len(vals) <= 10 and
                    all(len(v) <= 15 for v in vals))

        next_row_idx = header_row + 1
        use_double = (
            next_row_idx < len(df_raw) and
            _is_subheader_row(df_raw.iloc[next_row_idx])
        )

        if use_double:
            # Baris 1: parent headers (dengan forward-fill untuk merged cells)
            row1 = df_raw.iloc[header_row].tolist()
            row2 = df_raw.iloc[next_row_idx].tolist()

            # Forward-fill parent header (merged cell jadi NaN di kolom berikutnya)
            last_parent = ""
            parent_filled = []
            for v in row1:
                vs = str(v).strip() if pd.notna(v) and str(v).strip() not in ("nan",) else ""
                if vs:
                    last_parent = vs
                else:
                    vs = last_parent   # fill dari parent sebelumnya (merged cell)
                parent_filled.append(vs)

            headers = []
            for p, s in zip(parent_filled, row2):
                ss = str(s).strip() if pd.notna(s) and str(s).strip() not in ("", "nan") else ""
                if ss:
                    headers.append(f"{p} {ss}".strip())
                else:
                    headers.append(p)

            # Baca data mulai dari baris setelah sub-header
            df = xl.parse(sheet_name, header=None, dtype=str,
                          skiprows=list(range(next_row_idx + 1)))
            df.columns = headers[:len(df.columns)]
        else:
            df      = xl.parse(sheet_name, header=header_row, dtype=str)
            headers = [str(c).strip() for c in df.columns.tolist()]

        # Bersihkan nama kolom dari suffix pandas duplikat (.1, .2, ...)
        import re as _re
        headers = [_re.sub(r'\.\d+$', '', h).strip() for h in headers]
        df.columns = headers[:len(df.columns)]

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

    # Buat mapping: excel_col_name -> target_name
    col_map = {m["column_name"]: m["mapped_to"] for m in result.matched}

    def _clean_val(v: str) -> str:
        """Bersihkan nilai: hapus 00:00:00 dari datetime string, strip nan."""
        s = str(v).strip() if not isinstance(v, float) else ""
        if s.lower() in ("nan", "nat", "none", ""):
            return ""
        # Hapus bagian waktu ' 00:00:00' atau 'T00:00:00' jika ada
        import re as _re2
        s = _re2.sub(r'[\sT]00:00:00(\.\d+)?$', '', s).strip()
        return s

    # Ambil isi data per kolom target yang matched
    MAX_ROWS = 1000
    rows = []
    for _, row in df.head(MAX_ROWS).iterrows():
        row_dict = {}
        for excel_col, target_name in col_map.items():
            if excel_col in df.columns:
                val = row[excel_col]
                val_str = "" if (pd.isna(val) if not isinstance(val, str) else False) else _clean_val(val)
                row_dict[target_name] = val_str
        rows.append(row_dict)

    return {
        "message": "File berhasil diproses.",
        "upload_id": upload.id,
        "original_name": file.filename,
        "sheet_name": sheet_name,
        "total_columns": len(headers),
        "status": upload.status,
        "matched": result.matched,
        "missing": result.missing,
        "irrelevant": result.irrelevant,
        "rows": rows,
        # header mapping: target_name -> excel col name asli
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
    Response: { "Police No": ["val1","val2",...], "Certif": [...], ... }
    """
    upload = crud.get_upload_by_id(db, upload_id)
    if not upload:
        raise HTTPException(status_code=404, detail="Upload tidak ditemukan.")

    file_path = os.path.join(UPLOAD_DIR, upload.filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File Excel sudah tidak tersedia di server.")

    try:
        xl = pd.ExcelFile(file_path)
        sheet_name = upload.sheet_name or xl.sheet_names[0]

        MIN_REAL_COLS = 4
        df_raw = xl.parse(sheet_name, header=None, dtype=str)
        header_row = 0
        for i, row in df_raw.iterrows():
            filled = [c for c in row if pd.notna(c) and str(c).strip() not in ("", "nan")]
            if len(filled) >= MIN_REAL_COLS:
                header_row = i
                break

        df = xl.parse(sheet_name, header=header_row, dtype=str)
        df.columns = [str(c).strip() for c in df.columns]

    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Gagal membaca file: {str(e)}")

    # Ambil kolom matched dari DB → { column_name_excel: mapped_to_target }
    matched_cols = {
        c.column_name: c.mapped_to
        for c in upload.columns
        if c.category == "matched"
    }

    preview = {}
    for excel_col, target_name in matched_cols.items():
        if excel_col in df.columns:
            # dtype=str: semua sudah string, bersihkan "nan"/"NaT" dan " 00:00:00"
            import re as _re2
            def _clean(v):
                s = str(v).strip()
                if s.lower() in ("nan", "nat", "none", ""):
                    return ""
                s = _re2.sub(r'[\sT]00:00:00(\.\d+)?$', '', s).strip()
                return s
            values = [_clean(v) for v in df[excel_col].fillna("").astype(str).tolist()]
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


# ============================================================
# Health check
# ============================================================
@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "app": "RU Claim Excel Column Extractor"}
