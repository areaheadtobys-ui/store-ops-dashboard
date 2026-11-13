"""
Build the QII Store x Brand Grid Matrix workbook from the brand sales export.

Usage:
    python build_brand_grid.py <source .xls/.xlsx> <output .xlsx>

The source is the "QII Franchise Brand Sales Performance" export: one sheet with
Store | Brand | GSALES LY | GSALES TY | ... | NSALES LY | NSALES TY | ...
Store total rows have Brand = "Total" or blank. The output workbook keeps all
logic in Excel formulas, so after the first build Merchandising maintains it by
editing Store_Master, Brand_Master, Overrides and Data directly.
"""
import sys
from collections import defaultdict

import pandas as pd
from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.comments import Comment
from openpyxl.formatting.rule import CellIsRule, ColorScaleRule, FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter as CL
from openpyxl.worksheet.datavalidation import DataValidation

SRC, OUT = sys.argv[1], sys.argv[2]
SRC_NAME = "QII_Franchise_Brand_Sales_Peformance_Jan_Nov_2026.xls"

# ----------------------------------------------------------------------------
# Reference settings (all editable later in the Settings sheet)
# ----------------------------------------------------------------------------
PRESENT, ABSENT, NA, UNV = "✓", "—", "N/A", "UNVERIFIED"
CONCEPT_MAP = [  # prefix, proposed concept, peer group, basis
    ("1011", "Toby's Sports", "Toby's Sports (1011 series)",
     "Largest group (46 codes); multi-sport assortment (Nike, Adidas, Core, Molten, Tobys Pro)."),
    ("2011", "Toby's Sports", "Toby's Sports (2011 series)",
     "Assortment mirrors 1011 series (Molten, Core, Tobys Pro, Yonex) at smaller scale; source file is titled 'Franchise'."),
    ("1021", "Runnr", "Runnr (1021 series)",
     "Codes RAC/RUC/RUN; running-specialist mix (Brooks, Hoka, On, Saucony, RUNNR)."),
    ("1031", "Urban Athletics", "Urban Athletics (1031 series)",
     "Codes UAC/UAF/UAO; lifestyle mix (Adidas, Nike, New Era, Skoop)."),
    ("1041", UNV, "1041 series (concept TBC)",
     "5 codes (BFM/BPD/BRM/BUP/BVN), mostly new in 2026; no brand-level rows in source. Concept unknown."),
]
CONCEPTS = ["Toby's Sports", "Runnr", "Urban Athletics", UNV]
AREAS = ["Central", "North", "South", "UNASSIGNED"]
PEER_ORDER = [c[2] for c in CONCEPT_MAP]
ALIASES = [  # source brand, standard brand, reason
    ("HOKA1", "HOKA", "Same brand; 'HOKA1' is a code variant. HOKA also appears as its own name in 2 stores."),
    ("BLACKDOG", "BLACK DOG", "Spacing variant of the same brand name."),
    ("NATUREHIKE", "NATURE HIKE", "Spacing variant of the same brand name (both in 1011TC1)."),
]
ALIAS = {a: b for a, b, _ in ALIASES}
POSSIBLE_DUPES = [  # not merged - need Merchandising confirmation
    ("UA", "UNDERARMOUR", "UA sells mainly in Urban Athletics stores (1031UAC/UAF); may be Under Armour or a house label. Not merged."),
    ("ROCKMOUNT", "ROCKY MOUNTS", "Similar names, never in the same store. Not merged."),
    ("SUPER", "SUPER K / SUPERBALL / SUPERFEET / SUPERSPORTS", "'SUPER' is a generic name with tiny sales (15 stores, TY 3,790); unclear which brand it is."),
    ("HEAD", "HEADWARE", "Different brands most likely (racket vs headwear). Not merged."),
    ("ADIDAS", "ADIDAS EE / ADIDAS PB / ADIDAS HARDWARE", "Kept as separate lines - may be sub-lines or separate distribution agreements."),
    ("NIKE", "NIKE SWIM", "Kept as separate lines - may be a separate license."),
    ("NBA", "NBA SOCKS", "Kept separate - may be separate licensees."),
    ("TOBYS", "TOBYS PRO / TOBYS LAB", "House-brand sub-lines kept separate."),
    ("EQUIPE", "EQUIPE APP", "Apparel sub-line kept separate."),
    ("ARROWS", "HARROWS", "Similar spelling; ARROWS has no TY sales (1 store). Not merged."),
]
TH = {"opp_pen": 0.5, "opp_min_carry": 2, "low_idx": 0.6, "high_idx": 1.25,
      "core": 0.75, "broad": 0.5, "selective": 0.2, "limited_n": 3, "cross_gap": 0.5}

# ----------------------------------------------------------------------------
# Load + profile source
# ----------------------------------------------------------------------------
raw = pd.read_excel(SRC, header=None)
hdr_row = raw.index[raw[0].astype(str).str.strip() == "Store"][0]
headers = [str(h).strip() for h in raw.iloc[hdr_row].tolist()]
body = raw.iloc[hdr_row + 1:].reset_index(drop=True)
body.columns = headers


def row_type(r):
    if str(r["Store"]).strip() == "Total":
        return "Grand Total"
    b = r["Brand"]
    if pd.isna(b) or str(b).strip() in ("", "Total"):
        return "Store Total"
    return "Brand"


body["Row Type"] = body.apply(row_type, axis=1)
br = body[body["Row Type"] == "Brand"].copy()
br["Store"] = br["Store"].astype(str).str.strip()
br["Brand"] = br["Brand"].astype(str).str.strip()
for c in ["GSALES LY", "GSALES TY", "NSALES LY", "NSALES TY"]:
    br[c] = pd.to_numeric(br[c], errors="coerce").fillna(0.0)
br["Std"] = br["Brand"].map(lambda b: ALIAS.get(b, b))

st_tot = body[body["Row Type"] == "Store Total"].copy()
st_tot["Store"] = st_tot["Store"].astype(str).str.strip()
st_tot = st_tot.set_index("Store")
stores_all = list(st_tot.index)
prefix_cfg = {p: (c, g) for p, c, g, _ in CONCEPT_MAP}
detail_any = set(br["Store"])
detail = set(br.loc[br["NSALES TY"] > 0, "Store"])  # brand rows with at least one positive TY sale


def peer(code):
    return prefix_cfg.get(code[:4], (UNV, code[:4]))[1]


stores = sorted(stores_all, key=lambda s: (PEER_ORDER.index(peer(s)) if peer(s) in PEER_ORDER else 99, s))
NS = len(stores)

# Python mirror of the status logic (used to rank brands, build the opportunity list and to verify)
key_status = {}
for (s, b), g in br.groupby(["Store", "Std"]):
    key_status[(s, b)] = PRESENT if (g["NSALES TY"] > 0).any() else UNV
brand_cnt = defaultdict(int)
for (s, b), v in key_status.items():
    if v == PRESENT:
        brand_cnt[b] += 1
brand_sales = br.groupby("Std")["NSALES TY"].sum()
brands = sorted(br["Std"].unique(), key=lambda b: (-brand_cnt[b], -brand_sales.get(b, 0), b))
NB = len(brands)
src_names = br.groupby("Std")["Brand"].apply(lambda s: ", ".join(sorted(set(s))))


def py_status(s, b):
    if s not in detail:
        return UNV
    return key_status.get((s, b), ABSENT)


def store_ly_ty(s):
    r = st_tot.loc[s]
    return float(pd.to_numeric(r["NSALES LY"], errors="coerce") or 0), float(pd.to_numeric(r["NSALES TY"], errors="coerce") or 0)


def store_status(s):
    ly, ty = store_ly_ty(s)
    if ty <= 0:
        return "No/negative TY sales - confirm status" if ly > 0 else "No positive sales LY or TY - confirm status"
    return "New in 2026 (no LY sales)" if ly <= 0 else "Active"


# ----------------------------------------------------------------------------
# Styles
# ----------------------------------------------------------------------------
F = "Arial"
NAVY, TEAL, LIGHT, MID = "1F3864", "2E75B6", "F2F2F2", "D9E1F2"
fnt = lambda **k: Font(name=F, **{"size": 10, **k})
FILL = lambda c: PatternFill("solid", start_color=c, end_color=c)
thin = Side(style="thin", color="BFBFBF")
BOX = Border(left=thin, right=thin, top=thin, bottom=thin)
CENTER = Alignment(horizontal="center", vertical="center")
WRAP = Alignment(wrap_text=True, vertical="top")
INPUT_FILL = FILL("FFF2CC")
G_FILL, G_FONT = FILL("C6EFCE"), Font(name=F, size=8, color="006100", bold=True)
X_FILL, X_FONT = FILL("E7E6E6"), Font(name=F, size=8, color="808080")
U_FILL, U_FONT = FILL("FFEB9C"), Font(name=F, size=8, color="9C5700")
N_FILL, N_FONT = FILL("FFFFFF"), Font(name=F, size=8, color="A6A6A6", italic=True)


def status_cf(ws, rng):
    ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=[f'"{PRESENT}"'], fill=G_FILL, font=G_FONT))
    ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=[f'"{ABSENT}"'], fill=X_FILL, font=X_FONT))
    ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=[f'"{UNV}"'], fill=U_FILL, font=U_FONT))
    ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=[f'"{NA}"'], fill=N_FILL, font=N_FONT))


def header(ws, row, col, labels, fill=NAVY, height=None, wrap=True):
    for i, t in enumerate(labels):
        c = ws.cell(row=row, column=col + i, value=t)
        c.font = fnt(bold=True, color="FFFFFF")
        c.fill = FILL(fill)
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=wrap)
        c.border = BOX
    if height:
        ws.row_dimensions[row].height = height


def title(ws, text, sub=None):
    ws["A1"] = text
    ws["A1"].font = fnt(size=16, bold=True, color=NAVY)
    if sub:
        ws["A2"] = sub
        ws["A2"].font = fnt(size=9, italic=True, color="595959")


def section(ws, cell, text):
    ws[cell] = text
    ws[cell].font = fnt(size=12, bold=True, color=TEAL)


def widths(ws, d):
    for k, v in d.items():
        ws.column_dimensions[k].width = v


def body_fmt(ws, r1, r2, c1, c2, numfmt=None, size=10):
    for r in range(r1, r2 + 1):
        for c in range(c1, c2 + 1):
            cell = ws.cell(row=r, column=c)
            cell.font = fnt(size=size)
            cell.border = BOX
            if numfmt:
                cell.number_format = numfmt


wb = Workbook()
wb.remove(wb.active)
order = ["README", "Dashboard", "Master_Grid", "Store_View", "Brand_View", "Heatmap", "Brand_Summary",
         "Store_Summary", "Opportunities", "Validation", "Store_Master", "Brand_Master", "Overrides",
         "Settings", "Data", "Source_Raw"]
S = {n: wb.create_sheet(n) for n in order}

# Shared range references -----------------------------------------------------
GR1, GR2 = 5, 4 + NS                      # grid store rows
GC1 = 8                                    # first brand column (H)
GC2 = GC1 + NB - 1
GL1, GL2 = CL(GC1), CL(GC2)
GRID = f"Master_Grid!${GL1}${GR1}:${GL2}${GR2}"
GHDR = f"Master_Grid!${GL1}$4:${GL2}$4"
G_CODE = f"Master_Grid!$A${GR1}:$A${GR2}"
G_CON = f"Master_Grid!$C${GR1}:$C${GR2}"
G_AREA = f"Master_Grid!$D${GR1}:$D${GR2}"
G_DET = f"Master_Grid!$E${GR1}:$E${GR2}"
G_TOT = f"Master_Grid!$F${GR1}:$F${GR2}"
G_UNV = f"Master_Grid!$G${GR1}:$G${GR2}"
SS1, SS2 = 2, 1 + NS                       # Store_Summary rows
SS = lambda c: f"Store_Summary!${c}${SS1}:${c}${SS2}"
BS1, BS2 = 2, 1 + NB                       # Brand_Summary rows
BSR = lambda c: f"Brand_Summary!${c}${BS1}:${c}${BS2}"
DMAX = 6000
D = lambda c: f"Data!${c}$2:${c}${DMAX}"
SM_N = 1 + NS
SM = lambda c: f"Store_Master!${c}$2:${c}${SM_N}"
OVR_N = 501
# Active filter criteria live in Settings!B32:B34
CRIT_C, CRIT_A, CRIT_CAT = "Settings!$B$32", "Settings!$B$33", "Settings!$B$34"

# ============================================================================
# Source_Raw  (verbatim copy of the export + derived Row Type)
# ============================================================================
ws = S["Source_Raw"]
cols = headers + ["Row Type"]
header(ws, 1, 1, cols, height=30)
for i, r in body.iterrows():
    for j, h in enumerate(cols):
        v = r[h]
        if isinstance(v, float) and pd.isna(v):
            v = None
        ws.cell(row=i + 2, column=j + 1, value=v)
