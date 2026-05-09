# server/analytics_legacy.py
"""
Deprecated analytics functions kept for backward compatibility.
These back the old /api/statistics/summary, /category_last3_mean,
/income_means, and /rollup endpoints.
"""

from analytics import _parse_tag_year


def compute_statistics_summary(past_data, payload):
    """DEPRECATED — backed by /api/statistics/summary. Use compute_statistics() instead."""
    tags = payload.get("tags", [])
    years = payload.get("years", [])
    category = payload.get("category", "")
    subcategories = payload.get("subcategories", [])
    tx_type = payload.get("type", "All")

    by_tag = {}
    for tx in (past_data or []):
        if not isinstance(tx, dict):
            continue
        tx_month, tx_year = _parse_tag_year(tx)
        tx_tag = tx_month
        if tags and tx_tag not in tags:
            continue
        if years and tx_year not in years:
            continue
        if tx_type != "All" and tx.get("type") != tx_type:
            continue
        if category and tx.get("category") != category:
            continue
        if subcategories and tx.get("subcategory") not in subcategories:
            continue
        if tx_tag not in by_tag:
            by_tag[tx_tag] = []
        by_tag[tx_tag].append(abs(float(tx.get("debit", 0))))

    result = []
    for tag in sorted(by_tag.keys()):
        amounts = by_tag[tag]
        result.append({
            "tag": tag,
            "mean": sum(amounts) / len(amounts) if amounts else 0,
            "count": len(amounts),
        })

    all_amounts = [a for amounts in by_tag.values() for a in amounts]
    combined_mean = sum(all_amounts) / len(all_amounts) if all_amounts else 0

    return {"per_tag": result, "combined_mean": combined_mean}


def compute_category_last3_mean(past_data, category):
    """Mean for a category over the last 3 months with data."""
    if not category:
        return {"data": []}

    by_tag = {}
    for tx in (past_data or []):
        if not isinstance(tx, dict):
            continue
        if tx.get("category") != category:
            continue
        tx_month, _ = _parse_tag_year(tx)
        tx_tag = tx_month
        if not tx_tag:
            continue
        if tx_tag not in by_tag:
            by_tag[tx_tag] = []
        by_tag[tx_tag].append(abs(float(tx.get("debit", 0))))

    sorted_tags = sorted(by_tag.keys(), reverse=True)[:3]
    sorted_tags.reverse()

    return {
        "data": [
            {"tag": tag, "mean": sum(by_tag[tag]) / len(by_tag[tag]) if by_tag[tag] else 0}
            for tag in sorted_tags
        ]
    }


def compute_income_means(past_data, payload):
    """Mean income grouped by category and subcategory."""
    tags = payload.get("tags", [])
    years = payload.get("years", [])

    by_cat_sub = {}
    for tx in (past_data or []):
        if not isinstance(tx, dict):
            continue
        if tx.get("type") != "Income":
            continue
        tx_month, tx_year = _parse_tag_year(tx)
        tx_tag = tx_month
        if tags and tx_tag not in tags:
            continue
        if years and tx_year not in years:
            continue
        cat = tx.get("category", "Uncategorized")
        sub = tx.get("subcategory", "—")
        key = (cat, sub)
        if key not in by_cat_sub:
            by_cat_sub[key] = []
        by_cat_sub[key].append(abs(float(tx.get("debit", 0))))

    result = []
    for (cat, sub) in sorted(by_cat_sub.keys()):
        amounts = by_cat_sub[(cat, sub)]
        result.append({
            "category": cat,
            "subcategory": sub,
            "mean": sum(amounts) / len(amounts) if amounts else 0,
            "count": len(amounts),
        })

    all_amounts = [a for amounts in by_cat_sub.values() for a in amounts]
    overall_mean = sum(all_amounts) / len(all_amounts) if all_amounts else 0

    return {"breakdown": result, "overall_mean": overall_mean}


def compute_rollup(past_data, payload):
    """Table of totals, means, counts per (year, tag)."""
    tags = payload.get("tags", [])
    years = payload.get("years", [])
    tx_type = payload.get("type", "All")

    by_year_tag = {}
    for tx in (past_data or []):
        if not isinstance(tx, dict):
            continue
        tx_month, tx_year = _parse_tag_year(tx)
        tx_tag = tx_month
        tx_tx_type = tx.get("type", "Expense")
        if tags and tx_tag not in tags:
            continue
        if years and tx_year not in years:
            continue
        if tx_type != "All" and tx_tx_type != tx_type:
            continue
        key = (tx_year, tx_tag)
        if key not in by_year_tag:
            by_year_tag[key] = []
        by_year_tag[key].append(abs(float(tx.get("debit", 0))))

    result = []
    for (year, tag) in sorted(by_year_tag.keys()):
        amounts = by_year_tag[(year, tag)]
        result.append({
            "year": year,
            "tag": tag,
            "total": sum(amounts),
            "mean": sum(amounts) / len(amounts) if amounts else 0,
            "count": len(amounts),
        })

    return {"data": result}
