"""
template_matcher.py
====================
Sistem pencocokan template berdasarkan nama sheet dan pola header.

Alur:
1. Tentukan sheet yang dipakai (priority: ALL > SORT BY POLICY > SORT BY NAME >
   SORT BY TSI > semua sheet).
2. Untuk setiap sheet, coba cocokkan ke salah satu TEMPLATE via regex header.
3. Jika cocok, pakai nama kolom dari template (bukan tebak-tebak otomatis).
4. Bersihkan baris sampah (TOTAL, sub-header, baris tipis).
5. Filter file: nama file diawali "T" → skip, KECUALI "TID".
"""

import re
import pandas as pd
from dataclasses import dataclass, field
from typing import Optional

# ──────────────────────────────────────────────────────────────
# 1. DEFINISI TEMPLATE
#    Setiap template punya:
#    - name        : label template (untuk logging/debug)
#    - sheet_hints : nama-nama sheet yang kemungkinan cocok (regex, case-insensitive)
#    - sig_cols    : kolom "penanda" yang HARUS ada di header agar template ini cocok
#                   (dicocokkan dengan regex ke header sheet aktual)
#    - columns     : daftar nama kolom final SETELAH normalisasi
#    - header_rows : berapa baris header? (1 = biasa, 2 = ada sub-header merge)
# ──────────────────────────────────────────────────────────────

@dataclass
class ColumnDef:
    """Satu kolom dalam template."""
    name: str                    # nama kolom yang akan dipakai
    patterns: list[str]          # regex untuk mencocokkan header mentah dari Excel
    sub_row_pattern: str = ""    # jika header 2-baris, regex untuk baris ke-2

    _compiled: list = field(default_factory=list, init=False, repr=False)

    def __post_init__(self):
        self._compiled = [re.compile(p, re.IGNORECASE) for p in self.patterns]
        self._sub_compiled = re.compile(self.sub_row_pattern, re.IGNORECASE) if self.sub_row_pattern else None

    def matches(self, text: str) -> bool:
        t = str(text).strip()
        return any(rx.search(t) for rx in self._compiled)

    def sub_matches(self, text: str) -> bool:
        if not self._sub_compiled:
            return False
        return bool(self._sub_compiled.search(str(text).strip()))


@dataclass
class Template:
    name: str
    sheet_hints: list[str]          # regex patterns untuk nama sheet
    sig_cols: list[str]             # regex patterns — SEMUA harus match agar template dipilih
    columns: list[ColumnDef]
    double_header: bool = False     # True = header ada di 2 baris (merge cell)

    _sheet_rx: list = field(default_factory=list, init=False, repr=False)
    _sig_rx: list   = field(default_factory=list, init=False, repr=False)

    def __post_init__(self):
        self._sheet_rx = [re.compile(p, re.IGNORECASE) for p in self.sheet_hints]
        self._sig_rx   = [re.compile(p, re.IGNORECASE) for p in self.sig_cols]

    def sheet_matches(self, sheet_name: str) -> bool:
        return any(rx.search(sheet_name) for rx in self._sheet_rx)

    def sig_matches(self, headers: list[str]) -> bool:
        """Semua sig_cols harus ditemukan di salah satu header."""
        for rx in self._sig_rx:
            if not any(rx.search(str(h)) for h in headers):
                return False
        return True


# ──────────────────────────────────────────────────────────────
# HELPER: buat ColumnDef dengan satu pattern persis (exact-ish)
# ──────────────────────────────────────────────────────────────
def _c(name: str, *patterns: str, sub: str = "") -> ColumnDef:
    return ColumnDef(name=name, patterns=list(patterns), sub_row_pattern=sub)


# ══════════════════════════════════════════════════════════════
# TEMPLATE DEFINITIONS
# ══════════════════════════════════════════════════════════════

TEMPLATES: list[Template] = []

# ──────────────────────────────────────────────────────────────
# T01 · CPM (VARIOUS) — sheet: ALL
# ──────────────────────────────────────────────────────────────
TEMPLATES.append(Template(
    name="CPM_ALL",
    sheet_hints=[r"^all$"],
    sig_cols=[
        r"ibs[\s_\-\.]*ref",
        r"cdn[\s_\-\.]*no",
        r"direct[\s_\-\.]*client",
    ],
    columns=[
        _c("No.",               r"^no\.?$"),
        _c("IBS Ref.",          r"ibs[\s_\-\.]*ref"),
        _c("CDN No.",           r"cdn[\s_\-\.]*no"),
        _c("Direct Client",     r"direct[\s_\-\.]*client"),
        _c("Type of Risk",      r"type[\s_\-\.]*of[\s_\-\.]*risk"),
        _c("Officer",           r"^officer$"),
        _c("Status",            r"^status$"),
        _c("Pol. Period From",  r"pol\.?\s*period[\s_\-\.]*from", r"period[\s_\-\.]*from"),
        _c("Pol. Period To",    r"pol\.?\s*period[\s_\-\.]*to",   r"period[\s_\-\.]*to"),
        _c("Category",          r"^category$"),
        _c("Date of Loss",      r"date[\s_\-\.]*of[\s_\-\.]*loss"),
        _c("USD Amount",        r"usd[\s_\-\.]*amount"),
        _c("IDR Amount",        r"idr[\s_\-\.]*amount"),
    ],
))

# ──────────────────────────────────────────────────────────────
# T02 · MARINE CARGO ALL — sheet: ALL (berbeda dari CPM)
# header: No., Policy No, Cession No., Certf, Name of The Insured,
#   Sailing Date/ETD, Vessel Name,
#   Voyage Detail From (double-header), Voyage Detail To (double-header),
#   Terms of Cover, Interest Insured, Curr, 100% Sum Insured,
#   LGI Sum Insured, Your Share (%), Your Sum Insured,
#   Net Rate %, Comm, Premium, Nett Premium, Remarks
# ──────────────────────────────────────────────────────────────
TEMPLATES.append(Template(
    name="MARINE_ALL",
    sheet_hints=[r"^all$"],
    sig_cols=[
        r"sailing[\s_\-\.]*date|etd",
        r"vessel[\s_\-\.]*name",
        r"voyage[\s_\-\.]*detail|voyage",
    ],
    double_header=True,
    columns=[
        _c("No.",                   r"^no\.?$"),
        _c("Policy No",             r"pol[i]?c[ey][\s_\-\.]*no\.?"),
        _c("Cession No.",           r"cession[\s_\-\.]*no\.?"),
        _c("Certf",                 r"cert[f]?\.?$", r"^certif"),
        _c("Name of The Insured",   r"name[\s_\-\.]*of[\s_\-\.]*the[\s_\-\.]*insured", r"insured[\s_\-\.]*name"),
        _c("Sailing Date / ETD",    r"sailing[\s_\-\.]*date", r"\betd\b"),
        _c("Vessel Name",           r"vessel[\s_\-\.]*name"),
        _c("Voyage Detail From",    r"voyage[\s_\-\.]*detail", sub=r"\bfrom\b"),
        _c("Voyage Detail To",      r"voyage[\s_\-\.]*detail", sub=r"\bto\b"),
        _c("Terms of Cover",        r"terms[\s_\-\.]*of[\s_\-\.]*cover"),
        _c("Interest Insured",      r"interest[\s_\-\.]*insured"),
        _c("Curr",                  r"^curr(ency)?$"),
        _c("100% Sum Insured",      r"100\s*%\s*sum[\s_\-\.]*insured", r"100[\s_\-\.]*percent[\s_\-\.]*sum"),
        _c("LGI Sum Insured",       r"lgi[\s_\-\.]*sum[\s_\-\.]*insured"),
        _c("Your Share (%)",        r"your[\s_\-\.]*share"),
        _c("Your Sum Insured",      r"your[\s_\-\.]*sum[\s_\-\.]*insured"),
        _c("Net Rate %",            r"net[\s_\-\.]*rate"),
        _c("Comm",                  r"^comm\.?$", r"^commission$"),
        _c("Premium",               r"^premium$"),
        _c("Nett Premium",          r"nett[\s_\-\.]*premium"),
        _c("Remarks",               r"^remarks?$"),
    ],
))