NRAW = len(body) + 1
for r in range(2, NRAW + 1):
    for c in range(1, len(cols) + 1):
        ws.cell(row=r, column=c).font = fnt(size=9)
        if 3 <= c <= 24:
            ws.cell(row=r, column=c).number_format = "#,##0.00;(#,##0.00);-"
for c in (6, 8, 12, 16, 20, 24):
    for r in range(2, NRAW + 1):
        ws.cell(row=r, column=c).number_format = "0.0%"
ws.freeze_panes = "C2"
ws.auto_filter.ref = f"A1:{CL(len(cols))}{NRAW}"
widths(ws, {"A": 11, "B": 22, "Y": 13})
ws["Y1"].comment = Comment("Added column (not in the export): classifies each row as Grand Total, Store Total (brand blank or 'Total') or Brand.", "Builder")
RAW_TYPE = f"Source_Raw!$Y$2:$Y${NRAW}"
RAW_STORE = f"Source_Raw!$A$2:$A${NRAW}"
RAW_NLY = f"Source_Raw!$I$2:$I${NRAW}"
RAW_NTY = f"Source_Raw!$J$2:$J${NRAW}"

# ============================================================================
# Settings
# ============================================================================
ws = S["Settings"]
title(ws, "Settings & Reference Lists", "Blue text / yellow cells are editable inputs. Everything else is formula-driven.")
section(ws, "A3", "1. Store-code prefix → Retail concept (PROPOSED - please confirm)")
header(ws, 4, 1, ["Code Prefix", "Retail Concept", "Peer Group", "Basis for proposal", "Confirmation"])
for i, (p, c, g, basis) in enumerate(CONCEPT_MAP):
    r = 5 + i
    for j, v in enumerate([p, c, g, basis, "PROPOSED - CONFIRM"]):
        cell = ws.cell(row=r, column=1 + j, value=v)
        cell.font = fnt(color="0000FF" if j < 3 else "000000")
        cell.border = BOX
        cell.alignment = WRAP
        if j < 3 or j == 4:
            cell.fill = INPUT_FILL
CMAP = "Settings!$A$5:$C$12"
for r in range(10, 13):
    for c in range(1, 6):
        ws.cell(row=r, column=c).border = BOX
        ws.cell(row=r, column=c).fill = INPUT_FILL
ws["F5"] = "Rows 10-12 are spare for new prefixes."
ws["F5"].font = fnt(size=9, italic=True)

section(ws, "A14", "2. Brand name consolidation (Source Brand → Standard Brand)")
header(ws, 15, 1, ["Source Brand", "Standard Brand", "Reason"])
for i, (a, b, why) in enumerate(ALIASES):
    for j, v in enumerate([a, b, why]):
        cell = ws.cell(row=16 + i, column=1 + j, value=v)
        cell.font = fnt(color="0000FF" if j < 2 else "000000")
        cell.border = BOX
        cell.alignment = WRAP
for r in range(16 + len(ALIASES), 30):
    for c in range(1, 4):
        ws.cell(row=r, column=c).border = BOX
        ws.cell(row=r, column=c).fill = INPUT_FILL
ALIAS_RNG = "Settings!$A$16:$B$29"

section(ws, "A31", "3. Active filter criteria (driven by Dashboard - do not edit)")
for i, (lbl, f) in enumerate([
        ("Concept", '=IF(OR(Dashboard!$C$5="",Dashboard!$C$5="All"),"*",Dashboard!$C$5)'),
        ("Area", '=IF(OR(Dashboard!$C$6="",Dashboard!$C$6="All"),"*",Dashboard!$C$6)'),
        ("Brand Category", '=IF(OR(Dashboard!$C$7="",Dashboard!$C$7="All"),"*",Dashboard!$C$7)')]):
    ws.cell(row=32 + i, column=1, value=lbl).font = fnt(bold=True)
    ws.cell(row=32 + i, column=2, value=f).font = fnt()

section(ws, "A36", "4. Thresholds (edit to tune the analysis)")
header(ws, 37, 1, ["Parameter", "Value", "Meaning"])
TH_ROWS = [
    ("opp_pen", "Opportunity: min. peer-group penetration", "A store is flagged as a gap for a brand when at least this share of its peer group carries the brand."),
    ("opp_min_carry", "Opportunity: min. carrying peer stores", "...and at least this many peer stores carry it."),
    ("low_idx", "Assortment index - 'significantly below peers'", "Store brand count ÷ peer-group average below this = flagged."),
    ("high_idx", "Assortment index - 'above peers'", "Store brand count ÷ peer-group average at or above this."),
    ("core", "Tier: Core (≥)", "Brand carried in at least this share of applicable stores in view."),
    ("broad", "Tier: Broad (≥)", ""),
    ("selective", "Tier: Selective (≥)", "Below this (but >0) = Limited."),
    ("limited_n", "Limited distribution: max. stores", "Brands carried in 1..N stores are listed as 'limited distribution'."),
    ("cross_gap", "Cross-concept gap (penetration spread ≥)", "Heatmap flag when a brand's penetration differs by this much between concepts/peer groups."),
]
TH_CELL = {}
for i, (k, lbl, mean) in enumerate(TH_ROWS):
    r = 38 + i
    ws.cell(row=r, column=1, value=lbl).font = fnt()
    c = ws.cell(row=r, column=2, value=TH[k])
    c.font = fnt(color="0000FF")
    c.fill = INPUT_FILL
    c.number_format = "0" if k in ("opp_min_carry", "limited_n") else ("0.00" if "idx" in k else "0%")
    ws.cell(row=r, column=3, value=mean).font = fnt(size=9)
    TH_CELL[k] = f"Settings!$B${r}"

section(ws, "G3", "5. Drop-down lists")
lists = {
    "G": ("Concepts", CONCEPTS),
    "H": ("Areas", AREAS),
    "I": ("Status codes", [PRESENT, ABSENT, NA, UNV]),
    "J": ("Brand Categories (add yours)", ["UNCATEGORIZED"] + [None] * 29),
    "K": ("Filter: Concept", ["All"] + CONCEPTS),
    "L": ("Filter: Area", ["All"] + AREAS),
    "M": ("Opportunity decision", ["For review", "Approved for planning", "Not suitable", "Deferred"]),
}
for col, (lbl, vals) in lists.items():
    header(ws, 4, ord(col) - 64, [lbl])
    for i, v in enumerate(vals):
        c = ws[f"{col}{5 + i}"]
        c.value = v
        c.font = fnt(color="0000FF")
        c.border = BOX
        if col == "J":
            c.fill = INPUT_FILL
ws["N4"] = "Filter: Category"
header(ws, 4, 14, ["Filter: Category"])
ws["N5"] = "All"
for i in range(30):
    ws[f"N{6 + i}"] = f'=IF(J{5 + i}="","",J{5 + i})'
widths(ws, {"A": 34, "B": 22, "C": 30, "D": 60, "E": 22, "F": 4, "G": 16, "H": 13, "I": 12, "J": 26, "K": 16, "L": 13, "M": 22, "N": 18})

# ============================================================================
# Store_Master
# ============================================================================
ws = S["Store_Master"]
cols = ["Store Code", "Store Name", "Code Prefix", "Retail Concept", "Concept Override", "Area",
        "Peer Group", "Brand Data in Source", "Net Sales Jan-Nov 2025", "Net Sales Jan-Nov 2026",
        "Store Status (from sales)", "Display Name", "Notes"]
header(ws, 1, 1, cols, height=32)
for i, s in enumerate(stores):
    r = 2 + i
    ws.cell(row=r, column=1, value=s)
    ws.cell(row=r, column=2, value=None)
    ws.cell(row=r, column=3, value=f"=LEFT(A{r},4)")
    ws.cell(row=r, column=4, value=f'=IF(E{r}<>"",E{r},IFERROR(VLOOKUP(C{r},{CMAP},2,FALSE),"{UNV}"))')
    ws.cell(row=r, column=6, value="UNASSIGNED")
    ws.cell(row=r, column=7, value=f'=IFERROR(VLOOKUP(C{r},{CMAP},3,FALSE),C{r}&" series")')
    ws.cell(row=r, column=8, value=f'=IF(COUNTIF({D("A")},A{r})=0,"No",IF(COUNTIFS({D("A")},A{r},{D("F")},">0")=0,"No TY sales","Yes"))')
    ws.cell(row=r, column=9, value=f'=SUMIFS({RAW_NLY},{RAW_STORE},A{r},{RAW_TYPE},"Store Total")')
    ws.cell(row=r, column=10, value=f'=SUMIFS({RAW_NTY},{RAW_STORE},A{r},{RAW_TYPE},"Store Total")')
    ws.cell(row=r, column=11, value=f'=IF(J{r}<=0,IF(I{r}>0,"No/negative TY sales - confirm status","No positive sales LY or TY - confirm status"),IF(I{r}<=0,"New in 2026 (no LY sales)","Active"))')
    ws.cell(row=r, column=12, value=f'=IF(B{r}="","(name pending)",B{r})')
body_fmt(ws, 2, SM_N, 1, 13)
for r in range(2, SM_N + 1):
    for c in (1, 2, 5, 6, 13):
        ws.cell(row=r, column=c).font = fnt(color="0000FF")
    for c in (2, 5, 6):
        ws.cell(row=r, column=c).fill = INPUT_FILL
    for c in (9, 10):
        ws.cell(row=r, column=c).number_format = "#,##0;(#,##0);-"
dv = DataValidation(type="list", formula1="=Settings!$H$5:$H$8", allow_blank=True)
dv.add(f"F2:F{SM_N + 200}")
dv2 = DataValidation(type="list", formula1="=Settings!$G$5:$G$8", allow_blank=True)
dv2.add(f"E2:E{SM_N + 200}")
ws.add_data_validation(dv)
ws.add_data_validation(dv2)
ws.freeze_panes = "B2"
ws.auto_filter.ref = f"A1:M{SM_N}"
widths(ws, {"A": 11, "B": 28, "C": 8, "D": 17, "E": 15, "F": 12, "G": 28, "H": 10, "I": 15, "J": 15, "K": 36, "L": 22, "M": 30})
ws["B1"].comment = Comment("Store names are NOT in the source sales file. Enter them from the official store masterlist.", "Builder")
ws["F1"].comment = Comment("Area is NOT in the source sales file. Choose Central / North / South.", "Builder")
ws["H1"].comment = Comment("Yes = brand-level rows exist with at least one positive TY sale. No = only a store total in the source. No TY sales = brand rows exist but none sold in 2026 (store possibly closed). Only 'Yes' stores are evaluated; others show UNVERIFIED.", "Builder")
ws["D1"].comment = Comment("Proposed from code prefix via Settings section 1. To override a single store, use 'Concept Override'.", "Builder")

# ============================================================================
# Brand_Master
# ============================================================================
ws = S["Brand_Master"]
header(ws, 1, 1, ["Standard Brand", "Brand Category", "Source Brand Name(s)", "Stores ✓ (all)", "Notes"], height=30)
for i, b in enumerate(brands):
    r = 2 + i
    ws.cell(row=r, column=1, value=b)
    ws.cell(row=r, column=2, value="UNCATEGORIZED")
    ws.cell(row=r, column=3, value=src_names.get(b, b))
    ws.cell(row=r, column=4, value=f"=INDEX(Master_Grid!${GL1}$3:${GL2}$3,ROW()-1)")
body_fmt(ws, 2, 1 + NB, 1, 5)
for r in range(2, 2 + NB):
    ws.cell(row=r, column=2).fill = INPUT_FILL
    ws.cell(row=r, column=2).font = fnt(color="0000FF")
dv = DataValidation(type="list", formula1="=Settings!$J$5:$J$34", allow_blank=True)
dv.add(f"B2:B{NB + 300}")
ws.add_data_validation(dv)
ws.freeze_panes = "B2"
ws.auto_filter.ref = f"A1:E{NB + 1}"
widths(ws, {"A": 24, "B": 22, "C": 34, "D": 12, "E": 40})
ws["B1"].comment = Comment("Brand category is NOT in the source file. Add categories to Settings column J, then assign here.", "Builder")
ws["A1"].comment = Comment("Order = widest distribution first (at build time). The Master Grid columns follow this list.", "Builder")

# ============================================================================
# Overrides  (store-specific confirmations + concept-level N/A scope)
# ============================================================================
ws = S["Overrides"]
title(ws, "Status Overrides & Brand Scope", None)
ws["A2"] = ("Use this sheet to record CONFIRMED information. A store-level override always wins over the sales data. "
            f"Example of the expected format (not a live row): Store Code 1011ANG | Brand ASICS | Status {ABSENT} | Reason "
            "'Not listed per 2027 assortment plan' | Confirmed By 'Merch - J. Cruz' | Date 2026-11-20.")
