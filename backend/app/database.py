"""
Database connection & session management menggunakan SQLAlchemy + PyMySQL.
"""

import os
import logging
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

logger = logging.getLogger("ruclaim")

DB_HOST     = os.getenv("DB_HOST", "localhost")
DB_PORT     = os.getenv("DB_PORT", "3306")
DB_NAME     = os.getenv("DB_NAME", "ruclaim_db")
DB_USER     = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

DATABASE_URL = (
    f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    "?charset=utf8mb4"
)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,     # cek koneksi sebelum query
    pool_recycle=3600,      # recycle koneksi tiap 1 jam
    pool_timeout=30,        # timeout tunggu koneksi dari pool
    connect_args={
        "connect_timeout": 10,  # timeout koneksi awal ke MySQL
    },
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency: buka session DB, tutup otomatis setelah request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> dict:
    """
    Cek koneksi ke database.
    Digunakan oleh endpoint /health.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {
            "status": "ok",
            "host": DB_HOST,
            "port": DB_PORT,
            "database": DB_NAME,
        }
    except Exception as e:
        logger.error("DB connection check failed: [%s] %s", type(e).__name__, e)
        return {
            "status": "error",
            "host": DB_HOST,
            "port": DB_PORT,
            "database": DB_NAME,
            "error": f"[{type(e).__name__}] {e}",
        }


def init_db() -> bool:
    """
    Buat tabel jika belum ada.
    Return True jika sukses, False jika gagal.
    Aman dipanggil saat startup — tidak crash app jika DB tidak tersedia.
    """
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified/created OK.")
        return True
    except Exception as e:
        logger.error(
            "Gagal membuat tabel DB: [%s] %s — Host: %s:%s  DB: %s  User: %s",
            type(e).__name__, e,
            DB_HOST, DB_PORT, DB_NAME, DB_USER,
        )
        return False