# ──────────────────────────────────────────────────────────────
# T03 · SHEET1 (FPR... style)
# ──────────────────────────────────────────────────────────────
TEMPLATES.append(Template(
    name="SHEET1_FPR",
    sheet_hints=[r"^sheet\s*1$", r"^sheet1$"],
    sig_cols=[
        r"policy[\s_\-\.]*no\.?",
        r"certificate[\s_\-\.]*no\.?",
        r"cession[\s_\-\.]*no\.?",
        r"reinsurance[\s_\-\.]*period|reins[\s_\-\.]*period",
    ],
    columns=[
        _c("POLICY NO",             r"^policy[\s_\-\.]*no\.?$"),
        _c("CERTIFICATE NO",        r"^certificate[\s_\-\.]*no\.?$", r"^cert[\s_\-\.]*no\.?$"),
        _c("CESSION NO",            r"^cession[\s_\-\.]*no\.?$"),
        _c("ENDORSEMENT",           r"^end[o]?rs(e)?ment$", r"^endt\.?$", r"^endt$"),
        _c("REF NO",                r"ref[\s_\-\.]*no\.?"),
        _c("TYPE OF COVER",         r"type[\s_\-\.]*of[\s_\-\.]*cover", r"\btoc\b"),
        _c("INSURED NAME",          r"^insured[\s_\-\.]*name$", r"^name[\s_\-\.]*of[\s_\-\.]*insured$"),
        _c("REINS PERIOD FROM",     r"reins(urance)?[\s_\-\.]*period[\s_\-\.]*[\(\-]?\s*from", r"period[\s_\-\.]*from"),
        _c("REINS PERIOD TO",       r"reins(urance)?[\s_\-\.]*period[\s_\-\.]*[\(\-]?\s*to",   r"period[\s_\-\.]*to"),
        _c("EFFECTIVE DATE",        r"effective[\s_\-\.]*date", r"\beff\.?\s*date\b"),
        _c("INSTALLMENT",           r"^install?ment$"),
        _c("DUE DATE",              r"due[\s_\-\.]*date"),
        _c("TSI",                   r"^tsi$", r"total[\s_\-\.]*sum[\s_\-\.]*insured"),
        _c("TSI OF REINS SHARE",    r"tsi[\s_\-\.]*of[\s_\-\.]*reins"),
        _c("RATE %",                r"^rate[\s_\-\.]*%?$"),
        _c("CURRENCY",              r"^curr(ency)?$"),
        _c("GROSS PREMIUM",         r"gross[\s_\-\.]*prem(ium)?"),
        _c("RI COMM",               r"r[\./]?i[\s_\-\.]*comm\.?", r"ri[\s_\-\.]*comm\.?"),
        _c("TAX",                   r"^tax$"),
        _c("NETT PREMIUM",          r"nett[\s_\-\.]*prem(ium)?", r"net[\s_\-\.]*prem(ium)?"),
        _c("RISK OCCUPATION",       r"risk[\s_\-\.]*occup"),
        _c("RISK LOCATION",         r"risk[\s_\-\.]*loc"),
    ],
))

# ──────────────────────────────────────────────────────────────
# T04 · SORT BY NAME
# ──────────────────────────────────────────────────────────────
TEMPLATES.append(Template(
    name="SORT_BY_NAME",
    sheet_hints=[r"sort[\s_\-\.]*by[\s_\-\.]*name", r"sory[\s_\-\.]*by[\s_\-\.]*name"],
    sig_cols=[
        r"policy[\s_\-\.]*no\.?",
        r"certificate[\s_\-\.]*no\.?",
        r"insured[\s_\-\.]*name",
    ],
    columns=[
        _c("POLICY No",             r"pol[i]?c[ey][\s_\-\.]*no\.?"),
        _c("CERTIFICATE NO",        r"certificate[\s_\-\.]*no\.?", r"cert[\s_\-\.]*no\.?"),
        _c("CESSION NO",            r"cession[\s_\-\.]*no\.?"),
        _c("ENDORSEMENT",           r"end[o]?rs(e)?ment", r"^endt\.?$"),
        _c("TYPE OF COVER",         r"type[\s_\-\.]*of[\s_\-\.]*cover", r"\btoc\b"),
        _c("INSURED NAME",          r"insured[\s_\-\.]*name", r"name[\s_\-\.]*of[\s_\-\.]*insured"),
        _c("REINS PERIOD FROM",     r"reins(urance)?[\s_\-\.]*period[\s_\-\.]*[\(\-]?\s*from", r"period[\s_\-\.]*from"),
        _c("REINS PERIOD TO",       r"reins(urance)?[\s_\-\.]*period[\s_\-\.]*[\(\-]?\s*to",   r"period[\s_\-\.]*to"),
        _c("EFFECTIVE DATE",        r"effective[\s_\-\.]*date", r"\beff\.?\s*date\b"),
        _c("INSTALLMENT",           r"install?ment"),
        _c("DUE DATE",              r"due[\s_\-\.]*date"),
        _c("TSI",                   r"^tsi$", r"total[\s_\-\.]*sum[\s_\-\.]*insured"),
        _c("TSI OF REINS SHARE",    r"tsi[\s_\-\.]*of[\s_\-\.]*reins"),
        _c("RATE %",                r"^rate[\s_\-\.]*%?$"),
        _c("CURRENCY",              r"^curr(ency)?$"),
        _c("GROSS PREMIUM",         r"gross[\s_\-\.]*prem(ium)?"),
        _c("RI COMM",               r"r[\./]?i[\s_\-\.]*comm\.?"),
        _c("TAX",                   r"^tax$"),
        _c("NETT PREMIUM",          r"nett[\s_\-\.]*prem(ium)?", r"net[\s_\-\.]*prem(ium)?"),
        _c("RISK OCCUPATION",       r"risk[\s_\-\.]*occup"),
        _c("RISK LOCATION",         r"risk[\s_\-\.]*loc"),
    ],
))

# ──────────────────────────────────────────────────────────────
# T05 · LIABILITY
# ──────────────────────────────────────────────────────────────
TEMPLATES.append(Template(
    name="LIABILITY",
    sheet_hints=[r"^liability$", r"^liab$"],
    sig_cols=[
        r"policy[\s_\-\.]*no\.?",
        r"cession[\s_\-\.]*no\.?",
        r"eseq[\s_\-\.]*no|e\.?seq",
        r"total[\s_\-\.]*sum[\s_\-\.]*insured",
    ],
    columns=[
        _c("POLICY NO.",            r"pol[i]?c[ey][\s_\-\.]*no\.?"),
        _c("CERTIFICATE NO.",       r"certificate[\s_\-\.]*no\.?", r"cert[\s_\-\.]*no\.?"),
        _c("CESSION NO.",           r"cession[\s_\-\.]*no\.?"),
        _c("ESEQ NO.",              r"eseq[\s_\-\.]*no\.?", r"e\.?seq"),
        _c("REF NO.",               r"ref[\s_\-\.]*no\.?"),
        _c("INSURED NAME",          r"insured[\s_\-\.]*name", r"^insured$"),
        _c("REINSURANCE PERIOD",    r"reins(urance)?[\s_\-\.]*period"),
        _c("DUE DATE",              r"due[\s_\-\.]*date"),
        _c("TOTAL SUM INSURED",     r"total[\s_\-\.]*sum[\s_\-\.]*insured"),
        _c("SUM INSURED",           r"^sum[\s_\-\.]*insured$"),
        _c("RATE",                  r"^rate[\s_\-\.]*%?$"),
        _c("CURRENCY",              r"^curr(ency)?$"),
        _c("PREMIUM",               r"^premium$"),
        _c("RI COMM.",              r"r[\./]?i[\s_\-\.]*comm\.?"),
        _c("NETT PREMIUM",          r"nett[\s_\-\.]*prem(ium)?", r"net[\s_\-\.]*prem(ium)?"),
        _c("DESCRIPTION",           r"^desc(ription)?$"),
        _c("REINS SHARE",           r"reins[\s_\-\.]*share", r"r/i[\s_\-\.]*share"),
    ],
))

