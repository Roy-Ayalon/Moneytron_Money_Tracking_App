# server/utils.py
"""
Shared utility helpers: date parsing, amount parsing, Hebrew normalization.
Ported from client/index.html business logic.
"""

import re
import math
from datetime import date, datetime, timedelta

# ── HTML cleaning ────────────────────────────────────────────────────────────

def clean_html(s):
    """Strip HTML tags and decode common entities."""
    if not s:
        return ""
    s = str(s)
    s = re.sub(r"<[^>]*>", " ", s)
    s = s.replace("&nbsp;", " ").replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
    s = re.sub(r"\s+", " ", s).strip()
    return s


# ── Normalization helpers ────────────────────────────────────────────────────

def norm_az(s):
    """Keep only Hebrew + Latin letters, lowercased.  Used for header matching."""
    if not s:
        return ""
    return re.sub(r"[^a-z\u0590-\u05FF]", "", str(s).lower())


def norm_heb(s):
    """Remove whitespace, lowercase."""
    if not s:
        return ""
    return re.sub(r"\s+", "", str(s)).lower()


def norm_heb_en_vendor(s):
    """Normalize a vendor name for matching: strip noise, suffixes, lowercase."""
    if not s:
        return ""
    s = str(s)
    # strip RTL/LRM etc.
    s = re.sub(r"[\u200f\u200e\u202a\u202b\u202c\u2066\u2067\u2068\u2069\u00a0]", "", s)
    # remove quotes, punctuation except &/+
    s = re.sub(r'[\"\'`~!@#%^*()_=\[\]{}|;:<>?,.]', " ", s)
    # common Hebrew company suffixes / noise
    s = re.sub(r'\bבע[\"״\']?מ\b', "", s)
    s = re.sub(r'\bח\.?פ\.?\b', "", s)
    # latin company suffixes
    s = re.sub(r"\b(ltd|inc|llc)\b", "", s, flags=re.IGNORECASE)
    # collapse spaces, trim, lowercase
    s = re.sub(r"\s+", " ", s).strip().lower()
    return s


# ── Date parsing ────────────────────────────────────────────────────────────

_UNICODE_STRIP_RE = re.compile(r"[\u200f\u200e\u202a\u202b\u202c\u2066\u2067\u2068\u2069\u00a0]")

# Day-first patterns
_DAY_FIRST_FMTS = [
    (r"^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$", "dmy4"),  # D/M/YYYY or DD/MM/YYYY
    (r"^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2})$", "dmy2"),   # D/M/YY or DD/MM/YY
    (r"^(\d{1,2})[/\-](\d{1,2})$", "dm"),                  # D/M or DD/MM
]

# Year-first patterns
_YEAR_FIRST_FMTS = [
    (r"^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})$", "ymd"),
]


def _exact_date(y, m, d):
    """Build a date object; return None on out-of-range."""
    try:
        return date(y, m, d)
    except (ValueError, OverflowError):
        return None


def _excel_serial_to_date(n):
    """Convert an Excel serial number to a date."""
    try:
        n = int(float(n))
    except (ValueError, TypeError):
        return None
    if n < 1:
        return None
    # Excel epoch: 1899-12-30 (accounting for the Lotus 1-2-3 bug)
    base = date(1899, 12, 30)
    try:
        return base + timedelta(days=n)
    except (ValueError, OverflowError):
        return None


def _is_likely_excel_serial(n):
    try:
        x = float(n)
        return math.isfinite(x) and 20000 < x < 50000
    except (ValueError, TypeError):
        return False


def parse_date_flex(v):
    """
    Parse a value into a date object.
    Supports: Date objects, Excel serial numbers, DD/MM/YYYY, YYYY-MM-DD,
    DD-MM-YYYY, D/M/YY, and other common formats.
    Returns date or None.
    """
    if v is None or v == "":
        return None

    # Already a date/datetime
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v

    # Excel serial number
    if isinstance(v, (int, float)) and _is_likely_excel_serial(v):
        return _excel_serial_to_date(v)

    s = str(v).strip()
    if not s:
        return None

    # Strip unicode marks
    s = _UNICODE_STRIP_RE.sub("", s)

    # Replace dots with slashes in date-like tokens
    # Extract a date-like token if embedded in text
    token_match = re.search(
        r"(\d{1,2}[/.\-]\d{1,2}(?:[/.\-]\d{2,4})?|\d{4}[/.\-]\d{1,2}[/.\-]\d{1,2})",
        s,
    )
    if token_match:
        s = token_match.group(1).replace(".", "/")

    today = date.today()

    # Day-first formats
    for pattern, kind in _DAY_FIRST_FMTS:
        m = re.match(pattern, s)
        if not m:
            continue
        if kind == "dmy4":
            d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        elif kind == "dmy2":
            d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
            y += 2000 if y < 100 else 0
        elif kind == "dm":
            d, mo = int(m.group(1)), int(m.group(2))
            y = today.year
        else:
            continue
        if y < 1900:
            y = today.year
        result = _exact_date(y, mo, d)
        if result:
            return result

    # Year-first formats
    for pattern, _ in _YEAR_FIRST_FMTS:
        m = re.match(pattern, s)
        if m:
            y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
            if 1900 < y < 2101:
                result = _exact_date(y, mo, d)
                if result:
                    return result

    # Try as Excel serial if it's a pure number string
    try:
        n = float(s)
        if _is_likely_excel_serial(n):
            return _excel_serial_to_date(n)
    except ValueError:
        pass

    return None


