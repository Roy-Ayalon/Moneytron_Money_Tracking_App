# server/app.py
"""
MoneyTron Flask backend — refactored.
Business logic lives in modules: ingestion, categorization, analytics, validation.
This file: routes, auth, file I/O, and startup.
"""

import os
import sys
import json
import hashlib
import tempfile
from pathlib import Path
from typing import Any, Dict
from threading import RLock
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import logging
import time

from flask import Flask, request, jsonify, send_from_directory, abort, make_response

# ── Module imports ───────────────────────────────────────────────────────────
# Add server/ dir to path so modules can import each other
SERVER_DIR_PATH = Path(__file__).resolve().parent
if str(SERVER_DIR_PATH) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR_PATH))

from ingestion import extract_transactions
from categorization import auto_categorize_rows
from analytics import (
    compute_summary,
    compute_statistics,
    compute_statistics_summary,
    compute_category_last3_mean,
    compute_income_means,
    compute_rollup,
)
from validation import validate_transactions

# =============================================================================
# Paths that work in BOTH dev and PyInstaller -- with PERSISTENT users/
# =============================================================================
if getattr(sys, "frozen", False):
    BUNDLE_DIR = Path(getattr(sys, "_MEIPASS")).resolve()
    APP_DIR    = Path(sys.executable).resolve().parent
    CLIENT_DIR = (BUNDLE_DIR / "client").resolve()
    USERS_DIR  = (APP_DIR / "users").resolve()
else:
    SERVER_DIR = Path(__file__).resolve().parent
    ROOT_DIR   = SERVER_DIR.parent
    CLIENT_DIR = (ROOT_DIR / "client").resolve()
    USERS_DIR  = (ROOT_DIR / "users").resolve()

print(f"[MoneyTron] Serving client from: {CLIENT_DIR}")
print(f"[MoneyTron] Data dir: {USERS_DIR}")

USERS_DIR = Path(os.environ.get("MONEYTRON_DATA_DIR", USERS_DIR)).resolve()
USERS_DIR.mkdir(parents=True, exist_ok=True)