# ──────────────────────────────────────────────────────────────
# T06 · MISCELLANEOUS  (double-header: PERIOD -> FROM / TO)
# ──────────────────────────────────────────────────────────────
TEMPLATES.append(Template(
    name="MISCELLANEOUS",
    sheet_hints=[r"^misc(ellaneous)?$"],
    sig_cols=[
        r"policy[\s_\-\._]*no\.?",
        r"certificate[\s_\-\._]*no\.?",
        r"cession[\s_\-\._]*no\.?",
        r"toc",
    ],
    double_header=True,
    columns=[
        _c("POLICY_NO.",            r"policy[\s_\-\._]*no\.?"),
        _c("CERTIFICATE_NO.",       r"certificate[\s_\-\._]*no\.?", r"cert[\s_\-\._]*no\.?"),
        _c("CESSION_NO.",           r"cession[\s_\-\._]*no\.?"),
        _c("ENDT",                  r"^endt\.?$", r"^endorsement$"),
        _c("INSURED",               r"^insured$"),
        _c("PERIOD FROM",           r"^period$", sub=r"^from$"),
        _c("PERIOD TO",             r"^period$", sub=r"^to$"),
        _c("DUE_DATE",              r"due[\s_\-\._]*date"),
        _c("TOTAL_SUM_INSURED",     r"total[\s_\-\._]*sum[\s_\-\._]*insured"),
        _c("SUM_INSURED",           r"^sum[\s_\-\._]*insured$"),
        _c("RATE",                  r"^rate[\s_\-\._]*%?$"),
        _c("CURRENCY",              r"^curr(ency)?$"),
        _c("PREMIUM",               r"^premium$"),
        _c("RI_COMM",               r"r[\./]?i[\s_\-\._]*comm\.?"),
        _c("NETT",                  r"^nett$", r"^nett[\s_\-\._]*prem(ium)?$"),
        _c("TOC",                   r"^toc$", r"type[\s_\-\._]*of[\s_\-\._]*cover"),
        _c("REMARK",                r"^remarks?$"),
        _c("REINS_SHARE",           r"reins[\s_\-\._]*share"),
        _c("POLICY WORDING",        r"policy[\s_\-\._]*wording"),
        _c("SIC CODE",              r"sic[\s_\-\._]*code"),
        _c("INSURED ITEMS",         r"insured[\s_\-\._]*items"),
        _c("RISK OCCUPATION",       r"risk[\s_\-\._]*occup"),
        _c("INSURED BUSINESS",      r"insured[\s_\-\._]*business"),
        _c("RISK LOCATION",         r"risk[\s_\-\._]*loc"),
        _c("PROJECT LOCATION",      r"project[\s_\-\._]*loc"),
        _c("SOP IN PLACE",          r"sop[\s_\-\._]*in[\s_\-\._]*place"),
        _c("GEOGRAPHICAL LIMIT",    r"geo(graphical)?[\s_\-\._]*limit"),
        _c("MACHINERY CATEGORY",    r"machinery[\s_\-\._]*cat"),
        _c("MACHINERY BRAND",       r"machinery[\s_\-\._]*brand"),
        _c("DISCOVERY PERIOD",      r"discovery[\s_\-\._]*period"),
        _c("MACHINERY TYPE",        r"machinery[\s_\-\._]*type"),
        _c("MACHINERY YEAR MANUFACTURED", r"machinery[\s_\-\._]*year"),
        _c("REINSTATEMENT OF POLICY LIMIT", r"reinstatement"),
        _c("MACHINERY SERIAL_NO.",  r"machinery[\s_\-\._]*serial"),
        _c("CATEGORY",              r"^category$"),
        _c("MACHINERY CHASSIS NUMBER", r"chassis"),
    ],
))

# ──────────────────────────────────────────────────────────────
# T07 · UPDATE MEI / MEI-JULI-SEPTEMBER
# ──────────────────────────────────────────────────────────────
TEMPLATES.append(Template(
    name="UPDATE_MEI",
    sheet_hints=[r"^(mei|may|juli?|july|sept(ember)?|update)"],
    sig_cols=[
        r"quartal",
        r"mop[\s_\-\.]*no\.?",
        r"\betd\b",
        r"retro[\s_\-\.]*code",
    ],
    columns=[
        _c("Quartal",               r"^quartal$"),
        _c("Periode",               r"^periode$", r"^period$"),
        _c("Policy No.",            r"pol[i]?c[ey][\s_\-\.]*no\.?"),
        _c("Insured Name",          r"insured[\s_\-\.]*name"),
        _c("MOP No.",               r"mop[\s_\-\.]*no\.?"),
        _c("ETD",                   r"\betd\b"),
        _c("Curr",                  r"^curr(ency)?$"),
        _c("Policy Description",    r"policy[\s_\-\.]*desc"),
        _c("TSI 100%",              r"tsi[\s_\-\.]*100\s*%?", r"100\s*%\s*tsi"),
        _c("RIC",                   r"^ric$"),
        _c("Our Share",             r"our[\s_\-\.]*share"),
        _c("MOC Code",              r"moc[\s_\-\.]*code"),
        _c("Retro Code",            r"retro[\s_\-\.]*code"),
        _c("OUR SHARE",             r"our[\s_\-\.]*share"),
        _c("RETENSI",               r"^retensi$"),
        _c("RETRO",                 r"^retro$"),
        _c("GROSS PREMI",           r"gross[\s_\-\.]*prem(i(um)?)?"),
        _c("NET PREMI",             r"net[\s_\-\.]*prem(i(um)?)?"),
        _c("Nett Premium",          r"nett[\s_\-\.]*prem(ium)?"),
        _c("Payment Status",        r"payment[\s_\-\.]*status"),
        _c("Payment Month",         r"payment[\s_\-\.]*month"),
        _c("Total RI Premium",      r"total[\s_\-\.]*ri[\s_\-\.]*prem"),
    ],
))

# ──────────────────────────────────────────────────────────────
# T08 · SHEET1 TID
# ──────────────────────────────────────────────────────────────
TEMPLATES.append(Template(
    name="SHEET1_TID",
    sheet_hints=[r"^sheet\s*1$", r"^sheet1$"],
    sig_cols=[
        r"^cob$",
        r"^cedant$",
        r"^broker$",
        r"doc[\s_\-\.]*no",
    ],
    columns=[
        _c("NO",            r"^no\.?$"),
        _c("COB",           r"^cob$"),
        _c("CEDANT",        r"^cedant$"),
        _c("BROKER",        r"^broker$"),
        _c("DOC NO",        r"doc[\s_\-\.]*no"),
        _c("NO PLA",        r"no[\s_\-\.]*pla"),
        _c("INSURED",       r"^insured$"),
        _c("DOL",           r"^dol$"),
        _c("TIPE",          r"^tipe$"),
        _c("CURR",          r"^curr(ency)?$"),
        _c("100%",          r"^100\s*%?$"),
        _c("Indonesia Re's", r"indonesia[\s_\-\.]*re"),
        _c("DOC DATE",      r"doc[\s_\-\.]*date"),
        _c("REMARKS",       r"^remarks?$"),
    ],
))

# ──────────────────────────────────────────────────────────────
# T09 · ASRINDA
# ──────────────────────────────────────────────────────────────
TEMPLATES.append(Template(
    name="ASRINDA",
    sheet_hints=[r"^asrinda$"],
    sig_cols=[
        r"^cob$",
        r"interest[\s_\-\.]*details",
        r"conveyance",
        r"indore",
    ],
    columns=[
        _c("No.",                   r"^no\.?$"),
        _c("COB",                   r"^cob$"),
        _c("Policy No.",            r"pol[i]?c[ey][\s_\-\.]*no\.?"),
        _c("Interest Details",      r"interest[\s_\-\.]*details"),
        _c("Coverage",              r"^coverage$"),
        _c("Conveyance",            r"^conveyance$"),
        _c("ETD",                   r"\betd\b"),
        _c("From",                  r"^from$"),
        _c("Destination",           r"^destination$"),
        _c("Rate Polis(%)",         r"rate[\s_\-\.]*polis"),
        _c("Curr",                  r"^curr(ency)?$"),
        _c("TSI 100%",              r"tsi[\s_\-\.]*100\s*%?", r"100\s*%"),
        _c("Share",                 r"^share$"),
        _c("INDORE (2.5%)",         r"indore[\s_\-\.]*\(?2\.5"),
        _c("INDORE (30%)",          r"indore[\s_\-\.]*\(?30"),
        _c("Net due to you",        r"net[\s_\-\.]*due[\s_\-\.]*to[\s_\-\.]*you"),
    ],
))

