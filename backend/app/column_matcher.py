"""
Regex-based column matcher.

Setiap kolom target punya satu atau lebih pola regex yang fleksibel
sehingga variasi penulisan header di Excel (spasi, underscore, titik,
kapital/kecil, singkatan) tetap terdeteksi.
"""

import re
from dataclasses import dataclass, field
from typing import Optional


# ------------------------------------------------------------
# Definisi 10 kolom target beserta pola regex-nya
# ------------------------------------------------------------
TARGET_COLUMNS: list[dict] = [
    {
        "name": "Police No",
        "patterns": [
            r"pol[i]?[cs][ey][\s_\-\.]*no\.?",
            r"pol[i]?[cs][ey][\s_\-\.]*(num|number|#)?",
            r"no[\s_\-\.]*polis",
            r"polis[\s_\-\.]*no",
            r"^no\.?$",                          # kolom bernama "NO." saja
        ],
    },
    {
        "name": "Certif",
        "patterns": [
            r"cert(if(icate)?)?[\s_\-\.]*no\.?",
            r"no[\s_\-\.]*cert",
            r"sertif(ikat)?[\s_\-\.]*no?",
            r"^certif(icate)?$",
        ],
    },
    {
        "name": "Claim Insured",
        "patterns": [
            r"claim[\s_\-\.]*insured",
            r"insured[\s_\-\.]*claim",
            r"nama[\s_\-\.]*tertanggung[\s_\-\.]*klaim",
        ],
    },
    {
        "name": "Start Date",
        "patterns": [
            r"reins(urance)?[\s_\-\.]*period[\s_\-\.]*from",  # REINS PERIOD FROM (double-header)
            r"period[\s_\-\.]*from",                           # PERIOD FROM
            r"start[\s_\-\.]*date",
            r"date[\s_\-\.]*start",
            r"effective[\s_\-\.]*date",
            r"\beff\.?\s*date\b",                # EFF. DATE
            r"tgl[\s_\-\.]*mulai",
            r"tanggal[\s_\-\.]*mulai",
            r"inception[\s_\-\.]*date",
            r"from[\s_\-\.]*date",
            r"^from$",                            # standalone FROM
        ],
    },
    {
        "name": "End Date",
        "patterns": [
            r"reins(urance)?[\s_\-\.]*period[\s_\-\.]*to",    # REINS PERIOD TO (double-header)
            r"period[\s_\-\.]*to",                             # PERIOD TO
            r"end[\s_\-\.]*date",
            r"date[\s_\-\.]*end",
            r"expiry[\s_\-\.]*date",
            r"expiration[\s_\-\.]*date",
            r"tgl[\s_\-\.]*akhir",
            r"tanggal[\s_\-\.]*akhir",
            r"to[\s_\-\.]*date",
            r"due[\s_\-\.]*date",
            r"maturity[\s_\-\.]*date",
            r"closing[\s_\-\.]*date",
            r"^to$",                              # standalone TO
        ],
    },
    {
        "name": "MOC",
        "patterns": [
            r"\bmoc\b",
            r"mode[\s_\-\.]*of[\s_\-\.]*cover(age)?",
            r"method[\s_\-\.]*of[\s_\-\.]*cover(age)?",
            r"\btoc\b",                           # TOC (Type of Cover) — alias MOC
            r"type[\s_\-\.]*of[\s_\-\.]*cover(age)?",
        ],
    },
    {
        "name": "FACCODE",
        "patterns": [
            r"fac[\s_\-\.]*code",
            r"faccode",
            r"facility[\s_\-\.]*code",
            r"kode[\s_\-\.]*fak",
        ],
    },
    {
        "name": "COB",
        "patterns": [
            r"\bcob\b",
            r"class[\s_\-\.]*of[\s_\-\.]*business",
            r"kelas[\s_\-\.]*bisnis",
            r"line[\s_\-\.]*of[\s_\-\.]*business",
            r"\blob\b",
        ],
    },
    {
        "name": "Insured",
        "patterns": [
            r"^insured$",                         # kolom "INSURED" persis
            r"^insured[\s_\-\.]*name$",           # "INSURED NAME" persis
            r"^name[\s_\-\.]*insured$",
            r"^nama[\s_\-\.]*tertanggung$",
            r"^tertanggung$",
            # HINDARI match "SUM INSURED", "TOTAL SUM INSURED", dll
            # hanya match jika "insured" di awal atau setelah spasi/underscore sebagai kata utama
        ],
    },
    {
        "name": "Cedant",
        "patterns": [
            r"\bcedant\b",
            r"cedant[\s_\-\.]*name",
            r"nama[\s_\-\.]*cedant",
            r"penanggung[\s_\-\.]*pertama",
            r"\bceding\b",
            r"ceding[\s_\-\.]*company",
            r"reins(urer)?[\s_\-\.]*name",       # REINS NAME
            r"reinsurer[\s_\-\.]*name",
            r"nama[\s_\-\.]*reins",
            r"^reins(urer)?('?s)?$",             # REINSURER'S
            r"reinsurer.?s",
        ],
    },
]

# Kompilasi semua pola sekali saat import (lebih efisien)
_COMPILED: list[dict] = [
    {
        "name": tc["name"],
        "regexes": [
            re.compile(p, re.IGNORECASE) for p in tc["patterns"]
        ],
    }
    for tc in TARGET_COLUMNS
]

TARGET_NAMES: list[str] = [tc["name"] for tc in TARGET_COLUMNS]


# ------------------------------------------------------------
# Fungsi utama matching
# ------------------------------------------------------------

def _normalize(text: str) -> str:
    """Hapus karakter non-alfanumerik di awal/akhir, strip whitespace."""
    return text.strip()


def match_column(header: str) -> Optional[str]:
    """
    Cocokkan satu header dari Excel ke salah satu kolom target.

    Returns:
        Nama kolom target jika cocok, None jika tidak ada yang cocok.
    """
    normalized = _normalize(header)
    for target in _COMPILED:
        for regex in target["regexes"]:
            if regex.search(normalized):
                return target["name"]
    return None


@dataclass
class MatchResult:
    """Hasil lengkap pencocokan satu file Excel."""
    matched: list[dict]       = field(default_factory=list)
    # [{"column_name": "...", "mapped_to": "..."}]

    missing: list[str]        = field(default_factory=list)
    # nama kolom TARGET yang tidak ditemukan di file

    irrelevant: list[str]     = field(default_factory=list)
    # kolom di file yang bukan kolom target


def analyze_columns(headers: list[str]) -> MatchResult:
    """
    Analisis semua header dari satu sheet Excel.
    Setiap kolom target hanya diambil SATU KALI (match pertama yang ditemukan).

    Args:
        headers: daftar nama kolom dari DataFrame (df.columns.tolist())

    Returns:
        MatchResult berisi matched, missing, irrelevant
    """
    result = MatchResult()
    found_targets: set[str] = set()

    for header in headers:
        if not isinstance(header, str) or not header.strip():
            result.irrelevant.append(str(header))
            continue

        target = match_column(header)
        if target and target not in found_targets:
            # Belum ada yang match ke target ini — ambil
            result.matched.append({
                "column_name": header,
                "mapped_to": target,
            })
            found_targets.add(target)
        else:
            # Sudah ada yang match, atau tidak cocok target manapun
            result.irrelevant.append(header)

    # Kolom target yang tidak ditemukan sama sekali
    result.missing = [t for t in TARGET_NAMES if t not in found_targets]

    return result
