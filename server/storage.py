# server/storage.py
"""
File I/O layer: user directory management, JSON read/write, atomic writes.
"""

import json
import logging
import os
import sys
import tempfile
from pathlib import Path
from threading import RLock
from typing import Any, Dict

from flask import abort

logger = logging.getLogger("moneytron")

# _glock guards multi-file atomic operations (RLock allows re-entry by same thread)
_glock = RLock()

# Resolve USERS_DIR — supports both dev and PyInstaller frozen bundles
if getattr(sys, "frozen", False):
    _APP_DIR = Path(sys.executable).resolve().parent
    USERS_DIR = (_APP_DIR / "users").resolve()
else:
    _SERVER_DIR = Path(__file__).resolve().parent
    _ROOT_DIR = _SERVER_DIR.parent
    USERS_DIR = (_ROOT_DIR / "users").resolve()

USERS_DIR = Path(os.environ.get("MONEYTRON_DATA_DIR", USERS_DIR)).resolve()
USERS_DIR.mkdir(parents=True, exist_ok=True)


def _sanitize_user(u: str) -> str:
    u = "".join(ch for ch in (u or "").strip() if ch.isalnum() or ch in ("_", "-", "."))
    if not u:
        abort(400, description="Invalid user.")
    return u


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
        "categories": {"הכנסות": ["משכורת", "בונוס", "אחר"]},
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