# ──────────────────────────────────────────────────────────────
# T10 · BORDERO (BORD. OKT / JULI / etc)
# ──────────────────────────────────────────────────────────────
TEMPLATES.append(Template(
    name="BORDERO_BORD",
    sheet_hints=[r"bord", r"bordero"],
    sig_cols=[
        r"interest[\s_\-\.]*&[\s_\-\.]*quantity|interest",
        r"date[\s_\-\.]*of[\s_\-\.]*sailing|sailing",
        r"vessel[\s_\-\.]*air[\s_\-\.]*freight|vessel",
        r"ship[\s_\-\.]*particular",
    ],
    columns=[
        _c("No.",                       r"^no\.?$"),
        _c("Policy",                    r"^policy$"),
        _c("Interest & Quantity",       r"interest[\s_\-\.]*&[\s_\-\.]*quantity"),
        _c("Date of Sailing",           r"date[\s_\-\.]*of[\s_\-\.]*sailing"),
        _c("Vessel/Air Freight",        r"vessel[\s_\-\.]*/?[\s_\-\.]*air[\s_\-\.]*freight"),
        _c("Type of Vessel",            r"type[\s_\-\.]*of[\s_\-\.]*vessel"),
        _c("GRT",                       r"^grt$"),
        _c("YoB",                       r"^yob$", r"year[\s_\-\.]*of[\s_\-\.]*built"),
        _c("Class",                     r"^class$"),
        _c("From",                      r"^from$"),
        _c("Destination",               r"^destination$"),
        _c("Condition",                 r"^condition$"),
        _c("Curr.",                     r"^curr\.?$", r"^currency$"),
        _c("TSI",                       r"^tsi$"),
        _c("Rate",                      r"^rate$"),
        _c("Share 15.00%",              r"share[\s_\-\.]*15"),
        _c("Premium Share",             r"premium[\s_\-\.]*share"),
        _c("R/I Comm. 30.00%",          r"r[\./]?i[\s_\-\.]*comm[\s_\-\.]*30", r"comm[\s_\-\.]*30"),
        _c("Nett.",                     r"^nett\.?$"),
    ],
))

# ──────────────────────────────────────────────────────────────
# T11 · Bordero (NO./POLICY/THE INSURED style)
# ──────────────────────────────────────────────────────────────
TEMPLATES.append(Template(
    name="BORDERO_NEW",
    sheet_hints=[r"bord", r"bordero"],
    sig_cols=[
        r"^the[\s_\-\.]*insured$",
        r"voyage[\s_\-\.]*from|voyage",
        r"conveyance[\s_\-\.]*name|conveyance",
    ],
    columns=[
        _c("NO.",               r"^no\.?$"),
        _c("POLICY",            r"^policy$"),
        _c("THE INSURED",       r"the[\s_\-\.]*insured"),
        _c("INTEREST",          r"^interest$"),
        _c("ETD",               r"\betd\b"),
        _c("VOYAGE FROM",       r"voyage[\s_\-\.]*from", r"voyage[\s_\-\.]*-[\s_\-\.]*from"),
        _c("VOYAGE TO",         r"voyage[\s_\-\.]*to",   r"voyage[\s_\-\.]*-[\s_\-\.]*to"),
        _c("NAME OF VESSEL",    r"name[\s_\-\.]*of[\s_\-\.]*vessel"),
        _c("TYPE",              r"^type$"),
        _c("GRT",               r"^grt$"),
        _c("YOB",               r"^yob$"),
        _c("CLASS",             r"^class$"),
        _c("Condition",         r"^condition$"),
        _c("Curr.",             r"^curr\.?$", r"^currency$"),
        _c("TSI",               r"^tsi$"),
        _c("RATE",              r"^rate$"),
        _c("PREMIUM",           r"^premium$"),
        _c("INDORE Share",      r"indore[\s_\-\.]*share", r"share"),
        _c("INDORE Premium Share", r"indore[\s_\-\.]*premium[\s_\-\.]*share", r"premium[\s_\-\.]*share"),
        _c("INDORE R/I Comm.",  r"r[\./]?i[\s_\-\.]*comm\.?"),
        _c("Nett.",             r"^nett\.?$"),
    ],
))

# ──────────────────────────────────────────────────────────────
# T12 · CIT / CICB / CIS / CIATM
# ──────────────────────────────────────────────────────────────
TEMPLATES.append(Template(
    name="CIT_CICB_CIS",
    sheet_hints=[r"^cit$", r"^cicb$", r"^cis$", r"^ciatm$"],
    sig_cols=[
        r"insured[\s_\-\.]*name",
        r"cert[\s_\-\.]*no\.?",
        r"risk[\s_\-\.]*loc",
        r"sum[\s_\-\.]*insured",
    ],
    columns=[
        _c("No.",               r"^no\.?$"),
        _c("Insured Name",      r"insured[\s_\-\.]*name"),
        _c("Cert No.",          r"cert[\s_\-\.]*no\.?"),
        _c("Risk Location",     r"risk[\s_\-\.]*loc"),
        _c("Period of Insurance", r"period[\s_\-\.]*of[\s_\-\.]*insurance"),
        _c("Curs",              r"^curs$", r"^curr(ency)?$"),
        _c("Total",             r"^total$"),
        _c("SDate",             r"^sdate$", r"start[\s_\-\.]*date"),
        _c("EDate",             r"^edate$", r"end[\s_\-\.]*date"),
        _c("Sum Insured",       r"^sum[\s_\-\.]*insured$"),
    ],
))

# ──────────────────────────────────────────────────────────────
# T13 · SURETY SHIP
# ──────────────────────────────────────────────────────────────
TEMPLATES.append(Template(
    name="SURETY_SHIP",
    sheet_hints=[r"^surety[\s_\-\.]*ship$", r"^surety$"],
    sig_cols=[
        r"policyno|policy[\s_\-\.]*no",
        r"principal[\s_\-\.]*code",
        r"project[\s_\-\.]*name",
        r"bond",
    ],
    columns=[
        _c("POLICYNO",              r"^policyno$", r"^policy[\s_\-\.]*no\.?$"),
        _c("CERTIFICATENO",         r"^certificateno$", r"^certificate[\s_\-\.]*no\.?$"),
        _c("CESSION_NO",            r"^cession[\s_\-\._]*no\.?$"),
        _c("ENDT",                  r"^endt\.?$"),
        _c("INSURED",               r"^insured$"),
        _c("PERIOD FROM",           r"^period$", sub=r"^from$"),
        _c("PERIOD TO",             r"^period$", sub=r"^to$"),
        _c("DUE_DATE",              r"due[\s_\-\._]*date"),
        _c("TOTAL_SUM_INSURED",     r"total[\s_\-\._]*sum[\s_\-\._]*insured"),
        _c("SUM_INSURED",           r"^sum[\s_\-\._]*insured$"),
        _c("RATE",                  r"^rate[\s_\-\._]*%?$"),
        _c("CURRENCY",              r"^curr(ency)?$"),
        _c("PREMIUM",               r"^premium$"),
        _c("RI_COMM",               r"r[\./]?i[\s_\-\._]*comm\.?"),
        _c("NETT",                  r"^nett\.?$", r"^nett[\s_\-\._]*prem"),
        _c("REMARK",                r"^remarks?$"),
        _c("REINS_SHARE",           r"reins[\s_\-\._]*share"),
        _c("RICOMM",                r"^ricomm$", r"r[\./]?i[\s_\-\._]*comm\.?"),
        _c("Principal Code",        r"principal[\s_\-\.]*code"),
        _c("Project Name",          r"project[\s_\-\.]*name"),
        _c("Project Value",         r"project[\s_\-\.]*value"),
        _c("Additional Document/BOND", r"additional[\s_\-\.]*doc", r"\bbond\b"),
        _c("Contract No.",          r"contract[\s_\-\.]*no"),
        _c("Date of Contract",      r"date[\s_\-\.]*of[\s_\-\.]*contract"),
        _c("Date of Event",         r"date[\s_\-\.]*of[\s_\-\.]*event"),
        _c("Document Reference",    r"doc(ument)?[\s_\-\.]*ref"),
        _c("Document Type",         r"doc(ument)?[\s_\-\.]*type"),
    ],
))

