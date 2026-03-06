# server/categorization.py
"""
Auto-categorization engine (per-user memory / learning).
Ported from client/index.html auto-category helpers.
"""

import math
from collections import defaultdict

from utils import norm_heb_en_vendor


# ── Similarity helpers ───────────────────────────────────────────────────────

def token_sim(a, b):
    """Token-based Jaccard similarity."""
    A = set(a.split()) - {""}
    B = set(b.split()) - {""}
    if not A or not B:
        return 0.0
    inter = len(A & B)
    uni = len(A | B)
    return inter / uni if uni else 0.0


def amount_close(a, b):
    """Return True if two amounts are within ±1 or ±2%."""
    try:
        A, B = float(a or 0), float(b or 0)
    except (ValueError, TypeError):
        return False
    if not math.isfinite(A) or not math.isfinite(B):
        return False
    tol = max(1.0, 0.02 * max(abs(A), abs(B)))
    return abs(A - B) <= tol


# ── Index builder ────────────────────────────────────────────────────────────

def build_past_index(past_data):
    """
    Build an in-memory vendor index from past_data.
    Returns: dict  normalized_vendor_key -> {
        raw_names: set, samples: list, cat_count: Counter,
        sub_count: Counter, type_count: Counter, amount_list: list
    }
    """
    arr = past_data if isinstance(past_data, list) else []
    by_vendor = {}

    for r in arr:
        if not isinstance(r, dict):
            continue
        key = norm_heb_en_vendor(r.get("name", ""))
        if not key:
            continue
        if key not in by_vendor:
            by_vendor[key] = {
                "raw_names": set(),
                "samples": [],
                "cat_count": defaultdict(int),
                "sub_count": defaultdict(int),
                "type_count": defaultdict(int),
                "amount_list": [],
            }
        obj = by_vendor[key]
        obj["raw_names"].add(r.get("name", ""))
        obj["samples"].append(r)
        if r.get("category"):
            obj["cat_count"][r["category"]] += 1
        if r.get("subcategory"):
            obj["sub_count"][r["subcategory"]] += 1
        if r.get("type"):
            obj["type_count"][r["type"]] += 1
        try:
            amt = float(r.get("debit", 0))
            if math.isfinite(amt):
                obj["amount_list"].append(amt)
        except (ValueError, TypeError):
            pass

    return by_vendor


def _majority(counter):
    """Return the key with the highest count, or None."""
    if not counter:
        return None
    return max(counter, key=counter.get)


def _best_type(obj):
    return _majority(obj["type_count"]) or "Expense"


def _best_category(obj):
    return _majority(obj["cat_count"]) or ""


def _best_subcategory(obj):
    return _majority(obj["sub_count"]) or ""


def _validate_cat_sub(chosen_cat, chosen_sub, categories):
    """
    Ensure subcategory belongs to the chosen category.
    categories: dict { cat_name: [sub1, sub2, ...] }
    """
    if not chosen_cat:
        return {"category": "", "subcategory": ""}
    subs = categories.get(chosen_cat, []) if isinstance(categories, dict) else []
    if not chosen_sub or chosen_sub not in subs:
        return {"category": chosen_cat, "subcategory": ""}
    return {"category": chosen_cat, "subcategory": chosen_sub}


# ── Match one row ────────────────────────────────────────────────────────────

def match_one(row, by_vendor, categories):
    """
    Try to pick category/subcategory/type for a single transaction row.
    Returns dict with: category, subcategory, type, confidence, reason.
    """
    name_key = norm_heb_en_vendor(row.get("name", ""))
    debit = float(row.get("debit") or row.get("amount") or 0)

    # A) Exact name bucket
    exact = by_vendor.get(name_key)
    if exact:
        # A1) Name + amount within tolerance
        close = [
            s for s in exact["samples"]
            if amount_close(float(s.get("debit") or s.get("amount") or 0), debit)
        ]
        if close:
            cat_count = defaultdict(int)
            sub_count = defaultdict(int)
            type_count = defaultdict(int)
            for s in close:
                if s.get("category"):
                    cat_count[s["category"]] += 1
                if s.get("subcategory"):
                    sub_count[s["subcategory"]] += 1
                if s.get("type"):
                    type_count[s["type"]] += 1
            picked_type = _majority(type_count) or _best_type(exact)
            picked_cat = _majority(cat_count) or _best_category(exact)
            picked_sub = _majority(sub_count) or _best_subcategory(exact)
            v = _validate_cat_sub(picked_cat, picked_sub, categories)
            return {**v, "type": picked_type, "confidence": 0.98, "reason": "name+amount"}

        # A2) Name-only majority
        v = _validate_cat_sub(_best_category(exact), _best_subcategory(exact), categories)
        return {**v, "type": _best_type(exact), "confidence": 0.9, "reason": "name-only"}

    # B) Fuzzy: look across all vendors for near names
    best_score, best_obj = 0.0, None
    for k, obj in by_vendor.items():
        s1, s2 = name_key, k
        # substring containment
        cont = 1 if (s1 and s2 and (s1 in s2 or s2 in s1)) else 0
        js = token_sim(s1, s2)
        score = max(js, 0.86 if cont else 0)
        if score > best_score:
            best_score, best_obj = score, obj

    if best_obj and best_score >= 0.85:
        any_close = any(
            amount_close(float(s.get("debit") or s.get("amount") or 0), debit)
            for s in best_obj["samples"]
        )
        picked_type = _best_type(best_obj)
        picked_cat = _best_category(best_obj)
        picked_sub = _best_subcategory(best_obj)
        v = _validate_cat_sub(picked_cat, picked_sub, categories)
        conf = 0.88 if any_close else 0.82
        reason = "fuzzy+amount" if any_close else "fuzzy"
        return {**v, "type": picked_type, "confidence": conf, "reason": reason}

    # No confident guess
    return {
        "category": "",
        "subcategory": "",
        "type": row.get("type", "Expense"),
        "confidence": 0.0,
        "reason": "none",
    }


# ── Batch auto-categorize ───────────────────────────────────────────────────

def auto_categorize_rows(built_rows, past_data, categories):
    """
    Apply auto-categorization to a list of parsed transaction rows.

    Args:
        built_rows: list of transaction dicts from ingestion
        past_data: list of past transaction dicts (user history)
        categories: dict { cat_name: [sub1, sub2, ...] }

    Returns:
        list of transaction dicts with category/subcategory/type filled where confident
    """
    by_vendor = build_past_index(past_data)
    out = []
    for r in built_rows:
        guess = match_one(r, by_vendor, categories)
        next_row = dict(r)
        if guess["confidence"] >= 0.85:
            next_row["type"] = guess["type"] or next_row.get("type", "Expense")
            next_row["category"] = guess["category"] or ""
            next_row["subcategory"] = guess["subcategory"] or ""
            if next_row["category"] or next_row["subcategory"]:
                next_row["__auto"] = {
                    "confidence": guess["confidence"],
                    "reason": guess["reason"],
                }
        out.append(next_row)
    return out
