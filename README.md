# Moneytron — Personal Finance Tracker

A self-hosted web app for tracking expenses and income. Upload bank exports (CSV/XLSX/XLS), auto-categorize transactions, and analyze spending across months and years. Deployed on Google Cloud Run.

---

## Screenshots

| Transactions | Summary | Statistics |
|---|---|---|
| ![Transactions](screenshots/transactions%20page.png) | ![Summary](screenshots/summary%20page.png) | ![Statistics](screenshots/statistic%20page.png) |

| Data | Categories |
|---|---|
| ![Data](screenshots/data%20page.png) | ![Categories](screenshots/catagory%20page.png) |

---

## Features

- **Upload bank files** — CSV, XLSX, XLS; auto-detects Israeli bank formats (Leumi, Hapoalim, Max, Cal)
- **Auto-categorization** — matches vendors against past transactions via fuzzy matching
- **Monthly summary** — bar and pie charts with month-over-month drill-down
- **Statistics dashboard** — filter by year, category, type; min/max/mean/rollup views
- **Historical data editor** — edit, flag, or delete past transactions
- **Category management** — custom categories and subcategories with bulk re-assignment
- **Multi-currency** — ILS, USD, EUR, GBP; flag transactions to exclude from totals
- **Multi-user** — separate data per user account; bcrypt passwords, CSRF protection
- **Feedback** — in-app feedback button with optional email delivery

---

## Tech Stack

- **Backend:** Python 3.11, Flask 2.3, Gunicorn
- **Frontend:** React 18 SPA, Vite 5, Chart.js 4.4.1
- **Storage:** JSON files per user — no database
- **Deployment:** Google Cloud Run + Cloud Storage (GCS)

---

## Running Locally (Dev)

```bash
# Backend — terminal 1
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python3 server/new_app.py          # http://127.0.0.1:5003/

# Frontend dev server — terminal 2 (HMR, proxies /api to :5003)
cd client && npm install && npm run dev   # http://localhost:5173
```

For a production build served by Flask:

```bash
cd client && npm run build   # outputs to client/dist/
python3 server/new_app.py    # serves built frontend + API
```

---

## Deploying to Google Cloud Run

Prerequisites: `gcloud` CLI installed and authenticated.

```bash
# First deploy — provisions Cloud Run, Artifact Registry, and GCS bucket
./deploy.sh

# Redeploy after code changes
./deploy.sh -SkipSetup
```

On Windows (PowerShell):

```powershell
.\deploy.ps1
.\deploy.ps1 -SkipSetup
```

The deploy script:
1. Enables required GCP APIs
2. Creates an Artifact Registry repo and GCS bucket for user data
3. Builds and pushes a Docker image via Cloud Build
4. Deploys to Cloud Run and prints the live URL

Environment variables used at runtime:

| Variable | Purpose |
|----------|---------|
| `MONEYTRON_DATA_DIR` | User data directory (default: `users/`) |
| `MONEYTRON_CLIENT_DIR` | Path to built frontend (default: `client/dist/`) |
| `PORT` | HTTP port (default 8080 on Cloud Run) |
| `SMTP_HOST/PORT/USER/PASS` | Optional — enables email delivery for feedback |

---

## Data & Privacy

Each user's data lives entirely in `users/<username>/` (or GCS in production) — four JSON files per account: `settings.json`, `categories.json`, `current_month_transactions.json`, `past_data.json`. No analytics, no third-party tracking.