# ──────────────────────────────────────────────────────────────
# T14 · ENGINEERING
# ──────────────────────────────────────────────────────────────
TEMPLATES.append(Template(
    name="ENGINEERING",
    sheet_hints=[r"^engineering$", r"^eng$"],
    sig_cols=[
        r"policyno|policy[\s_\-\.]*no",
        r"cession[\s_\-\._]*no",
    ],
    columns=[
        _c("POLICYNO",          r"^policyno$", r"^policy[\s_\-\.]*no\.?$"),
        _c("CERTIFICATENO",     r"^certificateno$", r"^certificate[\s_\-\.]*no\.?$"),
        _c("CESSION_NO",        r"cession[\s_\-\._]*no"),
        _c("ENDT",              r"^endt\.?$"),
        _c("INSURED",           r"^insured$"),
        _c("PERIOD FROM",       r"^period$", sub=r"^from$"),
        _c("PERIOD TO",         r"^period$", sub=r"^to$"),
        _c("DUE_DATE",          r"due[\s_\-\._]*date"),
        _c("TOTAL_SUM_INSURED", r"total[\s_\-\._]*sum[\s_\-\._]*insured"),
        _c("SUM_INSURED",       r"^sum[\s_\-\._]*insured$"),
        _c("RATE",              r"^rate[\s_\-\._]*%?$"),
        _c("CURRENCY",          r"^curr(ency)?$"),
        _c("PREMIUM",           r"^premium$"),
        _c("RI_COMM",           r"r[\./]?i[\s_\-\._]*comm\.?"),
        _c("NETT",              r"^nett\.?$", r"^nett[\s_\-\._]*prem"),
        _c("REMARK",            r"^remarks?$"),
    ],
))

# ──────────────────────────────────────────────────────────────
# T15 · CREDIT INSURANCE
# ──────────────────────────────────────────────────────────────
TEMPLATES.append(Template(
    name="CREDIT_INS",
    sheet_hints=[r"^credit[\s_\-\.]*ins", r"^cred$"],
    sig_cols=[
        r"policyno|policy[\s_\-\.]*no",
        r"nak[\s_\-\.]*no|sp3k[\s_\-\.]*no",
        r"max(imum)?[\s_\-\.]*credit[\s_\-\.]*limit",
    ],
    columns=[
        _c("POLICYNO",          r"^policyno$", r"^policy[\s_\-\.]*no\.?$"),
        _c("CERTIFICATENO",     r"^certificateno$", r"^certificate[\s_\-\.]*no\.?$"),
        _c("CESSION_NO",        r"cession[\s_\-\._]*no"),
        _c("ENDT",              r"^endt\.?$"),
        _c("INSURED",           r"^insured$"),
        _c("PERIOD FROM",       r"^period$", sub=r"^from$"),
        _c("PERIOD TO",         r"^period$", sub=r"^to$"),
        _c("DUE_DATE",          r"due[\s_\-\._]*date"),
        _c("TOTAL_SUM_INSURED", r"total[\s_\-\._]*sum[\s_\-\._]*insured"),
        _c("SUM_INSURED",       r"^sum[\s_\-\._]*insured$"),
        _c("RATE",              r"^rate[\s_\-\._]*%?$"),
        _c("CURRENCY",          r"^curr(ency)?$"),
        _c("PREMIUM",           r"^premium$"),
        _c("RI_COMM",           r"r[\./]?i[\s_\-\._]*comm\.?"),
        _c("NETT",              r"^nett\.?$"),
        _c("REMARK",            r"^remarks?$"),
        _c("REINS_SHARE",       r"reins[\s_\-\._]*share"),
        _c("RICOMM",            r"^ricomm$"),
        _c("Debtor Name/BUYER", r"debtor[\s_\-\.]*name", r"\bbuyer\b"),
        _c("NAK No./Declaration No.", r"nak[\s_\-\.]*no", r"declaration[\s_\-\.]*no"),
        _c("SP3K No.",          r"sp3k[\s_\-\.]*no"),
        _c("Tujuan Kredit",     r"tujuan[\s_\-\.]*kredit"),
        _c("Jenis Pertanggungan", r"jenis[\s_\-\.]*pert"),
        _c("Bidang Usaha",      r"bidang[\s_\-\.]*usaha"),
        _c("Ganti Rugi/Expiry Period", r"ganti[\s_\-\.]*rugi", r"expiry[\s_\-\.]*period"),
        _c("Percentage of Indemnity",  r"percentage[\s_\-\.]*of[\s_\-\.]*indem"),
        _c("Coverage",          r"^coverage$"),
        _c("Geographical Limit", r"geo(graphical)?[\s_\-\.]*limit"),
        _c("Goods Insured",     r"goods[\s_\-\.]*insured"),
        _c("Maximum Credit Limit", r"max(imum)?[\s_\-\.]*credit[\s_\-\.]*limit"),
        _c("Maximum Sales Turn Over", r"max(imum)?[\s_\-\.]*sales"),
    ],
))

# ──────────────────────────────────────────────────────────────
# T16 · PERSONAL ACCIDENT
# ──────────────────────────────────────────────────────────────
TEMPLATES.append(Template(
    name="PERSONAL_ACCIDENT",
    sheet_hints=[r"^personal[\s_\-\.]*accident$", r"^pa$"],
    sig_cols=[
        r"policyno|policy[\s_\-\.]*no",
        r"^gender$",
        r"^ocupation$|^occupation$",
    ],
    columns=[
        _c("POLICYNO",          r"^policyno$", r"^policy[\s_\-\.]*no\.?$"),
        _c("CERTIFICATENO",     r"^certificateno$", r"^certificate[\s_\-\.]*no\.?$"),
        _c("CESSION_NO",        r"cession[\s_\-\._]*no"),
        _c("ENDT",              r"^endt\.?$"),
        _c("INSURED",           r"^insured$"),
        _c("PERIOD FROM",       r"^period$", sub=r"^from$"),
        _c("PERIOD TO",         r"^period$", sub=r"^to$"),
        _c("DUE_DATE",          r"due[\s_\-\._]*date"),
        _c("TOTAL_SUM_INSURED", r"total[\s_\-\._]*sum[\s_\-\._]*insured"),
        _c("SUM_INSURED",       r"^sum[\s_\-\._]*insured$"),
        _c("RATE",              r"^rate[\s_\-\._]*%?$"),
        _c("CURRENCY",          r"^curr(ency)?$"),
        _c("PREMIUM",           r"^premium$"),
        _c("RI_COMM",           r"r[\./]?i[\s_\-\._]*comm\.?"),
        _c("NETT",              r"^nett\.?$"),
        _c("REMARK",            r"^remarks?$"),
        _c("REINS_SHARE",       r"reins[\s_\-\._]*share"),
        _c("RICOMM",            r"^ricomm$"),
        _c("ID NO",             r"^id[\s_\-\.]*no\.?$"),
        _c("NAME",              r"^name$"),
        _c("GENDER",            r"^gender$"),
        _c("BIRTH DATE",        r"birth[\s_\-\.]*date"),
        _c("ADDRESS",           r"^address$"),
        _c("OCCUPATION",        r"^ocup(ation)?$", r"^occup(ation)?$"),
        _c("CLASS TYPE",        r"class[\s_\-\.]*type"),
    ],
))