ws["A2"].font = fnt(size=9, italic=True)
ws["A2"].alignment = WRAP
ws.merge_cells("A2:K2")
ws.row_dimensions[2].height = 42
OV_HDR = 4
header(ws, OV_HDR, 1, ["Key (auto)", "Store Code", "Brand (standard name)", "Status", "Reason / Source", "Confirmed By", "Date"])
for r in range(OV_HDR + 1, OV_HDR + OVR_N):
    ws.cell(row=r, column=1, value=f'=IF(OR(B{r}="",C{r}=""),"",B{r}&"|"&C{r})').font = fnt(size=9, color="808080")
    for c in range(2, 8):
        ws.cell(row=r, column=c).fill = INPUT_FILL
        ws.cell(row=r, column=c).font = fnt(color="0000FF")
        ws.cell(row=r, column=c).border = BOX
OV1, OV2 = OV_HDR + 1, OV_HDR + OVR_N - 1
OV_KEY, OV_ST = f"Overrides!$A${OV1}:$A${OV2}", f"Overrides!$D${OV1}:$D${OV2}"
for rng, f in [(f"B{OV1}:B{OV2}", f"=Store_Master!$A$2:$A${SM_N + 100}"),
               (f"C{OV1}:C{OV2}", f"=Brand_Master!$A$2:$A${NB + 300}"),
               (f"D{OV1}:D{OV2}", "=Settings!$I$5:$I$8")]:
    dv = DataValidation(type="list", formula1=f, allow_blank=True)
    dv.add(rng)
    ws.add_data_validation(dv)
header(ws, OV_HDR, 9, ["Concept", "Brand (standard name)", "Reason brand is N/A for this concept"])
ws.cell(row=3, column=9, value="Concept-level scope: brands listed here show N/A (not applicable) for every store of that concept that has no sales record of it.").font = fnt(size=9, italic=True)
for r in range(OV1, OV1 + 200):
    for c in range(9, 12):
        ws.cell(row=r, column=c).fill = INPUT_FILL
        ws.cell(row=r, column=c).font = fnt(color="0000FF")
        ws.cell(row=r, column=c).border = BOX
SC_CON, SC_BR = f"Overrides!$I${OV1}:$I${OV1 + 199}", f"Overrides!$J${OV1}:$J${OV1 + 199}"
for rng, f in [(f"I{OV1}:I{OV1 + 199}", "=Settings!$G$5:$G$7"), (f"J{OV1}:J{OV1 + 199}", f"=Brand_Master!$A$2:$A${NB + 300}")]:
    dv = DataValidation(type="list", formula1=f, allow_blank=True)
    dv.add(rng)
    ws.add_data_validation(dv)
ws.freeze_panes = f"A{OV1}"
widths(ws, {"A": 22, "B": 12, "C": 22, "D": 12, "E": 36, "F": 18, "G": 12, "H": 3, "I": 17, "J": 22, "K": 40})

# ============================================================================
# Data  (brand-level rows + formula helpers)
# ============================================================================
ws = S["Data"]
cols = ["Store Code", "Source Brand", "Gross Sales Jan-Nov 2025", "Gross Sales Jan-Nov 2026", "Net Sales Jan-Nov 2025", "Net Sales Jan-Nov 2026",
        "Standard Brand", "Key", "Store-Brand Status", "Concept", "Area", "Peer Group"]
header(ws, 1, 1, cols, height=30)
ND = 1 + len(br)
for i, (_, r) in enumerate(br.iterrows()):
    rr = 2 + i
    ws.cell(row=rr, column=1, value=r["Store"])
    ws.cell(row=rr, column=2, value=r["Brand"])
    ws.cell(row=rr, column=3, value=float(r["GSALES LY"]))
    ws.cell(row=rr, column=4, value=float(r["GSALES TY"]))
    ws.cell(row=rr, column=5, value=float(r["NSALES LY"]))
    ws.cell(row=rr, column=6, value=float(r["NSALES TY"]))
    ws.cell(row=rr, column=7, value=f"=IFERROR(VLOOKUP(B{rr},{ALIAS_RNG},2,FALSE),B{rr})")
    ws.cell(row=rr, column=8, value=f'=A{rr}&"|"&G{rr}')
    ws.cell(row=rr, column=9, value=f'=IF(COUNTIFS({D("H")},H{rr},{D("F")},">0")>0,"{PRESENT}","{UNV}")')
    ws.cell(row=rr, column=10, value=f'=IFERROR(INDEX({SM("D")},MATCH(A{rr},{SM("A")},0)),"{UNV}")')
    ws.cell(row=rr, column=11, value=f'=IFERROR(INDEX({SM("F")},MATCH(A{rr},{SM("A")},0)),"UNASSIGNED")')
    ws.cell(row=rr, column=12, value=f'=IFERROR(INDEX({SM("G")},MATCH(A{rr},{SM("A")},0)),"")')
for r in range(2, ND + 1):
    for c in range(1, 13):
        cell = ws.cell(row=r, column=c)
        cell.font = fnt(size=9, color="0000FF" if c <= 6 else "000000")
        if 3 <= c <= 6:
            cell.number_format = "#,##0.00;(#,##0.00);-"
status_cf(ws, f"I2:I{ND}")
ws.freeze_panes = "C2"
ws.auto_filter.ref = f"A1:L{ND}"
widths(ws, {"A": 11, "B": 22, "C": 14, "D": 14, "E": 14, "F": 14, "G": 22, "H": 30, "I": 12, "J": 16, "K": 12, "L": 28})
ws["I1"].comment = Comment(f"{PRESENT} if any row for this store + standard brand has Net Sales Jan-Nov 2026 > 0; otherwise {UNV} (sold LY only, or zero/negative TY).", "Builder")

# ============================================================================
# Master_Grid
# ============================================================================
ws = S["Master_Grid"]
ws["A1"] = "QII Store × Brand Master Grid  |  Period: January - November 2026"
ws["A1"].font = fnt(size=16, bold=True, color=NAVY)
ws["A2"] = (f"{PRESENT} = carried (net sales > 0, Jan-Nov 2026)   {ABSENT} = no sales record LY or TY in a store with full brand data   "
            f"{UNV} = not confirmed (sold LY only / zero or negative TY / store has no brand-level data)   {NA} = out of scope (Overrides sheet)")
ws["A2"].font = fnt(size=9, italic=True, color="595959")
ws["F3"] = "Stores ✓ →"
ws["F3"].font = fnt(bold=True, size=9)
ws["F3"].alignment = Alignment(horizontal="right")
header(ws, 4, 1, ["Store Code", "Store Name", "Retail Concept", "Area", "Brand Data", "Brands ✓", "Unverified"], height=120)
for j in range(NB):
    c = GC1 + j
    L = CL(c)
    ws.cell(row=3, column=c, value=f'=COUNTIF({L}{GR1}:{L}{GR2},"{PRESENT}")')
    ws.cell(row=3, column=c).font = fnt(size=8, bold=True)
    ws.cell(row=3, column=c).alignment = CENTER
    h = ws.cell(row=4, column=c, value=f"=INDEX(Brand_Master!$A$2:$A${NB + 300},{j + 1})")
    h.font = fnt(size=8, bold=True, color="FFFFFF")
    h.fill = FILL(NAVY)
    h.alignment = Alignment(text_rotation=90, horizontal="center", vertical="bottom")
    h.border = BOX
    ws.column_dimensions[L].width = 9.5
for i in range(NS):
    r = GR1 + i
    m = 2 + i
    ws.cell(row=r, column=1, value=f"=Store_Master!A{m}")
    ws.cell(row=r, column=2, value=f"=Store_Master!L{m}")
    ws.cell(row=r, column=3, value=f"=Store_Master!D{m}")
    ws.cell(row=r, column=4, value=f"=Store_Master!F{m}")
    ws.cell(row=r, column=5, value=f"=Store_Master!H{m}")
    ws.cell(row=r, column=6, value=f'=COUNTIF({GL1}{r}:{GL2}{r},"{PRESENT}")')
    ws.cell(row=r, column=7, value=f'=COUNTIF({GL1}{r}:{GL2}{r},"{UNV}")')
    for c in range(1, 8):
        cell = ws.cell(row=r, column=c)
        cell.font = fnt(size=9, bold=(c in (1, 6)))
        cell.border = BOX
        if c >= 5:
            cell.alignment = CENTER
    for j in range(NB):
        c = GC1 + j
        L = CL(c)
        k = f'$A{r}&"|"&{L}$4'
        f = (f'=IFERROR(INDEX({OV_ST},MATCH({k},{OV_KEY},0)),'
             f'IF($E{r}<>"Yes","{UNV}",'
             f'IFERROR(INDEX({D("I")},MATCH({k},{D("H")},0)),'
             f'IF(COUNTIFS({SC_CON},$C{r},{SC_BR},{L}$4)>0,"{NA}","{ABSENT}"))))')
        cell = ws.cell(row=r, column=c, value=f)
        cell.font = Font(name=F, size=8)
        cell.alignment = CENTER
        cell.border = BOX
status_cf(ws, f"{GL1}{GR1}:{GL2}{GR2}")
ws.conditional_formatting.add(f"F{GR1}:F{GR2}", ColorScaleRule(start_type="min", start_color="FFFFFF", end_type="max", end_color="63BE7B"))
ws.conditional_formatting.add(f"{GL1}3:{GL2}3", ColorScaleRule(start_type="min", start_color="FFFFFF", end_type="max", end_color="63BE7B"))
ws.freeze_panes = f"{GL1}{GR1}"
ws.auto_filter.ref = f"A4:{GL2}{GR2}"
widths(ws, {"A": 10, "B": 16, "C": 15, "D": 11, "E": 7, "F": 7.5, "G": 9})

# ============================================================================
# Dashboard
# ============================================================================
ws = S["Dashboard"]
ws.sheet_view.showGridLines = False
widths(ws, {"A": 2, "B": 24, "C": 18, "D": 14, "E": 12, "F": 12, "G": 3, "H": 24, "I": 18, "J": 14, "K": 12, "L": 12, "M": 3, "N": 24, "O": 14, "P": 14, "Q": 14})
ws["B2"] = "QII Store × Brand Distribution Dashboard  |  January - November 2026"
ws["B2"].font = fnt(size=18, bold=True, color=NAVY)
ws["B3"] = f"Period: January - November 2026 (TY) vs January - November 2025 (LY)  |  Source: {SRC_NAME}  |  Presence = positive net sales Jan - Nov 2026. Change the yellow filters; everything below recalculates."
ws["B3"].font = fnt(size=9, italic=True, color="595959")
for i, (lbl, src) in enumerate([("Retail Concept", "=Settings!$K$5:$K$9"), ("Area", "=Settings!$L$5:$L$9"),
                                 ("Brand Category", "=Settings!$N$5:$N$35")]):
    r = 5 + i
    ws.cell(row=r, column=2, value=lbl).font = fnt(bold=True)
    c = ws.cell(row=r, column=3, value="All")
    c.fill = FILL("FFD966")
    c.font = fnt(bold=True, color="0000FF")
    c.border = BOX
    dv = DataValidation(type="list", formula1=src, allow_blank=False)
    dv.add(f"C{r}")
    ws.add_data_validation(dv)
