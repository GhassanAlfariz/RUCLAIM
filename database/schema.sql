-- ============================================================
-- RU Claim - Excel Column Extractor
-- Database Schema
-- Target DB: reins_import @ 203.145.35.98:3306
-- ============================================================

USE reins_import;

-- ------------------------------------------------------------
-- Table: upload_history
-- Menyimpan setiap file Excel yang pernah diupload
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS upload_history (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    filename        VARCHAR(255)    NOT NULL,
    original_name   VARCHAR(255)    NOT NULL,
    uploaded_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_columns   INT             NOT NULL DEFAULT 0,
    sheet_name      VARCHAR(255)    NULL,
    status          ENUM('success', 'partial', 'failed') NOT NULL DEFAULT 'success'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Table: column_results
-- Menyimpan hasil deteksi kolom untuk setiap upload
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS column_results (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    upload_id       INT             NOT NULL,
    column_name     VARCHAR(255)    NOT NULL,   -- nama kolom asli dari Excel
    mapped_to       VARCHAR(100)    NULL,        -- nama kolom target (jika match)
    category        ENUM(
                        'matched',      -- kolom target yang BERHASIL diambil
                        'missing',      -- kolom target yang TIDAK ditemukan
                        'irrelevant'    -- kolom di Excel yang bukan target
                    ) NOT NULL,
    CONSTRAINT fk_column_upload
        FOREIGN KEY (upload_id) REFERENCES upload_history(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Index untuk query yang sering dipakai
-- ------------------------------------------------------------
CREATE INDEX idx_upload_id       ON column_results (upload_id);
CREATE INDEX idx_category        ON column_results (category);
CREATE INDEX idx_uploaded_at     ON upload_history (uploaded_at);
