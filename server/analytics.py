# server/analytics.py
"""
Analytics: summary aggregation (for Summary tab) + statistics (for Statistics tab).
Summary aggregation ported from client/index.html SummaryTab `agg` useMemo.
Statistics moved from new_app.py inline endpoints.
"""

from datetime import date
from statistics import median


def _parse_tag_year(row):
    """
    Extract numeric (month, year) from a row, supporting both old and new tag formats.
    Old format: tag=2, year=2026
    New format: tag="2/26", year=2026 (year field still present)
    Returns (month_int, year_int) or (0, 0) if unparsable.
    """
    raw_tag = str(row.get("tag") or "")
    if "/" in raw_tag:
        try:
            parts = raw_tag.split("/", 1)
            m = int(parts[0])
            yr = int(parts[1])
            if yr < 100:
                yr += 2000
            return (m, yr)
        except (ValueError, TypeError):
            pass
    # Fallback: use month_tag (or numeric tag) + year
    m = 0
    try:
        m = int(row.get("month_tag") or row.get("tag") or 0)
    except (ValueError, TypeError):
        pass
    yr = 0
    try:
        yr = int(row.get("year") or 0)
    except (ValueError, TypeError):
        pass
    if yr == 0:
        yr = date.today().year
    return (m, yr)


# ── Summary (for SummaryTab) ─────────────────────────────────────────────────

def compute_summary(past_data):
    """
    Aggregate past_data into the shape needed by the SummaryTab:
    - months: sorted list of month keys like "7/25"
    - mcdAll: { monthKey: { category: { total, incomeTotal, expenseTotal, type, subcategories: { sub: {total, incomeTotal, expenseTotal}} } } }
    - monthNet: { monthKey: { net, income, outcome } }
    - outTotals: list of outcome amounts per month (same order as months)
    """
    months_set = {}   # monthKey -> sortKey
    mio = {}          # monthKey -> {income, outcome}
    mcd_all = {}      # monthKey -> { cat -> { total, incomeTotal, expenseTotal, type, subcategories } }

    for r in (past_data or []):
        if not isinstance(r, dict):
            continue
        tag, year = _parse_tag_year(r)
        if tag == 0:
            continue

        m = f"{tag}/{str(year)[-2:]}"
        sort_key = year * 100 + tag

        if m not in months_set:
            months_set[m] = sort_key

        d = 0.0
        try:
            d = float(r.get("debit", 0))
        except (ValueError, TypeError):
            pass

        inc = str(r.get("type", "")).lower() == "income"

        if m not in mio:
            mio[m] = {"income": 0.0, "outcome": 0.0}
        if inc:
            mio[m]["income"] += d
        else:
            mio[m]["outcome"] += d

        cat = r.get("category") or "Uncategorized"
        sub = r.get("subcategory") or "\u2014"  # em-dash

        if m not in mcd_all:
            mcd_all[m] = {}
        if cat not in mcd_all[m]:
            mcd_all[m][cat] = {
                "total": 0.0,
                "incomeTotal": 0.0,
                "expenseTotal": 0.0,
                "subcategories": {},
                "type": "Income" if inc else "Expense",
            }
        cat_obj = mcd_all[m][cat]
        if inc:
            cat_obj["incomeTotal"] += d
        else:
            cat_obj["expenseTotal"] += d
        cat_obj["total"] = cat_obj["incomeTotal"] - cat_obj["expenseTotal"]
        if cat_obj["incomeTotal"] > cat_obj["expenseTotal"]:
            cat_obj["type"] = "Income"
        elif cat_obj["expenseTotal"] > cat_obj["incomeTotal"]:
            cat_obj["type"] = "Expense"

        if sub not in cat_obj["subcategories"]:
            cat_obj["subcategories"][sub] = {
                "total": 0.0,
                "incomeTotal": 0.0,
                "expenseTotal": 0.0,
            }
        sub_obj = cat_obj["subcategories"][sub]
        if inc:
            sub_obj["incomeTotal"] += d
        else:
            sub_obj["expenseTotal"] += d
        sub_obj["total"] = sub_obj["incomeTotal"] - sub_obj["expenseTotal"]

    months = sorted(months_set.keys(), key=lambda m: months_set[m])

    month_net = {}
    for m in months:
        io = mio.get(m, {"income": 0, "outcome": 0})
        month_net[m] = {
            "net": io["income"] - io["outcome"],
            "income": io["income"],
            "outcome": io["outcome"],
        }

    out_totals = [mio.get(m, {}).get("outcome", 0) for m in months]

    return {
        "months": months,
        "mcdAll": mcd_all,
        "monthNet": month_net,
        "outTotals": out_totals,
    }


# ── Statistics (unified endpoint) ────────────────────────────────────────────