ws["D5"] = "◄ filters (drop-downs)"
ws["D5"].font = fnt(size=9, italic=True, color="808080")
ws["D7"] = "Brand Category applies to brand lists; store brand counts always include all brands."
ws["D7"].font = fnt(size=8, italic=True, color="808080")
for i, (txt, tgt) in enumerate([("► Master Grid", "Master_Grid"), ("► Store View (pick a store)", "Store_View"),
                                 ("► Brand View (pick a brand)", "Brand_View"), ("► Heatmap", "Heatmap"),
                                 ("► Opportunities", "Opportunities"), ("► Data Validation", "Validation")]):
    c = ws.cell(row=5 + i % 3, column=14 + (i // 3) * 2, value=txt)
    c.hyperlink = f"#{tgt}!A1"
    c.font = fnt(color="0563C1", underline="single")

# KPI tiles
crit = f"{G_CON},{CRIT_C},{G_AREA},{CRIT_A}"
kpis = [
    ("Stores in view", f"=COUNTIFS({crit})", "0"),
    ("Stores with brand-level data", f'=COUNTIFS({crit},{G_DET},"Yes")', "0"),
    ("Brands in scope (category)", f"=COUNTIF({BSR('O')},TRUE)", "0"),
    ("Brands carried (≥1 store)", f'=COUNTIFS({BSR("O")},TRUE,{BSR("G")},">0")', "0"),
    ("Avg brands per store", f'=IFERROR(AVERAGEIFS({G_TOT},{crit},{G_DET},"Yes"),0)', "0.0"),
    ("Store-brand presences ✓", f"=SUMIFS({G_TOT},{crit})", "#,##0"),
    ("Unverified store-brand cells", f"=SUMIFS({G_UNV},{crit})", "#,##0"),
]
kcols = [2, 3, 4, 5, 6, 8, 9]
kpos = [(9, 2), (9, 4), (9, 6), (9, 8), (9, 10), (9, 12), (9, 14)]
kpos = [(9, 2), (9, 3), (9, 4), (9, 5), (9, 6), (9, 8), (9, 9)]
# Lay tiles across B..Q using pairs of label/value rows
tile_cols = ["B", "C", "D", "E", "H", "I", "J"]
tile_cols = ["B", "C", "D", "E", "F", "H", "I"]
for (lbl, f, nf), col in zip(kpis, ["B", "C", "D", "E", "F", "H", "I"]):
    lc = ws[f"{col}9"]
    lc.value = lbl
    lc.font = fnt(size=8, bold=True, color="FFFFFF")
    lc.fill = FILL(TEAL)
    lc.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    vc = ws[f"{col}10"]
    vc.value = f
    vc.font = fnt(size=18, bold=True, color=NAVY)
    vc.fill = FILL(MID)
    vc.alignment = CENTER
    vc.number_format = nf
ws.row_dimensions[9].height = 30
ws.row_dimensions[10].height = 34
ws["J9"] = "Coverage rate"
ws["J9"].font = fnt(size=8, bold=True, color="FFFFFF")
ws["J9"].fill = FILL(TEAL)
ws["J9"].alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
ws["J10"] = "=IFERROR(H10/(C10*D10),0)"
ws["J10"].font = fnt(size=18, bold=True, color=NAVY)
ws["J10"].fill = FILL(MID)
ws["J10"].alignment = CENTER
ws["J10"].number_format = "0.0%"
ws["J10"].comment = Comment("Presences ÷ (stores with brand data × brands in scope). Share of all possible store-brand combinations that are active.", "Builder")
ws["K9"] = "Assortment gaps flagged"
ws["K9"].font = fnt(size=8, bold=True, color="FFFFFF")
ws["K9"].fill = FILL(TEAL)
ws["K9"].alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
ws["K10"] = f'=COUNTIFS(Opportunities!$P$6:$P$5000,TRUE,Opportunities!$L$6:$L$5000,"<>Closed")'
ws["K10"].font = fnt(size=18, bold=True, color="C00000")
ws["K10"].fill = FILL(MID)
ws["K10"].alignment = CENTER
ws["K10"].number_format = "#,##0"
ws.merge_cells("K9:L9")
ws.merge_cells("K10:L10")

# --- A. Store summary ---
section(ws, "B12", "A. Store Summary")
ws["B13"] = "Stores per retail concept × area"
ws["B13"].font = fnt(bold=True, size=10)
header(ws, 14, 2, ["Retail Concept"] + AREAS + ["Total"])
for i, cpt in enumerate(CONCEPTS + ["Total"]):
    r = 15 + i
    ws.cell(row=r, column=2, value=cpt).font = fnt(bold=(cpt == "Total"))
    for j, a in enumerate(AREAS + ["Total"]):
        c = 3 + j
        cc = '"*"' if cpt == "Total" else f"$B{r}"
        aa = '"*"' if a == "Total" else f"{CL(c)}$14"
        ws.cell(row=r, column=c, value=f"=COUNTIFS({G_CON},{cc},{G_AREA},{aa})")
body_fmt(ws, 15, 19, 2, 7, "0")
for c in range(2, 8):
    ws.cell(row=19, column=c).font = fnt(bold=True)
    ws.cell(row=19, column=c).fill = FILL(LIGHT)

ws["B21"] = "Assortment by peer group (area filter applied)"
ws["B21"].font = fnt(bold=True)
header(ws, 22, 2, ["Peer Group", "Stores", "With brand data", "Avg brands", "Max", "Min"], height=30)
for i, pg in enumerate(PEER_ORDER):
    r = 23 + i
    ws.cell(row=r, column=2, value=pg)
    ws.cell(row=r, column=3, value=f"=COUNTIFS({SS('E')},B{r},{SS('D')},{CRIT_A})")
    ws.cell(row=r, column=4, value=f'=COUNTIFS({SS("E")},B{r},{SS("D")},{CRIT_A},{SS("F")},"Yes")')
    ws.cell(row=r, column=5, value=f'=IFERROR(AVERAGEIFS({SS("G")},{SS("E")},B{r},{SS("D")},{CRIT_A},{SS("F")},"Yes"),"-")')
    ws.cell(row=r, column=6, value=f'=IF(D{r}=0,"-",_xlfn.MAXIFS({SS("G")},{SS("E")},B{r},{SS("D")},{CRIT_A},{SS("F")},"Yes"))')
    ws.cell(row=r, column=7, value=f'=IF(D{r}=0,"-",_xlfn.MINIFS({SS("G")},{SS("E")},B{r},{SS("D")},{CRIT_A},{SS("F")},"Yes"))')
body_fmt(ws, 23, 22 + len(PEER_ORDER), 2, 7, "0")
for r in range(23, 23 + len(PEER_ORDER)):
    ws.cell(row=r, column=5).number_format = "0.0"
    ws.cell(row=r, column=2).font = fnt(size=9)

TOPR = 30
ws.cell(row=TOPR - 1, column=2, value="Widest brand assortment - Top 10 stores").font = fnt(bold=True)
ws.cell(row=TOPR - 1, column=8, value="Lowest brand assortment - Bottom 10 stores").font = fnt(bold=True)
header(ws, TOPR, 2, ["Store Code", "Store Name", "Concept", "Brands ✓", "vs Peer avg"])
header(ws, TOPR, 8, ["Store Code", "Store Name", "Concept", "Brands ✓", "vs Peer avg"])
for k in range(1, 11):
    r = TOPR + k
    for base, fn, sc, bad in ((2, "LARGE", "Q", "<0"), (8, "SMALL", "R", ">=1E9")):
        key = f"{fn}({SS(sc)},{k})"
        m = f"MATCH({key},{SS(sc)},0)"
        guard = f'IF({key}{bad},""'
        for j, colx in enumerate(["A", "B", "C", "G", "J"]):
            ws.cell(row=r, column=base + j, value=f"={guard},INDEX({SS(colx)},{m}))")
body_fmt(ws, TOPR + 1, TOPR + 10, 2, 6, size=9)
body_fmt(ws, TOPR + 1, TOPR + 10, 8, 12, size=9)
for r in range(TOPR + 1, TOPR + 11):
    for c in (6, 12):
        ws.cell(row=r, column=c).number_format = "0.00x"
ws.cell(row=TOPR + 11, column=2, value="Ranked among stores in view that have brand-level data. 'vs Peer avg' = brands ÷ peer-group average.").font = fnt(size=8, italic=True, color="808080")

# --- B. Brand distribution ---
BR0 = 44
section(ws, f"B{BR0}", "B. Brand Distribution Summary")
ws.cell(row=BR0 + 1, column=2, value="Widest distribution - Top 15 brands (in view)").font = fnt(bold=True)
header(ws, BR0 + 2, 2, ["Brand", "Category", "Stores ✓", "% of applicable", "Tier"])
for k in range(1, 16):
    r = BR0 + 2 + k
    key = f"LARGE({BSR('P')},{k})"
    m = f"MATCH({key},{BSR('P')},0)"
    for j, colx in enumerate(["A", "B", "G", "I", "K"]):
        ws.cell(row=r, column=2 + j, value=f'=IF({key}<0,"",INDEX({BSR(colx)},{m}))')
body_fmt(ws, BR0 + 3, BR0 + 17, 2, 6, size=9)
for r in range(BR0 + 3, BR0 + 18):
    ws.cell(row=r, column=5).number_format = "0%"
ws.conditional_formatting.add(f"E{BR0 + 3}:E{BR0 + 17}", ColorScaleRule(start_type="num", start_value=0, start_color="FFFFFF", end_type="num", end_value=1, end_color="63BE7B"))

ws.cell(row=BR0 + 1, column=8, value="Limited distribution, strongest sales per store").font = fnt(bold=True)
header(ws, BR0 + 2, 8, ["Brand", "Stores ✓", "Net Sales Jan-Nov 2026", "Sales / carrying store", "Tier"], height=30)
for k in range(1, 16):
    r = BR0 + 2 + k
    key = f"LARGE({BSR('Q')},{k})"
    m = f"MATCH({key},{BSR('Q')},0)"
    for j, colx in enumerate(["A", "G", "L", "N", "K"]):
        ws.cell(row=r, column=8 + j, value=f'=IF({key}<0,"",INDEX({BSR(colx)},{m}))')
body_fmt(ws, BR0 + 3, BR0 + 17, 8, 12, size=9)
for r in range(BR0 + 3, BR0 + 18):
    ws.cell(row=r, column=10).number_format = "#,##0"
    ws.cell(row=r, column=11).number_format = "#,##0"
ws.cell(row=BR0 + 18, column=8, value="=\"Brands carried in 1 to \"&" + TH_CELL["limited_n"] + "&\" stores in view, ranked by net sales Jan-Nov 2026 per carrying store - candidates to review for wider distribution.\"").font = fnt(size=8, italic=True, color="808080")

ws.cell(row=BR0 + 1, column=14, value="Brands by distribution tier").font = fnt(bold=True)
header(ws, BR0 + 2, 14, ["Tier", "Brands", "Rule"])
tiers = [("Core", f'="≥ "&TEXT({TH_CELL["core"]},"0%")&" of stores"'),
         ("Broad", f'=TEXT({TH_CELL["broad"]},"0%")&" - "&TEXT({TH_CELL["core"]},"0%")'),
         ("Selective", f'=TEXT({TH_CELL["selective"]},"0%")&" - "&TEXT({TH_CELL["broad"]},"0%")'),
         ("Limited", f'="> 0% - "&TEXT({TH_CELL["selective"]},"0%")'),
         ("Not carried", '="0 stores in view"'),
         ("No data", '="No stores with brand data in view"')]
for i, (t, rule) in enumerate(tiers):
    r = BR0 + 3 + i
    ws.cell(row=r, column=14, value=t)
    ws.cell(row=r, column=15, value=f'=COUNTIFS({BSR("K")},N{r},{BSR("O")},TRUE)')
    ws.cell(row=r, column=16, value=rule)
body_fmt(ws, BR0 + 3, BR0 + 8, 14, 16, size=9)

# --- C. Distribution analysis (formula-driven insight lines) ---
C0 = BR0 + 21
section(ws, f"B{C0}", "C. Distribution Analysis (auto-generated from current filters)")
lines = [
    f'="• "&O{BR0 + 3}&" brands are Core (in ≥"&TEXT({TH_CELL["core"]},"0%")&" of applicable stores) and "&O{BR0 + 4}&" are Broad - the backbone assortment of the stores in view."',
    f'="• "&COUNTIFS({BSR("O")},TRUE,{BSR("G")},">=1",{BSR("G")},"<="&{TH_CELL["limited_n"]})&" brands are available in only 1-"&{TH_CELL["limited_n"]}&" stores; "&O{BR0 + 7}&" brands in scope have no confirmed store in view."',
    f'="• Widest-distributed brand: "&B{BR0 + 3}&" ("&D{BR0 + 3}&" stores, "&TEXT(E{BR0 + 3},"0%")&"). Widest store assortment: "&B{TOPR + 1}&" ("&E{TOPR + 1}&" brands); narrowest: "&H{TOPR + 1}&" ("&K{TOPR + 1}&" brands)."',
    f'="• "&COUNTIFS({SS("O")},"Significantly below peers",{SS("P")},TRUE)&" stores carry significantly fewer brands than their peer group (index < "&TEXT({TH_CELL["low_idx"]},"0.00")&") - see Store_Summary."',
    f'="• "&K10&" store-brand gaps are flagged for review where ≥"&TEXT({TH_CELL["opp_pen"]},"0%")&" of the peer group carries the brand - see Opportunities. These are review candidates, not automatic recommendations."',
    f'="• "&COUNTIFS({crit},{G_DET},"<>Yes")&" stores in view have no evaluable brand-level rows in the source (all brands show {UNV}); "&TEXT(H10,"#,##0")&" presences confirmed vs "&TEXT(I10,"#,##0")&" unverified cells."',
    f'="• Cross-concept: "&COUNTIF(Heatmap!$L$6:$L${5 + NB},"?*")&" brands differ by ≥"&TEXT({TH_CELL["cross_gap"]},"0%")&" in penetration between peer groups (Heatmap column L)."',
]
for i, f in enumerate(lines):
    c = ws.cell(row=C0 + 1 + i, column=2, value=f)
    c.font = fnt(size=10)
    ws.merge_cells(start_row=C0 + 1 + i, start_column=2, end_row=C0 + 1 + i, end_column=16)

# Charts
ch = BarChart()
ch.type = "bar"
ch.style = 10
ch.title = "Top 15 brands - % of applicable stores in view"
ch.y_axis.title = None
ch.x_axis.title = None
data = Reference(ws, min_col=5, min_row=BR0 + 2, max_row=BR0 + 17)
cats = Reference(ws, min_col=2, min_row=BR0 + 3, max_row=BR0 + 17)
ch.add_data(data, titles_from_data=True)
ch.set_categories(cats)
ch.x_axis.scaling.orientation = "maxMin"
ch.y_axis.number_format = "0%"
ch.y_axis.scaling.min = 0
ch.y_axis.scaling.max = 1
ch.legend = None
ch.height, ch.width = 9, 16
ch.roundedCorners = False
ch.title.overlay = False
ch.x_axis.delete = False
ch.y_axis.delete = False
ch.series[0].graphicalProperties.solidFill = TEAL
ws.add_chart(ch, "N12")

ch2 = BarChart()
ch2.type = "col"
ch2.style = 10
ch2.title = "Top 10 stores - brands carried"
data = Reference(ws, min_col=5, min_row=TOPR, max_row=TOPR + 10)
cats = Reference(ws, min_col=2, min_row=TOPR + 1, max_row=TOPR + 10)
ch2.add_data(data, titles_from_data=True)
ch2.set_categories(cats)
ch2.legend = None
ch2.height, ch2.width = 7.5, 16
ch2.roundedCorners = False
ch2.title.overlay = False
ch2.x_axis.delete = False
ch2.y_axis.delete = False
ch2.series[0].graphicalProperties.solidFill = NAVY
ws.add_chart(ch2, "N30")
ws.freeze_panes = "A8"

# ============================================================================
# Store_Summary
# ============================================================================
ws = S["Store_Summary"]
cols = ["Store Code", "Store Name", "Concept", "Area", "Peer Group", "Brand Data", "Brands ✓", "Unverified",
        "Peer avg brands", "Assortment index", "Rank in peer group", "Peer stores", "Net Sales Jan-Nov 2026",
        "Store Status", "Assortment flag", "In dashboard filter", "Top score (helper)", "Bottom score (helper)"]
header(ws, 1, 1, cols, height=32)
for i in range(NS):
    r = 2 + i
    g = GR1 + i
    m = 2 + i
    f = {
        1: f"=Master_Grid!A{g}", 2: f"=Master_Grid!B{g}", 3: f"=Master_Grid!C{g}", 4: f"=Master_Grid!D{g}",
        5: f"=Store_Master!G{m}", 6: f"=Master_Grid!E{g}", 7: f"=Master_Grid!F{g}", 8: f"=Master_Grid!G{g}",
        9: f'=IFERROR(AVERAGEIFS({SS("G")},{SS("E")},E{r},{SS("F")},"Yes"),"")',
        10: f'=IF(AND(F{r}="Yes",N(I{r})>0),G{r}/I{r},"")',
        11: f'=IF(F{r}="Yes",COUNTIFS({SS("E")},E{r},{SS("F")},"Yes",{SS("G")},">"&G{r})+1,"")',
        12: f'=COUNTIFS({SS("E")},E{r},{SS("F")},"Yes")',
        13: f"=Store_Master!J{m}", 14: f"=Store_Master!K{m}",
        15: f'=IF(J{r}="","No brand data",IF(J{r}<{TH_CELL["low_idx"]},"Significantly below peers",IF(J{r}>={TH_CELL["high_idx"]},"Above peers","In line with peers")))',
        16: f'=AND(COUNTIF(C{r},{CRIT_C})>0,COUNTIF(D{r},{CRIT_A})>0)',
        17: f'=IF(AND(P{r},F{r}="Yes"),G{r}+(1000-ROW())/100000,-1)',
        18: f'=IF(AND(P{r},F{r}="Yes"),G{r}+ROW()/100000,1E9)',
    }
    for c, v in f.items():
        ws.cell(row=r, column=c, value=v)
body_fmt(ws, 2, SS2, 1, 18, size=9)
for r in range(2, SS2 + 1):
    ws.cell(row=r, column=9).number_format = "0.0"
    ws.cell(row=r, column=10).number_format = "0.00x"
    ws.cell(row=r, column=13).number_format = "#,##0;(#,##0);-"
    for c in (17, 18):
        ws.cell(row=r, column=c).font = fnt(size=8, color="A6A6A6")
ws.conditional_formatting.add(f"O2:O{SS2}", CellIsRule(operator="equal", formula=['"Significantly below peers"'], fill=FILL("F8CBAD")))
ws.conditional_formatting.add(f"O2:O{SS2}", CellIsRule(operator="equal", formula=['"Above peers"'], fill=G_FILL))
ws.conditional_formatting.add(f"O2:O{SS2}", CellIsRule(operator="equal", formula=['"No brand data"'], fill=U_FILL))
ws.conditional_formatting.add(f"G2:G{SS2}", ColorScaleRule(start_type="min", start_color="FFFFFF", end_type="max", end_color="63BE7B"))
ws.freeze_panes = "C2"
ws.auto_filter.ref = f"A1:R{SS2}"
widths(ws, {"A": 10, "B": 18, "C": 15, "D": 11, "E": 27, "F": 8, "G": 8, "H": 9, "I": 9, "J": 10, "K": 9, "L": 8, "M": 14, "N": 32, "O": 22, "P": 9, "Q": 9, "R": 9})

# ============================================================================
# Brand_Summary
# ============================================================================
ws = S["Brand_Summary"]
cols = ["Brand", "Category", "Grid col #", "Stores ✓ (all)", "Applicable stores (all)", "% of applicable (all)",
        "Stores ✓ (in view)", "Applicable stores (in view)", "% of applicable (in view)", "Unverified (in view)",
        "Distribution tier (in view)", "Net Sales Jan-Nov 2026 (in view)", "Net Sales Jan-Nov 2025 (in view)", "Sales / carrying store",
        "In category filter", "Top score (helper)", "Limited score (helper)"]
header(ws, 1, 1, cols, height=42)
for j in range(NB):
    r = 2 + j
    col = f"INDEX({GRID},0,C{r})"
    f = {
        1: f"=Brand_Master!A{r}", 2: f"=Brand_Master!B{r}",
        3: f"=MATCH(A{r},{GHDR},0)",
        4: f'=COUNTIF({col},"{PRESENT}")',
        5: f'=COUNTIF({G_DET},"Yes")-COUNTIFS({col},"{NA}",{G_DET},"Yes")',
        6: f'=IF(E{r}=0,"",D{r}/E{r})',
        7: f'=COUNTIFS({col},"{PRESENT}",{crit})',
        8: f'=COUNTIFS({crit},{G_DET},"Yes")-COUNTIFS({col},"{NA}",{crit},{G_DET},"Yes")',
        9: f'=IF(H{r}=0,"",G{r}/H{r})',
        10: f'=COUNTIFS({col},"{UNV}",{crit})',
        11: (f'=IF(H{r}=0,"No data",IF(G{r}=0,"Not carried",IF(I{r}>={TH_CELL["core"]},"Core",'
             f'IF(I{r}>={TH_CELL["broad"]},"Broad",IF(I{r}>={TH_CELL["selective"]},"Selective","Limited")))))'),
        12: f'=SUMIFS({D("F")},{D("G")},A{r},{D("J")},{CRIT_C},{D("K")},{CRIT_A})',
        13: f'=SUMIFS({D("E")},{D("G")},A{r},{D("J")},{CRIT_C},{D("K")},{CRIT_A})',
        14: f'=IF(G{r}=0,"",L{r}/G{r})',
        15: f"=COUNTIF(B{r},{CRIT_CAT})>0",
        16: f"=IF(AND(O{r},G{r}>0),G{r}+MIN(MAX(N(L{r}),0),9E9)/1E10+(1000-ROW())/1E12,-1)",
        17: f'=IF(AND(O{r},G{r}>=1,G{r}<={TH_CELL["limited_n"]}),MAX(N(N{r}),0)+(1000-ROW())/1000000,-1)',
    }
    for c, v in f.items():
        ws.cell(row=r, column=c, value=v)
body_fmt(ws, 2, BS2, 1, 17, size=9)
for r in range(2, BS2 + 1):
    for c in (6, 9):
        ws.cell(row=r, column=c).number_format = "0%"
    for c in (12, 13, 14):
        ws.cell(row=r, column=c).number_format = "#,##0;(#,##0);-"
    for c in (3, 16, 17):
        ws.cell(row=r, column=c).font = fnt(size=8, color="A6A6A6")
for rng in (f"F2:F{BS2}", f"I2:I{BS2}"):
    ws.conditional_formatting.add(rng, ColorScaleRule(start_type="num", start_value=0, start_color="FFFFFF", end_type="num", end_value=1, end_color="63BE7B"))
ws.freeze_panes = "B2"
ws.auto_filter.ref = f"A1:Q{BS2}"
widths(ws, {"A": 22, "B": 16, "C": 7, "D": 9, "E": 10, "F": 10, "G": 9, "H": 10, "I": 10, "J": 10, "K": 13, "L": 15, "M": 15, "N": 13, "O": 9, "P": 9, "Q": 9})

# ============================================================================
# Heatmap
# ============================================================================
ws = S["Heatmap"]
title(ws, "Brand Distribution Heatmap  |  Jan - Nov 2026",
      "% of applicable stores (with brand-level data) that carry each brand, by concept, peer group and area. Blank = no stores with brand data in that group.")
ws["A3"] = "Read across a row to spot brands that are strong in one group but thin in another (column L)."
ws["A3"].font = fnt(size=9, italic=True)
HM_GROUPS = [("All stores", "concept", "*"),
             ("Toby's Sports", "concept", "Toby's Sports"), ("Runnr", "concept", "Runnr"), ("Urban Athletics", "concept", "Urban Athletics"),
             (PEER_ORDER[0], "peer", PEER_ORDER[0]), (PEER_ORDER[1], "peer", PEER_ORDER[1]),
             ("Central", "area", "Central"), ("North", "area", "North"), ("South", "area", "South")]
header(ws, 5, 1, ["Brand", "Category"] + [g[0] for g in HM_GROUPS] + ["Cross-group gap flag"], height=45)
# group-type marker row 4
for k, (lbl, typ, val) in enumerate(HM_GROUPS):
    c = ws.cell(row=4, column=3 + k, value={"concept": "Concept", "peer": "Peer group", "area": "Area"}[typ])
    c.font = fnt(size=8, italic=True, color="808080")
    c.alignment = CENTER
for j in range(NB):
    r = 6 + j
    ws.cell(row=r, column=1, value=f"=Brand_Master!A{2 + j}")
    ws.cell(row=r, column=2, value=f"=Brand_Master!B{2 + j}")
    col = f"INDEX({GRID},0,MATCH($A{r},{GHDR},0))"
    for k, (lbl, typ, val) in enumerate(HM_GROUPS):
        rng = {"concept": G_CON, "peer": SS("E"), "area": G_AREA}[typ]
        crit_v = '"*"' if val == "*" else f'"{val}"'
        f = (f'=IFERROR(COUNTIFS({col},"{PRESENT}",{rng},{crit_v})/'
             f'(COUNTIFS({rng},{crit_v},{G_DET},"Yes")-COUNTIFS({col},"{NA}",{rng},{crit_v},{G_DET},"Yes")),"")')
        ws.cell(row=r, column=3 + k, value=f).number_format = "0%"
    # gap flag across concept / peer columns that have data (D,E,F = concepts; G,H = Toby's peer groups)
    f = (f'=IF(COUNT(D{r}:H{r})<2,"",IF(MAX(D{r}:H{r})-MIN(D{r}:H{r})>={TH_CELL["cross_gap"]},'
         f'"Strong in "&INDEX($D$5:$H$5,MATCH(MAX(D{r}:H{r}),D{r}:H{r},0))&" ("&TEXT(MAX(D{r}:H{r}),"0%")&"), thin in "'
         f'&INDEX($D$5:$H$5,MATCH(MIN(D{r}:H{r}),D{r}:H{r},0))&" ("&TEXT(MIN(D{r}:H{r}),"0%")&")",""))')
    ws.cell(row=r, column=12, value=f)
body_fmt(ws, 6, 5 + NB, 1, 12, size=9)
for r in range(6, 6 + NB):
    for c in range(3, 12):
        ws.cell(row=r, column=c).number_format = "0%"
        ws.cell(row=r, column=c).alignment = CENTER
ws.conditional_formatting.add(f"C6:K{5 + NB}", ColorScaleRule(start_type="num", start_value=0, start_color="F2F2F2",
                                                                mid_type="num", mid_value=0.5, mid_color="FFE699",
                                                                end_type="num", end_value=1, end_color="2E8B57"))
ws.freeze_panes = "C6"
ws.auto_filter.ref = f"A5:L{5 + NB}"
widths(ws, {"A": 22, "B": 15, "C": 10, "D": 10, "E": 10, "F": 11, "G": 14, "H": 14, "I": 9, "J": 9, "K": 9, "L": 62})

# ============================================================================
# Store_View  (select a store -> brands carried / unverified / gaps)
# ============================================================================
ws = S["Store_View"]
ws.sheet_view.showGridLines = False
title(ws, "Store View - which brands does this store carry?", "Period: January - November 2026 (vs Jan - Nov 2025). Pick a store code in the yellow cell.")
ws["A4"] = "Store Code"
ws["A4"].font = fnt(bold=True)
ws["B4"] = stores[0] if stores[0] in detail else sorted(detail)[0]
ws["B4"] = "1011MOA" if "1011MOA" in stores else stores[0]
ws["B4"].fill = FILL("FFD966")
ws["B4"].font = fnt(bold=True, size=12, color="0000FF")
ws["B4"].border = BOX
dv = DataValidation(type="list", formula1=f"=Store_Master!$A$2:$A${SM_N}", allow_blank=False)
dv.add("B4")
ws.add_data_validation(dv)
info = [("Store Name", "B"), ("Concept", "C"), ("Area", "D"), ("Peer Group", "E"), ("Brand data in source", "F"),
        ("Brands ✓", "G"), ("Unverified", "H"), ("Peer avg brands", "I"), ("Assortment index", "J"),
        ("Rank in peer group", "K"), ("Net Sales Jan-Nov 2026", "M"), ("Store status", "N"), ("Assortment flag", "O")]
ws["D3"] = "Store profile"
ws["D3"].font = fnt(bold=True, color=TEAL)
SV_ROW = f"MATCH($B$4,{SS('A')},0)"
for i, (lbl, colx) in enumerate(info):
    r = 4 + i % 7
    cl = 4 + (i // 7) * 3
    ws.cell(row=r, column=cl, value=lbl).font = fnt(size=9, color="595959")
    c = ws.cell(row=r, column=cl + 1, value=f'=IFERROR(INDEX({SS(colx)},{SV_ROW}),"")')
    c.font = fnt(bold=True)
    c.number_format = {"I": "0.0", "J": "0.00x", "M": "#,##0"}.get(colx, "General")
LIST0 = 13
# hidden helpers at columns T..AB, one row per brand
H1 = LIST0 + 1
GROW = f"MATCH($B$4,{G_CODE},0)"
peer_cell = "$E$5" if False else f'IFERROR(INDEX({SS("E")},{SV_ROW}),"")'
ws["T12"] = "Helper columns (do not edit)"
ws["T12"].font = fnt(size=8, italic=True, color="A6A6A6")
header(ws, LIST0, 20, ["Brand", "Status", "Net Sales Jan-Nov 2026", "Net Sales Jan-Nov 2025", "Peer penetration", "Carried score", "Gap score", "Unverified score"], fill="808080")
for j in range(NB):
    r = H1 + j
    ws.cell(row=r, column=20, value=f"=Brand_Master!A{2 + j}")
    ws.cell(row=r, column=21, value=f'=IFERROR(INDEX({GRID},{GROW},{j + 1}),"")')
    ws.cell(row=r, column=22, value=f'=SUMIFS({D("F")},{D("A")},$B$4,{D("G")},T{r})')
    ws.cell(row=r, column=23, value=f'=SUMIFS({D("E")},{D("A")},$B$4,{D("G")},T{r})')
    ws.cell(row=r, column=24, value=(f'=IFERROR(COUNTIFS(INDEX({GRID},0,{j + 1}),"{PRESENT}",{SS("E")},$E$7)/'
                                     f'COUNTIFS({SS("E")},$E$7,{SS("F")},"Yes"),"")'))
    ws.cell(row=r, column=25, value=f'=IF(U{r}="{PRESENT}",V{r}+(1000-ROW())/1000000,-1E12)')
    ws.cell(row=r, column=26, value=f'=IF(AND(U{r}="{ABSENT}",N(X{r})>0),X{r}+(1000-ROW())/1000000,-1)')
    ws.cell(row=r, column=27, value=f'=IF(U{r}="{UNV}",MAX(W{r},0)+(1000-ROW())/1000000,-1)')
    for c in range(20, 28):
        ws.cell(row=r, column=c).font = fnt(size=8, color="808080")
for c in range(20, 28):
    ws.column_dimensions[CL(c)].width = 11
HR = f"$T${H1}:$T${H1 + NB - 1}"
HC = lambda c: f"${c}${H1}:${c}${H1 + NB - 1}"
section(ws, f"A{LIST0 - 1}", "Brands carried (✓) - by net sales Jan-Nov 2026")
section(ws, f"F{LIST0 - 1}", "Not carried - most common in peer group first")
section(ws, f"K{LIST0 - 1}", "Unverified - by Jan-Nov 2025 sales")
header(ws, LIST0, 1, ["#", "Brand", "Net Sales Jan-Nov 2026", "Net Sales Jan-Nov 2025"])
header(ws, LIST0, 6, ["#", "Brand", "Peer penetration", "Peer stores ✓"])
header(ws, LIST0, 11, ["#", "Brand", "Net Sales Jan-Nov 2025", "Net Sales Jan-Nov 2026"])
NLIST = 200
for k in range(1, NLIST + 1):
    r = LIST0 + k
    # carried
    key = f"LARGE({HC('Y')},{k})"
    m = f"MATCH({key},{HC('Y')},0)"
    ws.cell(row=r, column=1, value=f'=IF(COUNTIF({HC("U")},"{PRESENT}")<{k},"",{k})')
    ws.cell(row=r, column=2, value=f'=IF(A{r}="","",INDEX({HR},{m}))')
    ws.cell(row=r, column=3, value=f'=IF(A{r}="","",INDEX({HC("V")},{m}))')
    ws.cell(row=r, column=4, value=f'=IF(A{r}="","",INDEX({HC("W")},{m}))')
    # gaps
    key = f"LARGE({HC('Z')},{k})"
    m = f"MATCH({key},{HC('Z')},0)"
    ws.cell(row=r, column=6, value=f'=IF(COUNTIF({HC("Z")},">0")<{k},"",{k})')
    ws.cell(row=r, column=7, value=f'=IF(F{r}="","",INDEX({HR},{m}))')
    ws.cell(row=r, column=8, value=f'=IF(F{r}="","",INDEX({HC("X")},{m}))')
    ws.cell(row=r, column=9, value=f'=IF(F{r}="","",ROUND(H{r}*COUNTIFS({SS("E")},$E$7,{SS("F")},"Yes"),0))')
    # unverified
    key = f"LARGE({HC('AA')},{k})"
    m = f"MATCH({key},{HC('AA')},0)"
    ws.cell(row=r, column=11, value=f'=IF(COUNTIF({HC("U")},"{UNV}")<{k},"",{k})')
    ws.cell(row=r, column=12, value=f'=IF(K{r}="","",INDEX({HR},{m}))')
    ws.cell(row=r, column=13, value=f'=IF(K{r}="","",INDEX({HC("W")},{m}))')
    ws.cell(row=r, column=14, value=f'=IF(K{r}="","",INDEX({HC("V")},{m}))')
    for c in list(range(1, 5)) + list(range(6, 10)) + list(range(11, 15)):
        cell = ws.cell(row=r, column=c)
        cell.font = fnt(size=9)
        cell.number_format = {3: "#,##0", 4: "#,##0", 8: "0%", 13: "#,##0", 14: "#,##0"}.get(c, "General")
for rng, fill in ((f"B{LIST0 + 1}:B{LIST0 + NLIST}", G_FILL), (f"G{LIST0 + 1}:G{LIST0 + NLIST}", X_FILL), (f"L{LIST0 + 1}:L{LIST0 + NLIST}", U_FILL)):
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'{rng.split(":")[0]}<>""'], fill=fill))
ws.conditional_formatting.add(f"H{LIST0 + 1}:H{LIST0 + NLIST}", ColorScaleRule(start_type="num", start_value=0, start_color="FFFFFF", end_type="num", end_value=1, end_color="63BE7B"))
widths(ws, {"A": 11, "B": 22, "C": 13, "D": 13, "E": 3, "F": 5, "G": 22, "H": 13, "I": 12, "J": 3, "K": 5, "L": 22, "M": 13, "N": 13, "O": 3, "P": 3, "Q": 3, "R": 3, "S": 3})
widths(ws, {"D": 18, "E": 28, "G": 22, "H": 30})
ws.freeze_panes = f"A{LIST0 + 1}"