# ──────────────────────────────────────────────────────────────
# T17 · BDO MARCH / JANUARY / DECEMBER
# ──────────────────────────────────────────────────────────────
TEMPLATES.append(Template(
    name="BDO_FACULTATIVE",
    sheet_hints=[r"^bdo", r"bdo[\s_\-\.]*march", r"bdo[\s_\-\.]*jan", r"bdo[\s_\-\.]*dec"],
    sig_cols=[
        r"facultative[\s_\-\.]*back[\s_\-\.]*up",
        r"mop[\s_\-\.]*no\.?",
        r"bl[\s_\-\.]*no",
        r"fac\.?\s*share",
    ],
    columns=[
        _c("FACULTATIVE BACK UP",   r"facultative[\s_\-\.]*back[\s_\-\.]*up"),
        _c("MOP No.",               r"mop[\s_\-\.]*no\.?"),
        _c("Policy No.",            r"pol[i]?c[ey][\s_\-\.]*no\.?"),
        _c("EndtNo",                r"endt[\s_\-\.]*no\.?", r"^endt\.?$"),
        _c("AZ Share",              r"az[\s_\-\.]*share"),
        _c("InsuredName",           r"insured[\s_\-\.]*name"),
        _c("Sailing date",          r"sailing[\s_\-\.]*date"),
        _c("Voyage",                r"^voyage$"),
        _c("Conveyance",            r"^conveyance$"),
        _c("BL NO",                 r"bl[\s_\-\.]*no"),
        _c("INTEREST INSURED",      r"interest[\s_\-\.]*insured"),
        _c("Currency",              r"^curr(ency)?$"),
        _c("TSI 100%",              r"tsi[\s_\-\.]*100\s*%?"),
        _c("Rate",                  r"^rate$"),
        _c("Premium 100%",          r"premium[\s_\-\.]*100\s*%?"),
        _c("FAC. SHARE",            r"fac\.?\s*share"),
        _c("RIGrossPremi",          r"ri[\s_\-\.]*gross[\s_\-\.]*prem"),
        _c("RIComm",                r"ri[\s_\-\.]*comm"),
        _c("RINetPremi",            r"ri[\s_\-\.]*net[\s_\-\.]*prem"),
    ],
))

# ──────────────────────────────────────────────────────────────
# T18 · EEI / MH / MB / CPM / CECR
# ──────────────────────────────────────────────────────────────
TEMPLATES.append(Template(
    name="EEI_MH_MB_CPM",
    sheet_hints=[r"^eei$", r"^mh$", r"^mb$", r"^cpm$", r"^cecr$"],
    sig_cols=[
        r"^polis[\s_\-\.]*no$|^polis no$",
        r"^reas$",
        r"^sdate$",
        r"^edate$",
        r"^ori[\s_\-\.]*sum[\s_\-\.]*ins$",
    ],
    columns=[
        _c("No",            r"^no\.?$"),
        _c("Polis No",      r"^polis[\s_\-\.]*no$"),
        _c("Insured",       r"^insured$"),
        _c("TOC",           r"^toc$"),
        _c("Reas",          r"^reas$"),
        _c("Cession No",    r"cession[\s_\-\.]*no"),
        _c("Sdate",         r"^sdate$"),
        _c("Edate",         r"^edate$"),
        _c("Due Date",      r"due[\s_\-\.]*date"),
        _c("Rate",          r"^rate$"),
        _c("Share",         r"^share$"),
        _c("Comm",          r"^comm\.?$"),
        _c("Ori Sum Ins",   r"ori[\s_\-\.]*sum[\s_\-\.]*ins"),
        _c("Ccy",           r"^ccy$", r"^curr(ency)?$"),
        _c("Sum Ins",       r"^sum[\s_\-\.]*ins$"),
        _c("Gross Premi",   r"gross[\s_\-\.]*prem"),
        _c("Komisi",        r"^komisi$"),
        _c("Net Premi",     r"net[\s_\-\.]*prem"),
        _c("Obj Info",      r"obj[\s_\-\.]*info"),
    ],
))

# ──────────────────────────────────────────────────────────────
# T19 · INLAND / INTER ISLAND / IMPORT / EXPORT
# ──────────────────────────────────────────────────────────────
TEMPLATES.append(Template(
    name="INLAND_INTER_ISLAND",
    sheet_hints=[r"^inland$", r"^inter[\s_\-\.]*island$", r"^import$", r"^export$"],
    sig_cols=[
        r"^vessel$",
        r"\beta\b",
        r"\betd\b",
        r"^pol$|^pol[\s_\-\.]*of[\s_\-\.]*load",
        r"tonase",
    ],
    columns=[
        _c("No",                    r"^no\.?$"),
        _c("Vessel",                r"^vessel$"),
        _c("ETA",                   r"^eta$"),
        _c("ETD",                   r"^etd$"),
        _c("POL",                   r"^pol$"),
        _c("Port of Loading",       r"port[\s_\-\.]*of[\s_\-\.]*load"),
        _c("Port of Discharge",     r"port[\s_\-\.]*of[\s_\-\.]*dis"),
        _c("Tonase Ingot G1",       r"tonase.*ingot[\s_\-\.]*g1"),
        _c("Tonase Ingot S1B",      r"tonase.*ingot[\s_\-\.]*s1b"),
        _c("Tonase Billet",         r"tonase.*billet"),
        _c("Tonase Alloy",          r"tonase.*alloy"),
        _c("Final Price Ingot G1",  r"final[\s_\-\.]*price.*ingot[\s_\-\.]*g1"),
        _c("Final Price Ingot S1B", r"final[\s_\-\.]*price.*ingot[\s_\-\.]*s1b"),
        _c("Final Price Billet",    r"final[\s_\-\.]*price.*billet"),
        _c("Final Price Billet Butt", r"final[\s_\-\.]*price.*butt"),
        _c("Final Price Alloy",     r"final[\s_\-\.]*price.*alloy"),
        _c("CURR",                  r"^curr(ency)?$"),
        _c("TSI",                   r"^tsi$"),
        _c("Rate",                  r"^rate$"),
        _c("Share",                 r"^share$"),
        _c("Premium",               r"^premium$"),
        _c("RI Comm",               r"r[\./]?i[\s_\-\.]*comm"),
        _c("Net due to you",        r"net[\s_\-\.]*due[\s_\-\.]*to[\s_\-\.]*you"),
    ],
))

# ──────────────────────────────────────────────────────────────
# T20 · INDORE
# ──────────────────────────────────────────────────────────────
TEMPLATES.append(Template(
    name="INDORE",
    sheet_hints=[r"^indore$", r"indonesia[\s_\-\.]*re", r"pt[\s_\-\.]*reasu"],
    sig_cols=[
        r"slip[\s_\-\.]*number",
        r"vessel[\s_\-\.]*type",
        r"grt[\s_\-\.]*/?[\s_\-\.]*nrt",
    ],
    columns=[
        _c("Slip Number",       r"slip[\s_\-\.]*number"),
        _c("No.Policy",         r"no\.?[\s_\-\.]*policy", r"pol[i]?c[ey][\s_\-\.]*no"),
        _c("PeriodFrom",        r"period[\s_\-\.]*from"),
        _c("PeriodTo",          r"period[\s_\-\.]*to"),
        _c("COB",               r"^cob$"),
        _c("DUE DATE",          r"due[\s_\-\.]*date"),
        _c("InsuredName",       r"insured[\s_\-\.]*name"),
        _c("VesselName",        r"vessel[\s_\-\.]*name"),
        _c("Vessel Type",       r"vessel[\s_\-\.]*type"),
        _c("YearBuilt",         r"year[\s_\-\.]*built"),
        _c("GRT/NRT",           r"grt[\s_\-\.]*/?[\s_\-\.]*nrt"),
        _c("RI Share",          r"r[\./]?i[\s_\-\.]*share"),
        _c("R/I Comm",          r"r[\./]?i[\s_\-\.]*comm"),
        _c("Currency",          r"^curr(ency)?$"),
        _c("TSI",               r"^tsi$"),
        _c("Gross Premium",     r"gross[\s_\-\.]*prem"),
        _c("RI Comm In",        r"sum[\s_\-\.]*of[\s_\-\.]*ri[\s_\-\.]*comm", r"ri[\s_\-\.]*comm[\s_\-\.]*in"),
        _c("Nett Premi",        r"nett[\s_\-\.]*prem"),
    ],
))