def format_dmy(date_input):
    """Format a date (or ISO string) as DD-MM-YYYY."""
    if not date_input:
        return ""
    if isinstance(date_input, (date, datetime)):
        d = date_input if isinstance(date_input, date) else date_input.date()
        return d.strftime("%d-%m-%Y")
    s = str(date_input).strip()
    # Already DD-MM-YYYY
    if re.match(r"^\d{2}-\d{2}-\d{4}$", s):
        return s
    # ISO YYYY-MM-DD
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    return s


def parse_dmy_to_iso(dmy_str):
    """Parse DD-MM-YYYY to ISO YYYY-MM-DD."""
    if not dmy_str:
        return ""
    m = re.match(r"^(\d{2})-(\d{2})-(\d{4})$", str(dmy_str))
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    return str(dmy_str)


# ── Amount / number parsing ────────────────────────────────────────────────

def parse_amount(v):
    """
    Parse a monetary string to a float.
    Handles: ₪, $, EUR symbols, parentheses for negative, trailing minus,
    thousand separators, etc.
    """
    if v is None or v == "":
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip()
    neg = False
    # Parentheses = negative
    if re.match(r"^\(.*\)$", s):
        neg = True
        s = s[1:-1]
    # Trailing minus/dash
    if re.search(r"[-\u2212\u2013\u002D]\s*$", s):
        neg = True
        s = re.sub(r"[-\u2212\u2013\u002D]\s*$", "", s)
    # Strip currency symbols and RTL marks
    s = re.sub(r"[₪$€£]", "", s)
    s = re.sub(r"[\u200f\u200e]", "", s)
    s = re.sub(r"\s+", "", s)
    # Thousand/decimal separators
    if "." in s and "," in s:
        s = s.replace(".", "").replace(",", ".")
    else:
        s = s.replace(",", "")
    # Keep only digits, dot, minus
    s = re.sub(r"[^0-9.\-]", "", s)
    try:
        n = float(s)
    except (ValueError, TypeError):
        return 0.0
    if not math.isfinite(n):
        return 0.0
    return -abs(n) if neg else n


def numify(v):
    """
    Parse a value to a number (float). Returns None if not parseable.
    Cleans HTML first if present.
    """
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)) and math.isfinite(v):
        return float(v)
    s = str(v).strip()
    if not s:
        return None
    s = clean_html(s)
    if not s:
        return None
    # Normalize NBSP and RTL marks
    s = s.replace("\u00a0", "").replace("\u200f", "").replace("\u200e", "")
    neg = False
    if re.match(r"^\(.*\)$", s):
        neg = True
        s = s[1:-1]
    if re.search(r"[-\u2212\u2013\u002D]\s*$", s):
        neg = True
        s = re.sub(r"[-\u2212\u2013\u002D]\s*$", "", s)
    s = re.sub(r"[₪$€£]", "", s)
    s = re.sub(r"\s+", "", s)
    if "." in s and "," in s:
        s = s.replace(".", "").replace(",", ".")
    else:
        s = s.replace(",", "")
    s = re.sub(r"[^0-9.\-]", "", s)
    try:
        n = float(s)
    except (ValueError, TypeError):
        return None
    if not math.isfinite(n):
        return None
    return -abs(n) if neg else n


def is_text(v):
    """Return True if value is text (not a number or empty)."""
    if v is None:
        return False
    s = str(v).strip()
    if not s:
        return False
    cleaned = re.sub(r"[,₪$€£]", "", s)
    try:
        float(cleaned)
        return False
    except ValueError:
        return True