# ============================================================================
# Brand_View  (select a brand -> stores carrying / not / unverified)
# ============================================================================
ws = S["Brand_View"]
ws.sheet_view.showGridLines = False
title(ws, "Brand View - which stores carry this brand?", "Period: January - November 2026 (vs Jan - Nov 2025). Pick a brand in the yellow cell.")
ws["A4"] = "Brand"
ws["A4"].font = fnt(bold=True)
ws["B4"] = "NIKE"
ws["B4"].fill = FILL("FFD966")
ws["B4"].font = fnt(bold=True, size=12, color="0000FF")
ws["B4"].border = BOX
dv = DataValidation(type="list", formula1=f"=Brand_Master!$A$2:$A${1 + NB}", allow_blank=False)
dv.add("B4")
ws.add_data_validation(dv)
BV_ROW = f"MATCH($B$4,{BSR('A')},0)"
ws["D3"] = "Brand profile (all stores)"
ws["D3"].font = fnt(bold=True, color=TEAL)
for i, (lbl, f, nf) in enumerate([
        ("Category", f'=IFERROR(INDEX({BSR("B")},{BV_ROW}),"")', "General"),
        ("Source name(s)", f'=IFERROR(INDEX(Brand_Master!$C$2:$C${1 + NB},{BV_ROW}),"")', "General"),
        ("Stores ✓", f'=IFERROR(INDEX({BSR("D")},{BV_ROW}),"")', "0"),
        ("Applicable stores", f'=IFERROR(INDEX({BSR("E")},{BV_ROW}),"")', "0"),
        ("% of applicable", f'=IFERROR(INDEX({BSR("F")},{BV_ROW}),"")', "0%"),
        ("Net Sales Jan-Nov 2026 (all)", f'=SUMIFS({D("F")},{D("G")},$B$4)', "#,##0"),
        ("Net Sales Jan-Nov 2025 (all)", f'=SUMIFS({D("E")},{D("G")},$B$4)', "#,##0")]):
    ws.cell(row=4 + i, column=4, value=lbl).font = fnt(size=9, color="595959")
    c = ws.cell(row=4 + i, column=5, value=f)
    c.font = fnt(bold=True)
    c.number_format = nf