def compute_statistics(past_data, payload):
    """
    Compute monthly statistics over selected (year, tag) cells.
    Moved from new_app.py api_statistics().

    payload keys:
        years, tagsByYear, type, categories, subcategories, quickFilter
    """
    years = payload.get("years", [])
    tags_by_year = payload.get("tagsByYear", {})
    tx_type = payload.get("type", "Expense")
    categories_filter = payload.get("categories", [])
    subcategories_filter = payload.get("subcategories", [])
    quick_filter = payload.get("quickFilter", "none")

    past = past_data or []

    # Handle quick filters
    if quick_filter in ("last3", "last6", "alltime"):
        year_tag_pairs = set()
        for tx in past:
            if not isinstance(tx, dict):
                continue
            m, yr = _parse_tag_year(tx)
            if m > 0 and yr > 0:
                year_tag_pairs.add((yr, m))

        sorted_pairs = sorted(year_tag_pairs, reverse=True)
        if quick_filter == "last3":
            selected_pairs = sorted_pairs[:3]
        elif quick_filter == "last6":
            selected_pairs = sorted_pairs[:6]
        else:
            selected_pairs = sorted_pairs

        years = sorted(set(y for y, _ in selected_pairs))
        tags_by_year = {}
        for y, t in selected_pairs:
            y_str = str(y)
            if y_str not in tags_by_year:
                tags_by_year[y_str] = []
            tags_by_year[y_str].append(t)

    # Build set of selected (year, tag) cells
    selected_cells = set()
    for year in years:
        for tag in tags_by_year.get(str(year), []):
            selected_cells.add((int(year), int(tag)))

    if len(selected_cells) < 2:
        return {
            "error": "Select at least two months to calculate statistics.",
            "months": [],
            "summary": {
                "total_over_period": 0,
                "avg_monthly": 0,
                "median_monthly": 0,
                "min_monthly": 0,
                "max_monthly": 0,
            },
            "top_categories": [],
        }

    # Filter transactions
    filtered = []
    for tx in past:
        if not isinstance(tx, dict):
            continue
        tx_month, tx_year = _parse_tag_year(tx)
        if tx_month == 0 or tx_year == 0:
            continue
        if (tx_year, tx_month) not in selected_cells:
            continue
        if tx.get("type") != tx_type:
            continue
        if categories_filter:
            if tx.get("category") not in categories_filter:
                continue
            if len(categories_filter) == 1 and subcategories_filter:
                if tx.get("subcategory") not in subcategories_filter:
                    continue
        filtered.append(tx)

    # Monthly totals
    monthly_totals = {cell: {"total": 0.0, "count": 0} for cell in selected_cells}

    for tx in filtered:
        tx_month, tx_year = _parse_tag_year(tx)
        amount = abs(float(tx.get("debit") or tx.get("amount") or 0))
        key = (tx_year, tx_month)
        if key in monthly_totals:
            monthly_totals[key]["total"] += amount
            monthly_totals[key]["count"] += 1

    months_array = []
    totals_list = []
    for (year, tag), data in sorted(monthly_totals.items()):
        months_array.append({
            "year": year,
            "tag": tag,
            "total": round(data["total"], 2),
            "count": data["count"],
        })
        totals_list.append(data["total"])

    num_months = len(totals_list)
    total_over_period = sum(totals_list)
    avg_monthly = total_over_period / num_months if num_months > 0 else 0

    sorted_totals = sorted(totals_list)
    if num_months > 0:
        if num_months % 2 == 0:
            median_monthly = (sorted_totals[num_months // 2 - 1] + sorted_totals[num_months // 2]) / 2
        else:
            median_monthly = sorted_totals[num_months // 2]
    else:
        median_monthly = 0

    min_monthly = min(totals_list) if totals_list else 0
    max_monthly = max(totals_list) if totals_list else 0

    # Top categories/subcategories
    top_categories = []
    if not categories_filter:
        cat_totals = {}
        for tx in filtered:
            cat = tx.get("category", "")
            if not cat:
                continue
            amount = abs(float(tx.get("debit") or tx.get("amount") or 0))
            cat_totals[cat] = cat_totals.get(cat, 0.0) + amount
        sorted_cats = sorted(cat_totals.items(), key=lambda x: x[1], reverse=True)[:10]
        for cat, total in sorted_cats:
            top_categories.append({
                "name": cat,
                "total": round(total, 2),
                "avg_per_month": round(total / num_months, 2) if num_months > 0 else 0,
            })
    elif len(categories_filter) == 1:
        sub_totals = {}
        for tx in filtered:
            sub = tx.get("subcategory", "")
            if not sub:
                continue
            amount = abs(float(tx.get("debit") or tx.get("amount") or 0))
            sub_totals[sub] = sub_totals.get(sub, 0.0) + amount
        sorted_subs = sorted(sub_totals.items(), key=lambda x: x[1], reverse=True)
        for sub, total in sorted_subs:
            top_categories.append({
                "name": sub,
                "total": round(total, 2),
                "avg_per_month": round(total / num_months, 2) if num_months > 0 else 0,
            })
    else:
        # Multiple categories selected — return ALL of them for pie chart
        cat_totals = {}
        for tx in filtered:
            cat = tx.get("category", "")
            if not cat:
                continue
            amount = abs(float(tx.get("debit") or tx.get("amount") or 0))
            cat_totals[cat] = cat_totals.get(cat, 0.0) + amount
        sorted_cats = sorted(cat_totals.items(), key=lambda x: x[1], reverse=True)
        for cat, total in sorted_cats:
            top_categories.append({
                "name": cat,
                "total": round(total, 2),
                "avg_per_month": round(total / num_months, 2) if num_months > 0 else 0,
            })

    return {
        "months": months_array,
        "summary": {
            "total_over_period": round(total_over_period, 2),
            "avg_monthly": round(avg_monthly, 2),
            "median_monthly": round(median_monthly, 2),
            "min_monthly": round(min_monthly, 2),
            "max_monthly": round(max_monthly, 2),
        },
        "top_categories": top_categories,
    }


# ── Deprecated statistics endpoints (kept for backward compat) ───────────────

def compute_statistics_summary(past_data, payload):
    """DEPRECATED - old /api/statistics/summary"""
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
        tx_tag = tx_month  # use numeric month for grouping
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
        sub = tx.get("subcategory", "\u2014")
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
