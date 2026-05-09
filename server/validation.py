# server/validation.py
"""
Save constraints / validation for transactions.
"""

import re

_ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_VALID_TYPES = {"Expense", "Income"}


def validate_transactions(rows):
    """
    Validate that every transaction row has required fields before commit.
    Returns: { "valid": bool, "errors": [ { "row_index": int, "field": str, "message": str } ] }
    """
    errors = []

    if not rows:
        return {"valid": False, "errors": [{"row_index": -1, "field": "", "message": "No transactions to save"}]}

    for i, r in enumerate(rows):
        if not isinstance(r, dict):
            errors.append({"row_index": i, "field": "", "message": "Invalid row (not a dict)"})
            continue

        if not r.get("subcategory"):
            errors.append({
                "row_index": i,
                "field": "subcategory",
                "message": f"Row {i + 1}: Sub-category is required"
            })

        if not r.get("name"):
            errors.append({
                "row_index": i,
                "field": "name",
                "message": f"Row {i + 1}: Name is required"
            })

        tx_type = r.get("type", "")
        if tx_type not in _VALID_TYPES:
            errors.append({
                "row_index": i,
                "field": "type",
                "message": f"Row {i + 1}: type must be 'Expense' or 'Income', got '{tx_type}'"
            })

        try:
            amount = float(r.get("amount", r.get("debit", 0)))
            if amount < 0:
                raise ValueError
        except (TypeError, ValueError):
            errors.append({
                "row_index": i,
                "field": "amount",
                "message": f"Row {i + 1}: amount must be a non-negative number"
            })

        date_val = r.get("date", "")
        if date_val and not _ISO_DATE_RE.match(str(date_val)):
            errors.append({
                "row_index": i,
                "field": "date",
                "message": f"Row {i + 1}: date must be ISO format YYYY-MM-DD, got '{date_val}'"
            })

    return {"valid": len(errors) == 0, "errors": errors}