# =============================================================================
# App init
# =============================================================================
app = Flask(__name__, static_folder=None)
log_path = "moneytron.log"
logging.basicConfig(
    level=logging.DEBUG,
    format='[%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(log_path, mode='a'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("moneytron")
app.config["JSON_AS_ASCII"] = False
app.config["JSON_SORT_KEYS"] = False
app.url_map.strict_slashes = False

@app.after_request
def _hdrs(resp):
    resp.headers["Access-Control-Allow-Origin"] = request.headers.get("Origin", "*")
    resp.headers["Access-Control-Allow-Credentials"] = "true"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, X-User"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return resp

@app.before_request
def _short_opts():
    if request.method == "OPTIONS":
        return ("", 200)

_glock = RLock()
_CURRENT_USER = {"name": None}

# =============================================================================
# Utilities
# =============================================================================
def _sanitize_user(u: str) -> str:
    u = "".join(ch for ch in (u or "").strip() if ch.isalnum() or ch in ("_", "-", "."))
    if not u:
        abort(400, description="Invalid user.")
    return u

def _require_user() -> str:
    """Get current user — prefer cookie (multi-user safe), fall back to global."""
    cookie_user = request.cookies.get("mt_user", "").strip()
    if cookie_user:
        return _sanitize_user(cookie_user)
    if _CURRENT_USER["name"]:
        return _CURRENT_USER["name"]
    abort(400, description="No active user. POST /api/login first.")

def _user_dir(username: str) -> Path:
    p = (USERS_DIR / username).resolve()
    if not str(p).startswith(str(USERS_DIR)):
        abort(400, description="Bad path")
    return p

def _paths(username: str) -> Dict[str, Path]:
    udir = _user_dir(username)
    return {
        "categories": (udir / "categories.json"),
        "stage":      (udir / "current_month_transactions.json"),
        "past":       (udir / "past_data.json"),
        "settings":   (udir / "settings.json"),
        "password":   (udir / "password.json"),  # legacy, kept for backward compat
    }

def _hash_pw(pw: str) -> str:
    return hashlib.sha256(pw.encode("utf-8")).hexdigest()

def _check_password(username: str, password: str) -> bool:
    """Return True if password matches (or no password is set).
    Reads password_hash from settings.json (preferred) or legacy password.json."""
    p = _paths(username)
    # First try settings.json (new location)
    settings_data = _read_json(p["settings"], {})
    stored = settings_data.get("password_hash", "")
    if stored:
        return _hash_pw(password) == stored
    # Fall back to legacy password.json
    if p["password"].exists():
        pw_data = _read_json(p["password"], {})
        stored = pw_data.get("hash", "")
        if stored:
            return _hash_pw(password) == stored
    return True  # No password set => open access

def _has_password(username: str) -> bool:
    """Check if a user has a password set."""
    p = _paths(username)
    settings_data = _read_json(p["settings"], {})
    if settings_data.get("password_hash", ""):
        return True
    if p["password"].exists():
        pw_data = _read_json(p["password"], {})
        if pw_data.get("hash", ""):
            return True
    return False

def _read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        logger.debug(f"File does not exist: {path}")
        return default
    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        logger.debug(f"Successfully read {path}: {len(str(data))} chars")
        return data
    except Exception as e:
        logger.error(f"Error reading {path}: {e}")
        return default

def _atomic_write(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with _glock:
        with tempfile.NamedTemporaryFile("w", delete=False, dir=str(path.parent), encoding="utf-8") as tmp:
            json.dump(data, tmp, ensure_ascii=False, indent=2)
            tmp.flush()
            os.fsync(tmp.fileno())
            tmppath = Path(tmp.name)
        tmppath.replace(path)

def _ensure_user_files(username: str) -> Dict[str, Path]:
    p = _paths(username)
    defaults = {
        "categories": {},
        "stage": [],
        "past": [],
        "settings": {
            "dateFormat": "YYYY-MM-DD",
            "currency": "ILS",
            "allowedCurrencies": ["ILS", "USD"],
            "password_hash": "",
            "email": ""
        },
    }
    if not p["categories"].exists(): _atomic_write(p["categories"], defaults["categories"])
    if not p["stage"].exists():      _atomic_write(p["stage"],      defaults["stage"])
    if not p["past"].exists():       _atomic_write(p["past"],       defaults["past"])
    if not p["settings"].exists():   _atomic_write(p["settings"],   defaults["settings"])
    return p

# =============================================================================
# UI & health
# =============================================================================
@app.route("/")
def index():
    if not (CLIENT_DIR / "index.html").exists():
        return jsonify({"ok": False, "error": "client/index.html not found"}), 500
    return send_from_directory(CLIENT_DIR, "index.html")

@app.route("/client/<path:filename>")
def client_files(filename: str):
    return send_from_directory(CLIENT_DIR, filename)

@app.route("/screenshots/<path:filename>")
def screenshot_files(filename: str):
    screenshots_dir = (ROOT_DIR / "screenshots").resolve() if not getattr(sys, "frozen", False) else (APP_DIR / "screenshots").resolve()
    return send_from_directory(screenshots_dir, filename)

@app.route("/videos/<path:filename>")
def video_files(filename: str):
    videos_dir = (ROOT_DIR / "videos").resolve() if not getattr(sys, "frozen", False) else (APP_DIR / "videos").resolve()
    return send_from_directory(videos_dir, filename)

@app.route("/api/health")
def health():
    return jsonify({"ok": True, "ts": datetime.utcnow().isoformat() + "Z"})

# =============================================================================
# Auth / session
# =============================================================================
@app.route("/api/users", methods=["GET"])
def api_users():
    out = []
    for p in USERS_DIR.iterdir():
        if p.is_dir():
            out.append(p.name)
    out.sort()
    return jsonify(out)

@app.route("/api/login", methods=["POST"])
def api_login():
    payload = request.get_json(force=True)
    username = _sanitize_user(payload.get("user") or payload.get("username") or payload.get("name") or "")
    password = payload.get("password", "")
    # Check if user directory exists
    udir = _user_dir(username)
    if not udir.exists():
        return jsonify({"ok": False, "error": "User not found. Please sign up first."}), 404
    # Check password
    if not _check_password(username, password):
        return jsonify({"ok": False, "error": "Wrong password."}), 401
    _CURRENT_USER["name"] = username
    _ensure_user_files(username)
    resp = make_response(jsonify({"ok": True, "user": username, "hasPassword": _has_password(username)}))
    resp.set_cookie("mt_user", username, httponly=True, samesite="Lax")
    return resp

@app.route("/api/signup", methods=["POST"])
def api_signup():
    payload = request.get_json(force=True)
    username = _sanitize_user(payload.get("user") or payload.get("username") or payload.get("name") or "")
    password = payload.get("password", "")
    email = (payload.get("email") or "").strip()
    if not username:
        abort(400, description="Username is required.")
    if not password:
        abort(400, description="Password is required.")
    if not email:
        abort(400, description="Email is required.")
    # Check if user already exists
    udir = _user_dir(username)
    if udir.exists():
        return jsonify({"ok": False, "error": "User already exists. Please login instead."}), 409
    # Create user
    _CURRENT_USER["name"] = username
    p = _ensure_user_files(username)
    # Write password and email to settings.json
    settings_data = _read_json(p["settings"], {})
    settings_data["password_hash"] = _hash_pw(password)
    settings_data["email"] = email
    _atomic_write(p["settings"], settings_data)
    resp = make_response(jsonify({"ok": True, "user": username}))
    resp.set_cookie("mt_user", username, httponly=True, samesite="Lax")
    return resp

@app.route("/api/change-password", methods=["POST"])
def api_change_password():
    user = _require_user()
    payload = request.get_json(force=True)
    old_pw = payload.get("old_password", "")
    new_pw = payload.get("new_password", "")
    if not new_pw:
        abort(400, description="New password cannot be empty.")
    # Verify old password
    if not _check_password(user, old_pw):
        return jsonify({"ok": False, "error": "Current password is incorrect."}), 401
    p = _paths(user)
    # Write to settings.json (new location)
    settings_data = _read_json(p["settings"], {})
    settings_data["password_hash"] = _hash_pw(new_pw)
    _atomic_write(p["settings"], settings_data)
    return jsonify({"ok": True})

@app.route("/api/logout", methods=["POST"])
def api_logout():
    _CURRENT_USER["name"] = None
    resp = make_response(jsonify({"ok": True}))
    resp.delete_cookie("mt_user")
    return resp

@app.route("/api/bootstrap", methods=["GET"])
def api_bootstrap():
    cookie_user = request.cookies.get("mt_user", "").strip()
    user = cookie_user or _CURRENT_USER["name"]
    if not user:
        return jsonify({"user": ""})
    p = _ensure_user_files(user)
    settings_data = _read_json(p["settings"], {"dateFormat": "YYYY-MM-DD", "currency": "ILS"})
    # Strip sensitive fields from settings before sending to client
    safe_settings = {k: v for k, v in settings_data.items() if k not in ("password_hash",)}
    return jsonify({
        "user": user,
        "categories": _read_json(p["categories"], {}),
        "current_month": _read_json(p["stage"], []),
        "past_data": _read_json(p["past"], []),
        "settings": safe_settings
    })

# =============================================================================
# Categories
# =============================================================================
@app.route("/api/categories", methods=["GET", "POST"])
def api_categories():
    user = _require_user()
    p = _ensure_user_files(user)
    logger.debug(f"Categories API for user: {user}, path: {p['categories']}")

    if request.method == "GET":
        cats = _read_json(p["categories"], {})
        logger.debug(f"Loaded categories: {cats}")
        return jsonify(cats)

    payload = request.get_json(force=True)
    cats = payload.get("categories", {})
    if not isinstance(cats, dict):
        abort(400, description="'categories' must be an object {name: [subs...]}")
    _atomic_write(p["categories"], cats)
    return jsonify({"ok": True})

# =============================================================================
# Current month (Transactions staging)
# =============================================================================
@app.route("/api/current-month", methods=["GET", "POST"])
def api_current_month():
    user = _require_user()
    p = _ensure_user_files(user)

    if request.method == "GET":
        return jsonify({"current_month": _read_json(p["stage"], [])})

    payload = request.get_json(force=True)
    rows = payload.get("transactions") or payload.get("items") or []
    if not isinstance(rows, list):
        abort(400, description="'transactions' must be a list")
    _atomic_write(p["stage"], rows)
    return jsonify({"ok": True})

@app.route('/api/current-month/reset', methods=['POST'])
def reset_current_month():
    user = _require_user()
    if not user:
        return jsonify({'error': 'Not logged in'}), 401
    p = _ensure_user_files(user)
    _atomic_write(p['stage'], [])
    return jsonify({'ok': True})

# =============================================================================
# Past data (Data tab)
# =============================================================================
@app.route("/api/past-data", methods=["GET", "POST"])
def api_past_data():
    user = _require_user()
    p = _ensure_user_files(user)

    if request.method == "GET":
        return jsonify({"past_data": _read_json(p["past"], [])})

    payload = request.get_json(force=True)
    rows = payload.get("past_data") or payload.get("items") or []
    if not isinstance(rows, list):
        abort(400, description="'past_data' must be a list")
    _atomic_write(p["past"], rows)
    return jsonify({"ok": True})

# =============================================================================
# Commit transactions (move from stage -> past)
# =============================================================================
@app.route("/api/transactions", methods=["POST"])
def api_transactions():
    user = _require_user()
    p = _ensure_user_files(user)

    payload = request.get_json(force=True)
    rows = payload.get("transactions") or []
    if not isinstance(rows, list):
        abort(400, description="'transactions' must be a list")

    # Validate before committing
    vr = validate_transactions(rows)
    if not vr["valid"]:
        return jsonify({"ok": False, "errors": vr["errors"]}), 400

    past = _read_json(p["past"], [])
    seen = {str(x.get("id")) for x in past if isinstance(x, dict) and x.get("id") is not None}
    for r in rows:
        if not isinstance(r, dict):
            continue
        rid = str(r.get("id"))
        if rid and rid in seen:
            continue
        past.append(r)
        if rid:
            seen.add(rid)

    _atomic_write(p["past"], past)
    _atomic_write(p["stage"], [])
    return jsonify({"ok": True, "saved": len(rows)})

# =============================================================================
# Settings
# =============================================================================
@app.route("/api/settings", methods=["GET", "POST"])
def api_settings():
    user = _require_user()
    p = _ensure_user_files(user)

    if request.method == "GET":
        settings_data = _read_json(p["settings"], {
            "dateFormat": "YYYY-MM-DD",
            "currency": "ILS",
            "allowedCurrencies": ["ILS", "USD"]
        })
        # Strip sensitive fields
        safe_settings = {k: v for k, v in settings_data.items() if k not in ("password_hash",)}
        return jsonify(safe_settings)

    payload = request.get_json(force=True)
    s = payload.get("settings", {})
    if not isinstance(s, dict):
        abort(400, description="'settings' must be an object")
    cur = _read_json(p["settings"], {})
    cur.update({
        "dateFormat": s.get("dateFormat", cur.get("dateFormat", "YYYY-MM-DD")),
        "currency":   s.get("currency",   cur.get("currency", "ILS")),
        "allowedCurrencies": s.get("allowedCurrencies", cur.get("allowedCurrencies", ["ILS", "USD"]))
    })
    # Preserve password_hash and email (don't overwrite from settings save)
    # They are only changed via change-password or signup endpoints
    _atomic_write(p["settings"], cur)
    return jsonify({"ok": True})

# =============================================================================
# Import / Clear
# =============================================================================
@app.route("/api/import", methods=["POST"])
def api_import():
    user = _require_user()
    p = _ensure_user_files(user)

    payload = request.get_json(force=True)

    if "categories" in payload:
        if not isinstance(payload["categories"], dict):
            abort(400, description="'categories' must be an object")
        _atomic_write(p["categories"], payload["categories"])

    if "current_month" in payload:
        if not isinstance(payload["current_month"], list):
            abort(400, description="'current_month' must be a list")
        _atomic_write(p["stage"], payload["current_month"])

    if "past_data" in payload:
        if not isinstance(payload["past_data"], list):
            abort(400, description="'past_data' must be a list")
        _atomic_write(p["past"], payload["past_data"])

    if "settings" in payload:
        s = payload["settings"]
        if not isinstance(s, dict):
            abort(400, description="'settings' must be an object")
        _atomic_write(p["settings"], {
            "dateFormat": s.get("dateFormat", "YYYY-MM-DD"),
            "currency":   s.get("currency", "ILS")
        })

    return jsonify({"ok": True})

@app.route("/api/clear-all", methods=["POST"])
def api_clear_all():
    user = _require_user()
    p = _ensure_user_files(user)
    _atomic_write(p["categories"], {})
    _atomic_write(p["stage"], [])
    _atomic_write(p["past"], [])
    return jsonify({"ok": True})

# =============================================================================
# NEW: File upload + parse (replaces client-side XLSX.js parsing)
# =============================================================================
@app.route("/api/upload", methods=["POST"])
def api_upload():
    """
    Accept a file upload (multipart/form-data), parse it server-side,
    auto-categorize, and return the transactions.

    Form fields:
        file: the XLS/XLSX/CSV file
        tag: month tag (1-12)
        year: e.g. 2025
    """
    user = _require_user()
    p = _ensure_user_files(user)

    f = request.files.get("file")
    if not f or not f.filename:
        abort(400, description="No file uploaded")

    tag = request.form.get("tag")
    year = request.form.get("year")

    try:
        tag = int(tag)
        if tag < 1 or tag > 12:
            abort(400, description="Tag must be 1-12")
    except (ValueError, TypeError):
        abort(400, description="Invalid tag value")

    try:
        year = int(year)
        if year < 2000 or year > 2100:
            abort(400, description="Year must be 2000-2100")
    except (ValueError, TypeError):
        abort(400, description="Invalid year value")

    file_bytes = f.read()
    file_name = f.filename

    try:
        extracted = extract_transactions(file_bytes, file_name, user_tag=tag)
    except Exception as e:
        logger.error(f"File parse error: {e}")
        return jsonify({"ok": False, "error": f"Parse failed: {str(e)}"}), 400

    # Build transactions with user-provided tag and year + IDs
    # Tag format: "month/shortYear" e.g. "2/26"
    tag_display = f"{tag}/{str(year)[-2:]}"
    built = []
    for i, x in enumerate(extracted):
        date_iso = x.get("date_iso") or x.get("date", "")
        date_str = x.get("date_str", "")
        built.append({
            "id": f"u_{i}_{int(time.time() * 1000)}",
            "tag": tag_display,
            "date": date_iso,
            "date_iso": date_iso,
            "date_str": date_str,
            "year": year,
            "month_tag": tag,
            "name": x.get("name", ""),
            "amount": abs(float(x.get("amount", 0))),
            "debit": abs(float(x.get("debit", 0))),
            "currency": "ILS",
            "type": "Income" if x.get("__credit") else "Expense",
            "category": "",
            "subcategory": "",
            "notes": "",
            "vi": False,
            "manual": False,
        })

    # Auto-categorize using past data + categories
    past_data = _read_json(p["past"], [])
    categories = _read_json(p["categories"], {})
    categorized = auto_categorize_rows(built, past_data, categories)

    logger.info(f"Upload: {len(categorized)} rows from {file_name} for user {user}")

    return jsonify({
        "ok": True,
        "transactions": categorized,
        "count": len(categorized),
        "file": file_name,
    })

# =============================================================================
# NEW: Auto-categorize (standalone, for re-categorization)
# =============================================================================
@app.route("/api/auto-categorize", methods=["POST"])
def api_auto_categorize():
    """
    Accept raw transaction rows, auto-categorize them using past data.
    """
    user = _require_user()
    p = _ensure_user_files(user)

    payload = request.get_json(force=True)
    rows = payload.get("transactions", [])
    if not isinstance(rows, list):
        abort(400, description="'transactions' must be a list")

    past_data = _read_json(p["past"], [])
    categories = _read_json(p["categories"], {})
    categorized = auto_categorize_rows(rows, past_data, categories)

    return jsonify({
        "ok": True,
        "transactions": categorized,
    })

# =============================================================================
# NEW: Summary (for SummaryTab — replaces client-side aggregation)
# =============================================================================
@app.route("/api/summary", methods=["GET"])
def api_summary():
    """
    Return pre-computed summary aggregation for the SummaryTab.
    """
    user = _require_user()
    p = _ensure_user_files(user)
    past_data = _read_json(p["past"], [])
    result = compute_summary(past_data)
    return jsonify(result)

# =============================================================================
# Statistics endpoints (refactored to use analytics module)
# =============================================================================
@app.route("/api/statistics", methods=["POST"])
def api_statistics():
    user = _require_user()
    p = _ensure_user_files(user)
    payload = request.get_json(force=True)
    past = _read_json(p["past"], [])
    result = compute_statistics(past, payload)
    return jsonify(result)

@app.route("/api/statistics/summary", methods=["POST"])
def api_statistics_summary():
    """DEPRECATED - use /api/statistics instead"""
    user = _require_user()
    p = _ensure_user_files(user)
    payload = request.get_json(force=True)
    past = _read_json(p["past"], [])
    result = compute_statistics_summary(past, payload)
    return jsonify(result)

@app.route("/api/statistics/category_last3_mean", methods=["POST"])
def api_statistics_category_last3_mean():
    user = _require_user()
    p = _ensure_user_files(user)
    payload = request.get_json(force=True)
    past = _read_json(p["past"], [])
    result = compute_category_last3_mean(past, payload.get("category", ""))
    return jsonify(result)

@app.route("/api/statistics/income_means", methods=["POST"])
def api_statistics_income_means():
    user = _require_user()
    p = _ensure_user_files(user)
    payload = request.get_json(force=True)
    past = _read_json(p["past"], [])
    result = compute_income_means(past, payload)
    return jsonify(result)

@app.route("/api/statistics/rollup", methods=["POST"])
def api_statistics_rollup():
    user = _require_user()
    p = _ensure_user_files(user)
    payload = request.get_json(force=True)
    past = _read_json(p["past"], [])
    result = compute_rollup(past, payload)
    return jsonify(result)

# =============================================================================
# Feedback / Send Idea
# =============================================================================
FEEDBACK_FILE = USERS_DIR / "_feedback.json"
FEEDBACK_TARGET_EMAIL = "roy1.ayalon@gmail.com"

def _send_feedback_email(from_email: str, name: str, message: str) -> bool:
    """Try to send feedback email via SMTP. Returns True on success."""
    if not from_email:
        return False
    try:
        smtp_host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(os.environ.get("SMTP_PORT", "587"))
        smtp_user = os.environ.get("SMTP_USER", "")
        smtp_pass = os.environ.get("SMTP_PASS", "")

        msg = MIMEMultipart()
        msg["From"] = from_email
        msg["To"] = FEEDBACK_TARGET_EMAIL
        msg["Subject"] = f"MoneyTron Feedback from {name}"
        msg["Reply-To"] = from_email

        body = f"From: {name}\nEmail: {from_email}\n\n{message}"
        msg.attach(MIMEText(body, "plain", "utf-8"))

        if smtp_user and smtp_pass:
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
            logger.info(f"Feedback email sent from {from_email} to {FEEDBACK_TARGET_EMAIL}")
            return True
        else:
            # No SMTP credentials configured - try localhost sendmail
            try:
                with smtplib.SMTP("localhost", 25, timeout=5) as server:
                    server.send_message(msg)
                logger.info(f"Feedback email sent via localhost from {from_email}")
                return True
            except Exception:
                logger.warning("No SMTP credentials configured and localhost mail not available")
                return False
    except Exception as e:
        logger.error(f"Failed to send feedback email: {e}")
        return False

@app.route("/api/feedback", methods=["POST"])
def api_feedback():
    """
    Save user feedback and try to send it via email.
    If the user has an email in their profile, it's used as the sender.
    """
    user = _require_user()
    p = _ensure_user_files(user)
    payload = request.get_json(force=True)

    message = (payload.get("message") or "").strip()
    name = (payload.get("name") or user).strip()

    if not message:
        abort(400, description="Feedback message cannot be empty.")

    # Get user's email from settings
    settings_data = _read_json(p["settings"], {})
    user_email = settings_data.get("email", "")

    # Save feedback to local file (always works)
    feedback_entry = {
        "user": user,
        "name": name,
        "email": user_email,
        "message": message,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }

    with _glock:
        existing = _read_json(FEEDBACK_FILE, [])
        existing.append(feedback_entry)
        _atomic_write(FEEDBACK_FILE, existing)

    # Try to send email if user has email
    email_sent = False
    if user_email:
        email_sent = _send_feedback_email(user_email, name, message)

    return jsonify({
        "ok": True,
        "saved": True,
        "email_sent": email_sent,
        "has_email": bool(user_email),
    })

# =============================================================================
# Debug endpoint
# =============================================================================
@app.route("/api/debug", methods=["GET"])
def api_debug():
    """Debug endpoint to check filesystem and environment"""
    try:
        import platform
        import socket
        
        debug_info = {
            "platform": platform.platform(),
            "hostname": socket.gethostname(),
            "users_dir": str(USERS_DIR),
            "users_dir_exists": USERS_DIR.exists(),
            "users_dir_contents": [],
            "environment": {
                "MONEYTRON_DATA_DIR": os.environ.get("MONEYTRON_DATA_DIR", "NOT SET"),
                "PORT": os.environ.get("PORT", "NOT SET"),
                "PWD": os.environ.get("PWD", "NOT SET"),
                "PATH": os.environ.get("PATH", "")[:200] + "..." if len(os.environ.get("PATH", "")) > 200 else os.environ.get("PATH", ""),
            }
        }
        
        # Try to list users directory
        if USERS_DIR.exists():
            try:
                debug_info["users_dir_contents"] = [str(item.name) for item in USERS_DIR.iterdir()]
            except Exception as e:
                debug_info["users_dir_error"] = str(e)
        
        # Check specific user directories
        for username in ["Yoav", "Roy", "bla"]:
            user_dir = USERS_DIR / username
            user_info = {
                "exists": user_dir.exists(),
                "is_dir": user_dir.is_dir() if user_dir.exists() else False,
                "files": []
            }
            if user_dir.exists():
                try:
                    user_info["files"] = [f.name for f in user_dir.iterdir()]
                except Exception as e:
                    user_info["error"] = str(e)
            debug_info[f"user_{username}"] = user_info
        
        return jsonify(debug_info)
    except Exception as e:
        return jsonify({"error": str(e)})

@app.route("/api/debug/<username>", methods=["GET"])
def api_debug_user(username):
    """Debug specific user data loading"""
    try:
        username = _sanitize_user(username)
        p = _paths(username)
        
        debug_info = {
            "username": username,
            "paths": {k: str(v) for k, v in p.items()},
            "file_status": {}
        }
        
        # Check each file
        for key, path in p.items():
            status = {
                "path": str(path),
                "exists": path.exists(),
                "readable": False,
                "size": 0,
                "content_sample": None,
                "error": None
            }
            
            if path.exists():
                try:
                    # Check if readable
                    with path.open("r", encoding="utf-8") as f:
                        content = f.read()
                    status["readable"] = True
                    status["size"] = len(content)
                    # Show first 200 chars of content
                    status["content_sample"] = content[:200] + "..." if len(content) > 200 else content
                except Exception as e:
                    status["error"] = str(e)
            
            debug_info["file_status"][key] = status
        
        # Try to load data using app's normal methods
        debug_info["app_data"] = {}
        try:
            debug_info["app_data"]["categories"] = _read_json(p["categories"], {})
            debug_info["app_data"]["past"] = _read_json(p["past"], [])
            debug_info["app_data"]["stage"] = _read_json(p["stage"], [])
            debug_info["app_data"]["settings"] = _read_json(p["settings"], {})
        except Exception as e:
            debug_info["app_data"]["error"] = str(e)
        
        return jsonify(debug_info)
    except Exception as e:
        return jsonify({"error": str(e)})

# =============================================================================
# Entrypoint
# =============================================================================
def _port() -> int:
    try:
        return int(os.environ.get("PORT", "5003"))
    except Exception:
        return 5003

if __name__ == "__main__":
    port = _port()
    url = f"http://127.0.0.1:{port}/"
    print("\n====================================================")
    print(" MoneyTron backend is starting...")
    print(f" Open this in your browser: {url}")
    print("====================================================\n")
    try:
        from waitress import serve
        print(f"[MoneyTron] Using Waitress WSGI server")
        print(f"[MoneyTron] Serving client from: {CLIENT_DIR}")
        print(f"[MoneyTron] Data dir: {USERS_DIR}")
        serve(app, host="0.0.0.0", port=port)
    except Exception as e:
        print(f"[MoneyTron] Waitress unavailable ({e}); Flask dev server fallback")
        print(f"[MoneyTron] Serving client from: {CLIENT_DIR}")
        print(f"[MoneyTron] Data dir: {USERS_DIR}")
        app.run(host="0.0.0.0", port=port, debug=True, use_reloader=False)