# ──────────────────────────────────────────────────────────────
# T21 · REPORT (POLICY NO. / CERTIFICATE NO. / REINS PERIOD)
# ──────────────────────────────────────────────────────────────
TEMPLATES.append(Template(
    name="REPORT",
    sheet_hints=[r"^report", r"report[\s_\-\.]*to[\s_\-\.]*reins"],
    sig_cols=[
        r"policy[\s_\-\.]*no\.?",
        r"certificate[\s_\-\.]*no\.?",
        r"reins[\s_\-\.]*period",
        r"vessel[\s_\-\.]*name",
    ],
    columns=[
        _c("POLICY NO.",        r"pol[i]?c[ey][\s_\-\.]*no\.?"),
        _c("CERTIFICATE NO.",   r"certificate[\s_\-\.]*no\.?"),
        _c("CESSION NO.",       r"cession[\s_\-\.]*no\.?"),
        _c("CONFIRMATION NO.",  r"confirm(ation)?[\s_\-\.]*no\.?"),
        _c("INSURED",           r"^insured$"),
        _c("REINS PERIOD FROM", r"reins[\s_\-\.]*period[\s_\-\.]*from", r"period[\s_\-\.]*from"),
        _c("REINS PERIOD TO",   r"reins[\s_\-\.]*period[\s_\-\.]*to",   r"period[\s_\-\.]*to"),
        _c("EFF. DATE",         r"eff\.?\s*date", r"effective[\s_\-\.]*date"),
        _c("WPC TIMES",         r"wpc[\s_\-\.]*times"),
        _c("DUE DATE",          r"due[\s_\-\.]*date"),
        _c("TOTAL SUM INSURED", r"total[\s_\-\.]*sum[\s_\-\.]*insured"),
        _c("SUM INSURED",       r"^sum[\s_\-\.]*insured$"),
        _c("RATE",              r"^rate$"),
        _c("CURRENCY",          r"^curr(ency)?$"),
        _c("PREMIUM",           r"^premium$"),
        _c("RI COMM",           r"r[\./]?i[\s_\-\.]*comm"),
        _c("NET PREMIUM",       r"net[\s_\-\.]*prem(ium)?"),
        _c("REINS SHARE",       r"reins[\s_\-\.]*share"),
        _c("VESSEL NAME",       r"vessel[\s_\-\.]*name"),
        _c("VESSEL TYPE",       r"vessel[\s_\-\.]*type"),
    ],
))

# ──────────────────────────────────────────────────────────────
# T22 · PAID
# ──────────────────────────────────────────────────────────────
TEMPLATES.append(Template(
    name="PAID",
    sheet_hints=[r"^paid$"],
    sig_cols=[
        r"^quartal$",
        r"mop[\s_\-\.]*no\.?",
        r"payment[\s_\-\.]*status",
        r"payment[\s_\-\.]*month",
    ],
    columns=[
        _c("Quartal",           r"^quartal$"),
        _c("Policy No.",        r"pol[i]?c[ey][\s_\-\.]*no\.?"),
        _c("ETD",               r"\betd\b"),
        _c("Insured Name",      r"insured[\s_\-\.]*name"),
        _c("MOP No.",           r"mop[\s_\-\.]*no\.?"),
        _c("Policy Description", r"policy[\s_\-\.]*desc"),
        _c("Curr",              r"^curr(ency)?$"),
        _c("TSI 100%",          r"tsi[\s_\-\.]*100\s*%?"),
        _c("RIC",               r"^ric$"),
        _c("Our Share",         r"our[\s_\-\.]*share"),
        _c("RETRO CODE",        r"retro[\s_\-\.]*code"),
        _c("OUR SHARE",         r"our[\s_\-\.]*share"),
        _c("RETENSI",           r"^retensi$"),
        _c("RETRO",             r"^retro$"),
        _c("GROSS PREMI",       r"gross[\s_\-\.]*prem"),
        _c("NET PREMI",         r"net[\s_\-\.]*prem"),
        _c("Nett Premium",      r"nett[\s_\-\.]*prem"),
        _c("Payment Status",    r"payment[\s_\-\.]*status"),
        _c("Payment Month",     r"payment[\s_\-\.]*month"),
    ],
))

# ──────────────────────────────────────────────────────────────
# T23 · REINDO HULL
# ──────────────────────────────────────────────────────────────
TEMPLATES.append(Template(
    name="REINDO_HULL",
    sheet_hints=[r"reindo[\s_\-\.]*hull", r"^hull$"],
    sig_cols=[
        r"the[\s_\-\.]*insured",
        r"trading[\s_\-\.]*warranty",
        r"deductible",
        r"statement[\s_\-\.]*no",
    ],
    columns=[
        _c("NO.",               r"^no\.?$"),
        _c("THE INSURED",       r"the[\s_\-\.]*insured"),
        _c("VESSEL NAME",       r"vessel[\s_\-\.]*name"),
        _c("VESSEL TYPE",       r"vessel[\s_\-\.]*type"),
        _c("YOB",               r"^yob$"),
        _c("GRT",               r"^grt$"),
        _c("CONSTRUCTION",      r"^construction$"),
        _c("CLASSIFICATION",    r"^class(ification)?$"),
        _c("INCEPTION DATE",    r"inception[\s_\-\.]*date", r"period[\s_\-\.]*from"),
        _c("EXPIRED DATE",      r"expir(ed|y)[\s_\-\.]*date", r"period[\s_\-\.]*to"),
        _c("COVERAGE",          r"^coverage$"),
        _c("TRADING WARRANTY",  r"trading[\s_\-\.]*warranty"),
        _c("DEDUCTIBLE",        r"^deductible$"),
        _c("SUM INSURED",       r"^sum[\s_\-\.]*insured$"),
        _c("RATE (%)",          r"^rate[\s_\-\.]*\(?%?\)?$"),
        _c("SHARE (%)",         r"^share[\s_\-\.]*\(?%?\)?$"),
        _c("GROSS PREMIUM",     r"gross[\s_\-\.]*prem"),
        _c("R/I COM",           r"r[\./]?i[\s_\-\.]*com"),
        _c("DUE TO YOU",        r"due[\s_\-\.]*to[\s_\-\.]*you"),
        _c("POLICY NO.",        r"pol[i]?c[ey][\s_\-\.]*no\.?"),
        _c("STATEMENT NO.",     r"statement[\s_\-\.]*no"),
        _c("SLIP NUMBER",       r"slip[\s_\-\.]*num"),
    ],
))


# ══════════════════════════════════════════════════════════════
# 2. SHEET PRIORITY LOGIC
# ══════════════════════════════════════════════════════════════

PRIORITY_SHEETS = [
    re.compile(r"^all$",              re.IGNORECASE),
    re.compile(r"^sort[\s_\-]*by[\s_\-]*policy$", re.IGNORECASE),
    re.compile(r"^sort[\s_\-]*by[\s_\-]*name$",   re.IGNORECASE),
    re.compile(r"sort[\s_\-]*by[\s_\-]*tsi",       re.IGNORECASE),
]

def select_sheets(sheet_names: list[str]) -> list[str]:
    """
    Pilih sheet yang akan diproses berdasarkan aturan prioritas.
    Kembalikan list nama sheet (bisa lebih dari satu jika tidak ada yg prioritas).
    """
    for rx in PRIORITY_SHEETS:
        for name in sheet_names:
            if rx.match(name.strip()):
                return [name]
    # Tidak ada sheet prioritas → proses semua (kecuali Sheet2/Sheet3 kosong)
    return sheet_names


# ══════════════════════════════════════════════════════════════
# 3. FILE FILTER
# ══════════════════════════════════════════════════════════════

_SKIP_PREFIX = re.compile(r"^t(?!id)", re.IGNORECASE)

def should_skip_file(filename: str) -> bool:
    """
    Return True jika file harus di-skip.
    File berawalan 'T' di-skip, KECUALI berawalan 'TID'.
    """
    base = filename.split("/")[-1].split("\\")[-1]
    return bool(_SKIP_PREFIX.match(base))


# ══════════════════════════════════════════════════════════════
# 4. ROW CLEANING
# ══════════════════════════════════════════════════════════════

_TOTAL_RX = re.compile(r"\b(sub[\s_]?)?total\b", re.IGNORECASE)
_MIN_FILLED = 3   # baris dianggap valid jika minimal 3 sel terisi

