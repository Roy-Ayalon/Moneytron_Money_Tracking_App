# server/auth.py
"""
Authentication helpers: password hashing, CSRF token lifecycle, session cookies.
"""

import hashlib
import hmac
import logging
import os
import re
import secrets
from typing import Tuple

import bcrypt
from flask import request

from storage import _paths, _read_json

logger = logging.getLogger("moneytron")

_default_cookie_secure = "1" if os.environ.get("K_SERVICE") else "0"
COOKIE_SECURE = (
    os.environ.get("MONEYTRON_COOKIE_SECURE", _default_cookie_secure)
    .strip()
    .lower()
    not in {"0", "false", "no"}
)


# ── Password helpers ──────────────────────────────────────────────────────────

def _hash_pw_sha256(pw: str) -> str:
    return hashlib.sha256(pw.encode("utf-8")).hexdigest()


def _hash_pw_bcrypt(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _is_sha256_hash(value: str) -> bool:
    return bool(re.fullmatch(r"[a-fA-F0-9]{64}", value or ""))


def _is_bcrypt_hash(value: str) -> bool:
    return bool(value and value.startswith("$2"))


def _check_password(username: str, password: str) -> Tuple[bool, bool]:
    """
    Returns (is_valid, should_upgrade_hash).
    should_upgrade_hash is True when the stored hash is legacy SHA-256
    and a bcrypt upgrade is needed.
    """
    p = _paths(username)

    settings_data = _read_json(p["settings"], {})
    stored = settings_data.get("password_hash", "")
    if stored:
        if _is_bcrypt_hash(stored):
            try:
                return bcrypt.checkpw(password.encode("utf-8"), stored.encode("utf-8")), False
            except ValueError:
                return False, False
        if _is_sha256_hash(stored):
            valid = _hash_pw_sha256(password) == stored
            return valid, valid
        return False, False

    # Legacy fallback: password.json (SHA-256 hash)
    if p["password"].exists():
        pw_data = _read_json(p["password"], {})
        stored = pw_data.get("hash", "")
        if _is_sha256_hash(stored):
            valid = _hash_pw_sha256(password) == stored
            return valid, valid

    # No password hash set → open access
    return True, False


def _has_password(username: str) -> bool:
    p = _paths(username)
    settings_data = _read_json(p["settings"], {})
    if settings_data.get("password_hash", ""):
        return True
    if p["password"].exists():
        pw_data = _read_json(p["password"], {})
        if pw_data.get("hash", ""):
            return True
    return False


# ── CSRF helpers ──────────────────────────────────────────────────────────────

def _issue_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def _validate_csrf() -> bool:
    csrf_cookie = request.cookies.get("mt_csrf", "")
    csrf_header = request.headers.get("X-CSRF-Token", "")
    if not csrf_cookie or not csrf_header:
        return False
    return hmac.compare_digest(csrf_cookie, csrf_header)


# ── Cookie helpers ────────────────────────────────────────────────────────────

def _cookie_secure_kwargs():
    return {
        "httponly": True,
        "samesite": "Lax",
        "secure": COOKIE_SECURE,
        "path": "/",
    }


def _set_csrf_cookie(resp, token: str) -> None:
    # Not HttpOnly by design: JS reads it and sends it in X-CSRF-Token header.
    resp.set_cookie(
        "mt_csrf",
        token,
        httponly=False,
        samesite="Lax",
        secure=COOKIE_SECURE,
        path="/",
    )


def _set_auth_cookies(resp, username: str) -> str:
    csrf_token = _issue_csrf_token()
    resp.set_cookie("mt_user", username, **_cookie_secure_kwargs())
    _set_csrf_cookie(resp, csrf_token)
    return csrf_token


def _clear_auth_cookies(resp) -> None:
    resp.delete_cookie("mt_user", path="/")
    resp.delete_cookie("mt_csrf", path="/")