ws["H3"] = "Penetration by group"
ws["H3"].font = fnt(bold=True, color=TEAL)
HMROW = f"MATCH($B$4,Heatmap!$A$6:$A${5 + NB},0)"
for k, (lbl, typ, val) in enumerate(HM_GROUPS[1:6]):
    ws.cell(row=4 + k, column=8, value=lbl).font = fnt(size=9, color="595959")
    c = ws.cell(row=4 + k, column=9, value=f'=IFERROR(INDEX(Heatmap!${CL(4 + k)}$6:${CL(4 + k)}${5 + NB},{HMROW}),"")')
    c.font = fnt(bold=True)
    c.number_format = "0%"
ws["H9"] = "Cross-group flag"
ws["H9"].font = fnt(size=9, color="595959")
ws["I9"] = f'=IFERROR(INDEX(Heatmap!$L$6:$L${5 + NB},{HMROW}),"")'
ws["I9"].font = fnt(size=9, bold=True)
BL0 = 13
BH1 = BL0 + 1
header(ws, BL0, 20, ["Store", "Status", "Brand Net Sales Jan-Nov 2026", "Peer Group", "Peer penetration", "Store brands ✓", "Carried score", "Gap score", "Unverified score"], fill="808080")
ws["T12"] = "Helper columns (do not edit)"
ws["T12"].font = fnt(size=8, italic=True, color="A6A6A6")
BCOL = f"MATCH($B$4,{GHDR},0)"
for i in range(NS):
    r = BH1 + i
    ws.cell(row=r, column=20, value=f"=Master_Grid!A{GR1 + i}")
    ws.cell(row=r, column=21, value=f'=IFERROR(INDEX({GRID},{i + 1},{BCOL}),"")')
    ws.cell(row=r, column=22, value=f'=SUMIFS({D("F")},{D("A")},T{r},{D("G")},$B$4)')
    ws.cell(row=r, column=23, value=f"=Store_Summary!E{2 + i}")
    ws.cell(row=r, column=24, value=(f'=IFERROR(COUNTIFS(INDEX({GRID},0,{BCOL}),"{PRESENT}",{SS("E")},W{r})/'
                                     f'COUNTIFS({SS("E")},W{r},{SS("F")},"Yes"),"")'))
    ws.cell(row=r, column=25, value=f"=Store_Summary!G{2 + i}")
    ws.cell(row=r, column=26, value=f'=IF(U{r}="{PRESENT}",V{r}+(1000-ROW())/1000000,-1E12)')
    ws.cell(row=r, column=27, value=f'=IF(U{r}="{ABSENT}",N(X{r})+Y{r}/10000+(1000-ROW())/100000000,-1)')
    ws.cell(row=r, column=28, value=f'=IF(U{r}="{UNV}",1+(1000-ROW())/1000000,-1)')
    for c in range(20, 29):
        ws.cell(row=r, column=c).font = fnt(size=8, color="808080")
