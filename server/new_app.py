# server/new_app.py
# Backward-compatible entry point — delegates to app.py
# All business logic has been moved to separate modules:
#   - ingestion.py (file parsing)
#   - categorization.py (auto-categorization)
#   - analytics.py (summary + statistics)
#   - validation.py (save constraints)
#   - utils.py (shared helpers)

import os
import sys
from pathlib import Path

# Ensure server directory is on the path
SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
if SERVER_DIR not in sys.path:
    sys.path.insert(0, SERVER_DIR)

from app import app, _port, CLIENT_DIR, USERS_DIR

# Allow overriding CLIENT_DIR for Docker/Vite dist deployments
_env_client = os.environ.get("MONEYTRON_CLIENT_DIR", "").strip()
if _env_client:
    import app as _app_module
    _app_module.CLIENT_DIR = Path(_env_client).resolve()

if __name__ == "__main__":
    port = _port()
    url = f"http://127.0.0.1:{port}/"
    print("\n====================================================")
    print(" MoneyTron backend is starting...")
    print(f" Open this in your browser: {url}")
    print("====================================================\n")
    print(f"[MoneyTron] Using Flask dev server with auto-reload")
    print(f"[MoneyTron] Serving client from: {CLIENT_DIR}")
    print(f"[MoneyTron] Data dir: {USERS_DIR}")
    app.run(host="0.0.0.0", port=port, debug=True, use_reloader=True)
