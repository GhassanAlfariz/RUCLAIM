# RU Claim — Excel Column Extractor

Website untuk mengekstrak dan mendeteksi kolom-kolom penting dari file Excel, khusus untuk kebutuhan data klaim reasuransi.

---

## Fitur

- **Upload Excel** (.xlsx / .xls) dengan drag & drop
- **Deteksi otomatis** 10 kolom target menggunakan regex (toleran terhadap variasi penulisan header)
- **3 kelompok hasil** per file:
  - ✅ Kolom target yang **berhasil diambil**
  - ❌ Kolom target yang **tidak ditemukan** di file
  - 📋 Kolom **tidak relevan** (ada di file tapi bukan target)
- **Riwayat upload** tersimpan di MySQL, bisa dilihat & dihapus kapan saja
- **Detail per upload** dengan progress bar kelengkapan kolom

---

## 10 Kolom Target

| Kolom Target | Contoh Variasi Header yang Terdeteksi |
|---|---|
| Police No | `Policy No`, `No Polis`, `Policy Number` |
| Certif | `Certificate No`, `Certif No`, `No Cert` |
| Claim Insured | `Claim Insured`, `Insured Claim` |
| Start Date | `Start Date`, `Effective Date`, `Inception Date`, `Tgl Mulai` |
| End Date | `End Date`, `Expiry Date`, `Expiration Date`, `Tgl Akhir` |
| MOC | `MOC`, `Mode of Coverage` |
| FACCODE | `FAC Code`, `FacCode`, `Facility Code` |
| COB | `COB`, `Class of Business` |
| Insured | `Insured`, `Insured Name`, `Tertanggung` |
| Cedant | `Cedant`, `Cedant Name`, `Ceding Company` |

---

## Struktur Project

```
WebRUclaim/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py           # FastAPI entry point + endpoints
│   │   ├── database.py       # SQLAlchemy connection
│   │   ├── models.py         # ORM models
│   │   ├── schemas.py        # Pydantic schemas
│   │   ├── crud.py           # Database operations
│   │   └── column_matcher.py # Regex matching logic
│   ├── uploads/              # File Excel yang diupload (auto-created)
│   ├── requirements.txt
│   ├── .env                  # Konfigurasi DB (jangan di-commit!)
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.js     # Axios instance
│   │   │   └── excel.js      # API calls
│   │   ├── components/
│   │   │   ├── Badge.jsx
│   │   │   ├── ColumnGroupCard.jsx
│   │   │   └── StatCard.jsx
│   │   ├── pages/
│   │   │   ├── UploadPage.jsx
│   │   │   ├── HistoryPage.jsx
│   │   │   └── HistoryDetailPage.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
└── database/
    └── schema.sql            # Referensi struktur tabel
```

---

## Setup & Cara Menjalankan

### Prasyarat

- Python 3.10+
- Node.js 18+
- Akses ke MySQL server (`203.145.35.98:3306`, database `reins_import`)

---

### 1. Backend (FastAPI)

```bash
# Masuk ke folder backend
cd backend

# Buat virtual environment
python -m venv venv

# Aktifkan virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Pastikan .env sudah benar (sudah terkonfigurasi)
# DB_HOST=203.145.35.98
# DB_PORT=3306
# DB_NAME=reins_import
# DB_USER=reins_user
# DB_PASSWORD=...

# Jalankan server
uvicorn app.main:app --reload --reload-dir app --port 8080
```

Backend berjalan di: `http://localhost:8080`  
Dokumentasi API (Swagger): `http://localhost:8080/docs`

---

### 2. Frontend (React + Vite)

```bash
# Masuk ke folder frontend
cd frontend

# Install dependencies
npm install

# Jalankan development server
npm run dev
```

Frontend berjalan di: `http://localhost:5173`

---

### 3. Build Production (Frontend)

```bash
cd frontend
npm run build
# Output ada di frontend/dist/
```

---

## API Endpoints

| Method | Endpoint | Deskripsi |
|---|---|---|
| `POST` | `/upload` | Upload file Excel, deteksi kolom |
| `GET` | `/history` | Daftar semua riwayat upload |
| `GET` | `/history/{id}` | Detail satu riwayat + 3 kelompok kolom |
| `DELETE` | `/history/{id}` | Hapus riwayat upload |
| `GET` | `/` | Health check |

---

## Catatan

- File `.env` **jangan di-commit** ke Git — sudah ada di `.gitignore`
- Folder `uploads/` menyimpan file Excel yang diupload ke server backend
- Kolom target dideteksi menggunakan **regex case-insensitive**, sehingga toleran terhadap perbedaan spasi, underscore, kapital/kecil, dan singkatan