for c in range(20, 29):
    ws.column_dimensions[CL(c)].width = 11
BHR = lambda c: f"${c}${BH1}:${c}${BH1 + NS - 1}"
section(ws, f"A{BL0 - 1}", "Stores carrying (✓) - by brand net sales TY")
section(ws, f"F{BL0 - 1}", "Stores not carrying (—) - peer adoption first")
section(ws, f"K{BL0 - 1}", "Stores unverified")
header(ws, BL0, 1, ["#", "Store", "Store Name", "Net Sales Jan-Nov 2026"])
header(ws, BL0, 6, ["#", "Store", "Peer Group", "Peer penetration"])
header(ws, BL0, 11, ["#", "Store", "Peer Group"])
for k in range(1, NS + 1):
    r = BL0 + k
    key = f"LARGE({BHR('Z')},{k})"
    m = f"MATCH({key},{BHR('Z')},0)"
    ws.cell(row=r, column=1, value=f'=IF(COUNTIF({BHR("U")},"{PRESENT}")<{k},"",{k})')
    ws.cell(row=r, column=2, value=f'=IF(A{r}="","",INDEX({BHR("T")},{m}))')
    ws.cell(row=r, column=3, value=f'=IF(A{r}="","",INDEX(Store_Summary!$B$2:$B${SS2},{m}))')
    ws.cell(row=r, column=4, value=f'=IF(A{r}="","",INDEX({BHR("V")},{m}))')
    key = f"LARGE({BHR('AA')},{k})"
    m = f"MATCH({key},{BHR('AA')},0)"
    ws.cell(row=r, column=6, value=f'=IF(COUNTIF({BHR("U")},"{ABSENT}")<{k},"",{k})')
    ws.cell(row=r, column=7, value=f'=IF(F{r}="","",INDEX({BHR("T")},{m}))')
    ws.cell(row=r, column=8, value=f'=IF(F{r}="","",INDEX({BHR("W")},{m}))')
    ws.cell(row=r, column=9, value=f'=IF(F{r}="","",INDEX({BHR("X")},{m}))')
    key = f"LARGE({BHR('AB')},{k})"
    m = f"MATCH({key},{BHR('AB')},0)"
    ws.cell(row=r, column=11, value=f'=IF(COUNTIF({BHR("U")},"{UNV}")<{k},"",{k})')
    ws.cell(row=r, column=12, value=f'=IF(K{r}="","",INDEX({BHR("T")},{m}))')
    ws.cell(row=r, column=13, value=f'=IF(K{r}="","",INDEX({BHR("W")},{m}))')
    for c in list(range(1, 5)) + list(range(6, 10)) + list(range(11, 14)):
        cell = ws.cell(row=r, column=c)
        cell.font = fnt(size=9)
        cell.number_format = {4: "#,##0", 9: "0%"}.get(c, "General")
for rng, fill in ((f"B{BL0 + 1}:B{BL0 + NS}", G_FILL), (f"G{BL0 + 1}:G{BL0 + NS}", X_FILL), (f"L{BL0 + 1}:L{BL0 + NS}", U_FILL)):
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'{rng.split(":")[0]}<>""'], fill=fill))
widths(ws, {"A": 9, "B": 22, "C": 18, "D": 18, "E": 16, "F": 5, "G": 11, "H": 26, "I": 30, "J": 3, "K": 5, "L": 11, "M": 26})
ws.freeze_panes = f"A{BL0 + 1}"

# ============================================================================
# Opportunities  (candidate list generated from the snapshot, metrics live)
# ============================================================================
ws = S["Opportunities"]
title(ws, "Distribution Opportunity Report - for review  |  Jan - Nov 2026",
      "Potential gaps for Merchandising review - NOT automatic recommendations. Consider store format, selling space, brand agreements and strategy before acting.")
ws["A3"] = (f"Rule: store has brand-level data, is active, shows '{ABSENT}' for a brand that ≥{int(TH['opp_pen'] * 100)}% (and ≥{TH['opp_min_carry']}) of its peer-group stores carry. "
            "Peer groups compare like with like (e.g. Toby's 1011 vs 2011 series are separate). Metrics in this list are live formulas; "
            "Priority recalculates and the row shows 'Closed' once the store carries the brand or a status override is recorded.")
ws["A3"].font = fnt(size=9, italic=True)
ws["A3"].alignment = WRAP
ws.merge_cells("A3:O3")
ws.row_dimensions[3].height = 40
cols = ["#", "Store Code", "Store Name", "Peer Group", "Brand", "Peer penetration", "Peer stores ✓",
        "Peer avg sales / carrying store", "Store brands ✓", "Store assortment index", "Current status",
        "Priority", "Review notes", "Decision", "Store Status", "Open (helper)"]
header(ws, 5, 1, cols, height=42)
# build candidate list
peer_det = defaultdict(list)
for s in stores:
    if s in detail and store_status(s).startswith(("Active", "New")):
        peer_det[peer(s)].append(s)
all_det = defaultdict(list)
for s in stores:
    if s in detail:
        all_det[peer(s)].append(s)
cands = []
for pg, sl in all_det.items():
    if len(sl) < 3:
        continue
    for b in brands:
        carry = [s for s in sl if py_status(s, b) == PRESENT]
        pen = len(carry) / len(sl)
        if pen >= TH["opp_pen"] and len(carry) >= TH["opp_min_carry"]:
            for s in peer_det[pg]:
                if py_status(s, b) == ABSENT:
                    cands.append((PEER_ORDER.index(pg), -pen, s, b))
cands.sort()
O1 = 6
for i, (_, npen, s, b) in enumerate(cands):
    r = O1 + i
    ws.cell(row=r, column=1, value=i + 1)
    ws.cell(row=r, column=2, value=s)
    ws.cell(row=r, column=3, value=f'=IFERROR(INDEX({SS("B")},MATCH(B{r},{SS("A")},0)),"")')
    ws.cell(row=r, column=4, value=f'=IFERROR(INDEX({SS("E")},MATCH(B{r},{SS("A")},0)),"")')
    ws.cell(row=r, column=5, value=b)
    col = f"INDEX({GRID},0,MATCH(E{r},{GHDR},0))"
    ws.cell(row=r, column=7, value=f'=COUNTIFS({col},"{PRESENT}",{SS("E")},D{r})')
    ws.cell(row=r, column=6, value=f'=IFERROR(G{r}/COUNTIFS({SS("E")},D{r},{SS("F")},"Yes"),"")')
    ws.cell(row=r, column=8, value=f'=IFERROR(SUMIFS({D("F")},{D("G")},E{r},{D("L")},D{r})/G{r},"")')
    ws.cell(row=r, column=9, value=f'=IFERROR(INDEX({SS("G")},MATCH(B{r},{SS("A")},0)),"")')
    ws.cell(row=r, column=10, value=f'=IFERROR(INDEX({SS("J")},MATCH(B{r},{SS("A")},0)),"")')
    ws.cell(row=r, column=11, value=f'=IFERROR(INDEX({GRID},MATCH(B{r},{G_CODE},0),MATCH(E{r},{GHDR},0)),"")')
    ws.cell(row=r, column=12, value=(f'=IF(K{r}<>"{ABSENT}","Closed",IF(F{r}>=0.75,"High",IF(F{r}>=0.6,"Medium",'
                                      f'IF(F{r}>={TH_CELL["opp_pen"]},"Review","Below threshold"))))'))
    ws.cell(row=r, column=13, value=None)
    ws.cell(row=r, column=14, value="For review")
    ws.cell(row=r, column=15, value=f'=IFERROR(INDEX({SS("N")},MATCH(B{r},{SS("A")},0)),"")')
    ws.cell(row=r, column=16, value=f'=AND(K{r}="{ABSENT}",N(F{r})>={TH_CELL["opp_pen"]})')
NO = len(cands)
O2 = O1 + NO - 1
body_fmt(ws, O1, O2, 1, 16, size=9)
for r in range(O1, O2 + 1):
    ws.cell(row=r, column=6).number_format = "0%"
    ws.cell(row=r, column=8).number_format = "#,##0"
    ws.cell(row=r, column=10).number_format = "0.00x"
    for c in (13, 14):
        ws.cell(row=r, column=c).fill = INPUT_FILL
        ws.cell(row=r, column=c).font = fnt(size=9, color="0000FF")
    ws.cell(row=r, column=16).font = fnt(size=8, color="A6A6A6")
dv = DataValidation(type="list", formula1="=Settings!$M$5:$M$8", allow_blank=True)
dv.add(f"N{O1}:N{O2}")
ws.add_data_validation(dv)
ws.conditional_formatting.add(f"L{O1}:L{O2}", CellIsRule(operator="equal", formula=['"High"'], fill=FILL("F8CBAD"), font=Font(name=F, size=9, bold=True, color="C00000")))
ws.conditional_formatting.add(f"L{O1}:L{O2}", CellIsRule(operator="equal", formula=['"Medium"'], fill=U_FILL))
ws.conditional_formatting.add(f"L{O1}:L{O2}", CellIsRule(operator="equal", formula=['"Closed"'], fill=G_FILL))
ws.conditional_formatting.add(f"F{O1}:F{O2}", ColorScaleRule(start_type="num", start_value=0.5, start_color="FFFFFF", end_type="num", end_value=1, end_color="63BE7B"))
status_cf(ws, f"K{O1}:K{O2}")
# summary box
for i, (lbl, f) in enumerate([("High", f'=COUNTIF($L${O1}:$L${O2},"High")'), ("Medium", f'=COUNTIF($L${O1}:$L${O2},"Medium")'),
                              ("Review", f'=COUNTIF($L${O1}:$L${O2},"Review")'), ("Closed", f'=COUNTIF($L${O1}:$L${O2},"Closed")')]):
    ws.cell(row=4, column=1 + i * 2, value=lbl + ":").font = fnt(bold=True, size=9)
    ws.cell(row=4, column=2 + i * 2, value=f).font = fnt(bold=True, size=9, color="C00000")
ws.cell(row=4, column=10, value="Priority: High ≥75% peer penetration, Medium ≥60%, Review ≥ threshold.").font = fnt(size=8, italic=True)
ws.freeze_panes = f"C{O1}"
ws.auto_filter.ref = f"A5:P{O2}"
widths(ws, {"A": 5, "B": 10, "C": 16, "D": 26, "E": 20, "F": 10, "G": 9, "H": 13, "I": 9, "J": 10, "K": 11, "L": 10, "M": 30, "N": 18, "O": 22, "P": 8})

# ============================================================================
# Validation report
# ============================================================================
ws = S["Validation"]
title(ws, "Data Validation Report  |  Jan - Nov 2026", f"Findings from reviewing {SRC_NAME} (single sheet, {len(body)} data rows). Live counts update; listed records are a build-time snapshot.")
widths(ws, {"A": 5, "B": 14, "C": 26, "D": 18, "E": 18, "F": 60})
section(ws, "A4", "1. Summary of open items (live)")
header(ws, 5, 1, ["#", "Item", "", "Count", "Severity", "Action"])
summary = [
    ("Store names missing (not in source file)", f'=COUNTBLANK(Store_Master!$B$2:$B${SM_N})', "High", "Fill Store_Master column B from the official store masterlist."),
    ("Stores with Area UNASSIGNED", f'=COUNTIF(Store_Master!$F$2:$F${SM_N},"UNASSIGNED")', "High", "Assign Central / North / South in Store_Master column F; area filters and heatmap columns depend on it."),
    ("Stores whose concept is PROPOSED from code prefix", f'=COUNTIF(Store_Master!$E$2:$E${SM_N},"")', "Medium", "Confirm Settings section 1 (prefix → concept). Use Concept Override for exceptions."),
    ("Stores with concept UNVERIFIED (1041 series)", f'=COUNTIF(Store_Master!$D$2:$D${SM_N},"{UNV}")', "High", "Confirm which concept the 1041 stores belong to."),
    ("Stores with NO brand-level rows (all brands UNVERIFIED)", f'=COUNTIF(Store_Master!$H$2:$H${SM_N},"No")', "High", "Request brand-level sales for these stores, or confirm assortments via Overrides."),
    ("Stores with brand rows but no positive TY sales (not evaluated)", f'=COUNTIF(Store_Master!$H$2:$H${SM_N},"No TY sales")', "High", "Confirm whether these stores are closed / inactive."),
    ("Store-brand cells UNVERIFIED in the grid", f'=COUNTIF({GRID},"{UNV}")', "Medium", "Confirm with Merchandising; record outcomes in Overrides."),
    ("Store-brand pairs with sales LY but none TY (in stores with brand data)", f'=COUNTIFS({GRID},"{UNV}")-COUNTIF(Store_Master!$H$2:$H${SM_N},"<>Yes")*{NB}', "Medium", "Possible delisting / stock-out. See section 5."),
    ("Brands without a category", f'=COUNTIF(Brand_Master!$B$2:$B${1 + NB},"UNCATEGORIZED")', "Low", "Add categories in Settings col J, assign in Brand_Master col B."),
    ("Brand name consolidations applied", f"=COUNTA(Settings!$A$16:$A$29)", "Info", "Review Settings section 2."),
    ("Status overrides recorded", f'=COUNTIF(Overrides!$A${OV1}:$A${OV2},"?*")', "Info", ""),
]
for i, (item, f, sev, act) in enumerate(summary):
    r = 6 + i
    ws.cell(row=r, column=1, value=i + 1)
    ws.cell(row=r, column=2, value=item)
    ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=3)
    ws.cell(row=r, column=4, value=f).number_format = "#,##0"
    ws.cell(row=r, column=5, value=sev)
    ws.cell(row=r, column=6, value=act)
