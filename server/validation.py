# server/validation.py
"""
Save constraints / validation for transactions.
"""


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

    return {"valid": len(errors) == 0, "errors": errors}