def _is_junk_row(row: pd.Series, col_count: int) -> bool:
    """Return True jika baris ini harus dihapus."""
    values = [str(v).strip() for v in row if pd.notna(v) and str(v).strip() != ""]
    # Baris hampir kosong
    if len(values) < _MIN_FILLED:
        return True
    # Mengandung kata TOTAL / SUBTOTAL
    for v in values:
        if _TOTAL_RX.search(v):
            return True
    return False


def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Hapus baris sampah dari DataFrame."""
    col_count = len(df.columns)
    mask = df.apply(lambda row: not _is_junk_row(row, col_count), axis=1)
    return df[mask].reset_index(drop=True)


# ══════════════════════════════════════════════════════════════
# 5. TEMPLATE MATCHING + HEADER EXTRACTION
# ══════════════════════════════════════════════════════════════

@dataclass
class SheetParseResult:
    sheet_name:   str
    template_name: Optional[str]
    columns:      list[str]           # nama kolom final
    df:           pd.DataFrame        # data bersih


def _read_raw(xl: pd.ExcelFile, sheet: str) -> pd.DataFrame:
    return xl.parse(sheet, header=None, dtype=str)


def _find_header_row(df_raw: pd.DataFrame, min_cols: int = 4) -> int:
    """Cari baris pertama yang punya >= min_cols sel terisi."""
    for i, row in df_raw.iterrows():
        filled = [c for c in row if pd.notna(c) and str(c).strip() != ""]
        if len(filled) >= min_cols:
            return int(i)
    return 0


def _flatten_headers_single(df_raw: pd.DataFrame, header_row: int) -> list[str]:
    """Ambil header satu baris."""
    row = df_raw.iloc[header_row]
    return [str(v).strip() if pd.notna(v) else "" for v in row]


def _flatten_headers_double(df_raw: pd.DataFrame, header_row: int) -> list[tuple[str, str]]:
    """
    Ambil header dua baris.
    Return list of (row1_val, row2_val) per kolom.
    Forward-fill row1 untuk merged cells (NaN setelah merge).
    """
    row1 = df_raw.iloc[header_row]
    row2 = df_raw.iloc[header_row + 1] if header_row + 1 < len(df_raw) else pd.Series()
    result = []
    last_r1 = ""
    for i, v1 in enumerate(row1):
        v1s = str(v1).strip() if pd.notna(v1) else ""
        if v1s:
            last_r1 = v1s
        else:
            v1s = last_r1   # forward-fill merge
        v2s = str(row2.iloc[i]).strip() if i < len(row2) and pd.notna(row2.iloc[i]) else ""
        result.append((v1s, v2s))
    return result


def _match_template_to_headers(
    template: Template,
    headers_single: list[str],
    headers_double: Optional[list[tuple[str, str]]] = None,
) -> Optional[list[str]]:
    """
    Coba cocokkan template ke headers.
    Return list nama kolom final jika cocok, None jika tidak.
    """
    # Cek sig_cols
    if not template.sig_matches(headers_single):
        return None

    result: list[str] = []

    if template.double_header and headers_double:
        # Untuk setiap ColumnDef, cari kolom yang match di headers_double
        used: set[int] = set()
        for col_def in template.columns:
            found = False
            for idx, (h1, h2) in enumerate(headers_double):
                if idx in used:
                    continue
                if col_def.matches(h1):
                    if col_def.sub_row_pattern:
                        # butuh sub-row match juga
                        if col_def.sub_matches(h2):
                            result.append(col_def.name)
                            used.add(idx)
                            found = True
                            break
                    else:
                        result.append(col_def.name)
                        used.add(idx)
                        found = True
                        break
            if not found:
                result.append(col_def.name)  # tetap masukkan nama (nanti diisi kosong)
    else:
        used: set[int] = set()
        for col_def in template.columns:
            found = False
            for idx, h in enumerate(headers_single):
                if idx in used:
                    continue
                if col_def.matches(h):
                    result.append(col_def.name)
                    used.add(idx)
                    found = True
                    break
            if not found:
                result.append(col_def.name)

    return result


def _build_df_with_template(
    xl: pd.ExcelFile,
    sheet: str,
    template: Template,
) -> tuple[list[str], pd.DataFrame]:
    """
    Parse sheet dengan template, return (final_col_names, clean_df).
    """
    df_raw = _read_raw(xl, sheet)
    header_row = _find_header_row(df_raw)

    headers_single = _flatten_headers_single(df_raw, header_row)
    headers_double = None
    if template.double_header:
        headers_double = _flatten_headers_double(df_raw, header_row)

    # Map posisi kolom Excel → nama final dari template
    col_map: dict[int, str] = {}  # excel_col_idx -> final_name
    used_targets: set[str] = set()
    used_idx: set[int] = set()

    for col_def in template.columns:
        if template.double_header and headers_double:
            for idx, (h1, h2) in enumerate(headers_double):
                if idx in used_idx:
                    continue
                if col_def.matches(h1):
                    if col_def.sub_row_pattern:
                        if col_def.sub_matches(h2) and col_def.name not in used_targets:
                            col_map[idx] = col_def.name
                            used_targets.add(col_def.name)
                            used_idx.add(idx)
                            break
                    else:
                        if col_def.name not in used_targets:
                            col_map[idx] = col_def.name
                            used_targets.add(col_def.name)
                            used_idx.add(idx)
                            break
        else:
            for idx, h in enumerate(headers_single):
                if idx in used_idx:
                    continue
                if col_def.matches(h) and col_def.name not in used_targets:
                    col_map[idx] = col_def.name
                    used_targets.add(col_def.name)
                    used_idx.add(idx)
                    break

    # Tentukan baris data (setelah header)
    data_start = header_row + (2 if template.double_header else 1)
    df_data = df_raw.iloc[data_start:].reset_index(drop=True)

    # Buat DataFrame dengan kolom final
    final_cols = [col_def.name for col_def in template.columns]
    rows = []
    for _, raw_row in df_data.iterrows():
        row_dict = {name: "" for name in final_cols}
        for idx, name in col_map.items():
            if idx < len(raw_row):
                v = raw_row.iloc[idx]
                row_dict[name] = "" if pd.isna(v) else str(v).strip()
        rows.append(row_dict)

    df_out = pd.DataFrame(rows, columns=final_cols)
    df_out = clean_dataframe(df_out)
    return final_cols, df_out


def parse_sheet(xl: pd.ExcelFile, sheet: str) -> SheetParseResult:
    """
    Parse satu sheet: deteksi template, buat DataFrame bersih.
    """
    df_raw = _read_raw(xl, sheet)
    if df_raw.empty or len(df_raw) < 2:
        return SheetParseResult(
            sheet_name=sheet, template_name=None,
            columns=[], df=pd.DataFrame()
        )

    header_row = _find_header_row(df_raw)
    headers_single = _flatten_headers_single(df_raw, header_row)
    headers_double = _flatten_headers_double(df_raw, header_row)

    # Cari template yang cocok
    matched_template: Optional[Template] = None
    for tmpl in TEMPLATES:
        # Cek sheet hint dulu (lebih cepat)
        if not tmpl.sheet_matches(sheet):
            continue
        if tmpl.sig_matches(headers_single):
            matched_template = tmpl
            break

    # Fallback: tidak cek sheet hint, hanya sig_cols
    if not matched_template:
        for tmpl in TEMPLATES:
            if tmpl.sig_matches(headers_single):
                matched_template = tmpl
                break

    if matched_template:
        final_cols, df_clean = _build_df_with_template(xl, sheet, matched_template)
        return SheetParseResult(
            sheet_name=sheet,
            template_name=matched_template.name,
            columns=final_cols,
            df=df_clean,
        )

    # Tidak ada template cocok → fallback: auto-detect header
    df_fallback = xl.parse(sheet, header=header_row, dtype=str)
    df_fallback.columns = [str(c).strip() for c in df_fallback.columns]
    df_fallback = clean_dataframe(df_fallback)
    return SheetParseResult(
        sheet_name=sheet,
        template_name=None,
        columns=list(df_fallback.columns),
        df=df_fallback,
    )