body_fmt(ws, 6, 5 + len(summary), 1, 6, size=9)
for r in range(6, 6 + len(summary)):
    ws.cell(row=r, column=6).alignment = WRAP
    ws.cell(row=r, column=2).alignment = WRAP
ws.conditional_formatting.add(f"E6:E{5 + len(summary)}", CellIsRule(operator="equal", formula=['"High"'], fill=FILL("F8CBAD")))
ws.conditional_formatting.add(f"E6:E{5 + len(summary)}", CellIsRule(operator="equal", formula=['"Medium"'], fill=U_FILL))

r = 8 + len(summary)


def table(r, heading, cols, rows, numcols=(), note=None):
    section(ws, f"A{r}", heading)
    r += 1
    if note:
        ws.cell(row=r, column=1, value=note).font = fnt(size=9, italic=True)
        r += 1
    header(ws, r, 1, cols)
    for i, row in enumerate(rows):
        for j, v in enumerate(row):
            c = ws.cell(row=r + 1 + i, column=1 + j, value=v)
            c.font = fnt(size=9)
            c.border = BOX
            if 1 + j in numcols:
                c.number_format = "#,##0;(#,##0);-"
            if j == len(row) - 1:
                c.alignment = WRAP
    return r + len(rows) + 3


nod = [s for s in stores if s not in detail]  # includes stores with brand rows but no positive TY sales
r = table(r, "2. Stores not evaluated - no brand-level breakdown, or no positive TY brand sales",
          ["#", "Store Code", "Peer Group", "Net Sales Jan-Nov 2025", "Net Sales Jan-Nov 2026", "Issue"],
          [(i + 1, s, peer(s), *store_ly_ty(s), ("Only a store total row exists" if s not in detail_any else "Brand rows exist but none has positive TY sales") + "; every brand shows UNVERIFIED. " + store_status(s))
           for i, s in enumerate(nod)], numcols=(4, 5))
anom = [s for s in stores if store_status(s) != "Active"]
r = table(r, "3. Store status anomalies (derived from sales)",
          ["#", "Store Code", "Peer Group", "Net Sales Jan-Nov 2025", "Net Sales Jan-Nov 2026", "Observation"],
          [(i + 1, s, peer(s), *store_ly_ty(s), store_status(s)) for i, s in enumerate(anom)], numcols=(4, 5))
r = table(r, "4. Brand names - consolidated and possible duplicates",
          ["#", "Brand A", "Brand B", "Action", "", "Note"],
          [(i + 1, a, b, "MERGED", "", why) for i, (a, b, why) in enumerate(ALIASES)] +
          [(len(ALIASES) + i + 1, a, b, "NOT MERGED - confirm", "", why) for i, (a, b, why) in enumerate(POSSIBLE_DUPES)])
unv_rows = []
for (s, b), g in br.groupby(["Store", "Std"]):
    if key_status[(s, b)] == UNV:
        ly, ty = g["NSALES LY"].sum(), g["NSALES TY"].sum()
        why = ("Sold LY, no sales TY - possibly delisted or out of stock" if ty == 0 and ly > 0 else
               "Net returns TY (negative)" if ty < 0 else "Zero sales LY and TY (row exists)")
        unv_rows.append((s, b, ly, ty, why))
unv_rows.sort(key=lambda x: (-x[2], x[0]))
r = table(r, f"5. Store-brand pairs marked UNVERIFIED ({len(unv_rows)}) - record exists but no positive sales TY",
          ["#", "Store Code", "Brand", "Net Sales Jan-Nov 2025", "Net Sales Jan-Nov 2026", "Reason"],
          [(i + 1, *x) for i, x in enumerate(unv_rows)], numcols=(4, 5),
          note="Sorted by Jan-Nov 2025 sales. Confirm in Overrides whether each brand is still listed in the store.")
neg = br[br["NSALES TY"] < 0].sort_values("NSALES TY")
r = table(r, f"6. Rows with negative net sales TY ({len(neg)})",
          ["#", "Store Code", "Source Brand", "Net Sales Jan-Nov 2025", "Net Sales Jan-Nov 2026", "Note"],
          [(i + 1, x["Store"], x["Brand"], x["NSALES LY"], x["NSALES TY"], "Returns exceed sales - check for data or returns issues")
           for i, (_, x) in enumerate(neg.iterrows())], numcols=(4, 5))
r = table(r, "7. Source structure notes", ["#", "Topic", "", "", "", "Detail"], [
    (1, "Missing master data", "", "", "", "The source has store codes only. Store names, area, concept, store format and brand categories are not present and are left as inputs."),
    (2, "Store total rows", "", "", "", "Store totals are labelled 'Total' for some stores and blank for others; both treated as store totals."),
    (3, "Period", "", "", "", "Reporting period CONFIRMED by user: January to November 2026 (TY). LY = January to November 2025, same period prior year, as provided in the source."),
    (4, "Presence definition", "", "", "", f"Presence ({PRESENT}) is inferred from positive net sales TY - a proxy for 'carried'. A listed brand with no sales would appear as {UNV} or {ABSENT}; record confirmed listings in Overrides."),
    (5, "Absence definition", "", "", "", f"'{ABSENT}' is only used where the store has full brand-level data and no row at all for the brand (no sales LY or TY)."),
])

# ============================================================================
# README
# ============================================================================
ws = S["README"]
ws.sheet_view.showGridLines = False
widths(ws, {"A": 3, "B": 26, "C": 110})
ws["B2"] = "QII Store × Brand Grid Matrix"
ws["B2"].font = fnt(size=20, bold=True, color=NAVY)
ws["B3"] = f"Toby's Sports · Runnr · Urban Athletics  |  Period: January - November 2026  |  Built from {SRC_NAME}  |  {NS} stores × {NB} brands"
ws["B3"].font = fnt(size=10, italic=True, color="595959")
rows = [
    ("REPORTING PERIOD", None),
    ("Period", "January - November 2026 (TY), compared with January - November 2025 (LY). All ✓ statuses and sales figures refer to this period."),
    ("STATUS LEGEND", None),
    (PRESENT, "Brand present - positive net sales in Jan-Nov 2026 (green)."),
    (ABSENT, "Brand not present - store has full brand-level data and no sales record for the brand in either year (light gray)."),
    (UNV, "Not confirmed - sold LY only, zero/negative TY, or the store has no brand-level data in the source (yellow). Never treated as absent."),
    (NA, "Not applicable - set per store or per concept in the Overrides sheet (white)."),
    ("SHEETS", None),
    ("Dashboard", "Management view with Concept / Area / Category filters, KPIs, top/bottom stores, top brands, tiers, auto-generated insights."),
    ("Master_Grid", "Store × Brand matrix. Header row and code/name columns are frozen. Use the AutoFilter arrows to filter by concept, area or any brand column."),
    ("Store_View", "Pick a store → brands carried, unverified brands, and brands it lacks that are common in its peer group."),
    ("Brand_View", "Pick a brand → stores carrying it, stores not carrying it (ranked by peer adoption), unverified stores, penetration by group."),
    ("Heatmap", "Brand × concept / peer group / area penetration heatmap, with a cross-group gap flag."),
    ("Brand_Summary", "Number and % of applicable stores carrying each brand (all, and within the dashboard filter), tier, sales."),
    ("Store_Summary", "Brands per store, peer-group average, assortment index, rank and flag for significantly smaller assortments."),
    ("Opportunities", "Store-brand gaps for review where most of the peer group carries the brand. Add notes and a decision per row."),
    ("Validation", "Missing, inconsistent and unverified records needing confirmation."),
    ("Store_Master", "INPUT: store list. Fill Store Name and Area (not in source). Concept is proposed from code prefix - override if needed."),
    ("Brand_Master", "INPUT: brand list (standardised names) and Brand Category."),
    ("Overrides", "INPUT: confirmed store-brand statuses (wins over sales data) and concept-level N/A scope."),
    ("Settings", "INPUT: prefix → concept map, brand-name consolidation, thresholds, drop-down lists."),
    ("Data", "Brand-level sales rows (from source) + formula helper columns. Feeds the grid."),
    ("Source_Raw", "Verbatim copy of the source export, untouched except an added Row Type column."),
    ("HOW TO UPDATE", None),
    ("Refresh sales", "Paste the new brand-level rows (Store, Brand, Gross LY/TY, Net LY/TY) into Data columns A-F; copy the formulas in G-L down to the last row (formulas cover up to row 6000). Paste the raw export into Source_Raw for store totals (keep column Y Row Type)."),
    ("Add a store", "Add a row at the bottom of Store_Master (copy formulas from the row above), then copy the last Master_Grid row and the last Store_Summary row down one row. Extend Brand_View helper rows if needed."),
    ("Add a brand", "Add it to Brand_Master, then copy the last Master_Grid column right one column, and copy the last Brand_Summary / Heatmap row down."),
    ("Confirm information", f"Record confirmed statuses in Overrides (e.g. a brand that is listed but has not sold yet = {PRESENT}; a delisted brand = {ABSENT}). The grid and every summary update automatically."),
    ("Slicers (optional)", "To add Excel slicers: select Master_Grid A4:G88 → Insert → Table, then Table Design → Insert Slicer (Concept, Area). The dashboard uses drop-down filters so it works without slicers."),
    ("IMPORTANT", None),
    ("Data limits", "The source file contains only store codes and brand sales. Store names, areas, concepts, store formats, selling space, brand categories and brand agreements were not provided; they are left as inputs and flagged in the Validation sheet. Nothing has been invented."),
    ("Opportunities", "Opportunity rows are potential gaps for review, not recommendations to distribute every brand to every store."),
]
r = 5
for k, v in rows:
    if v is None:
        r += 1
        ws.cell(row=r, column=2, value=k).font = fnt(size=12, bold=True, color=TEAL)
    else:
        a = ws.cell(row=r, column=2, value=k)
        a.font = fnt(bold=True)
        if k in S:
            a.hyperlink = f"#{k}!A1"
            a.font = fnt(bold=True, color="0563C1", underline="single")
        if k in (PRESENT, ABSENT, UNV, NA):
            a.fill = {PRESENT: G_FILL, ABSENT: X_FILL, UNV: U_FILL, NA: N_FILL}[k]
            a.font = {PRESENT: G_FONT, ABSENT: X_FONT, UNV: U_FONT, NA: N_FONT}[k]
            a.alignment = CENTER
            a.border = BOX
        c = ws.cell(row=r, column=3, value=v)
        c.font = fnt()
        c.alignment = Alignment(wrap_text=True, vertical="top")
    r += 1

# Tab colours
for n, col in {"README": "808080", "Dashboard": NAVY, "Master_Grid": NAVY, "Store_View": TEAL, "Brand_View": TEAL,
               "Heatmap": TEAL, "Brand_Summary": "70AD47", "Store_Summary": "70AD47", "Opportunities": "C00000",
               "Validation": "C00000", "Store_Master": "FFC000", "Brand_Master": "FFC000", "Overrides": "FFC000",
               "Settings": "FFC000", "Data": "A6A6A6", "Source_Raw": "A6A6A6"}.items():
    S[n].sheet_properties.tabColor = col
wb.active = 1
wb.calculation.fullCalcOnLoad = True
wb.save(OUT)

# Export the python mirror for verification
import json
mirror = {"stores": stores, "brands": brands, "n_opps": NO,
          "status": {s: {b: py_status(s, b) for b in brands} for s in stores}}
with open(OUT + ".mirror.json", "w") as fh:
    json.dump(mirror, fh)
print(f"stores={NS} brands={NB} data_rows={len(br)} opportunities={NO} unverified_pairs={len(unv_rows)} no_detail={len(nod)}")
