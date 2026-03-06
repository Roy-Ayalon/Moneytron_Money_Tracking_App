# MoneyTron - Personal Finance Tracker

A simple, cross-platform personal finance tracker for families and friends.
Upload your bank/credit files, categorize transactions, and view monthly summaries - all in your browser. Data lives in the local `users/` folder (or a cloud volume when deployed).

---

## Screenshots

**Transactions Tab**
![Transactions Tab](screenshots/transactions%20page.png)

**Summary Tab**
![Summary Tab](screenshots/summary%20page.png)

**Statistics Tab**
![Statistics Tab](screenshots/statistic%20page.png)

**Data Tab**
![Data Tab](screenshots/data%20page.png)

**Categories Tab**
![Categories Tab](screenshots/catagory%20page.png)

---

## Demo Videos

| Feature | Video |
|---|---|
| Sign Up | [Sign up.mov](videos/Sign%20up.mov) |
| Change Password | [change password.mov](videos/change%20password.mov) |
| Upload Transactions | [upload transactions.mov](videos/upload%20transactions.mov) |
| Summary Drill-Down | [summary double click.mov](videos/summary%20double%20click.mov) |
| Statistics Demo | [statistics demo.mov](videos/statistics%20demo.mov) |
| Add Category | [Add catagory.mov](videos/Add%20catagory.mov) |

---

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Quick Start (Dev Mode)](#quick-start-dev-mode)
- [Cloud Deployment (GCP)](#cloud-deployment-gcp)
- [Build & Package for macOS](#build--package-for-macos)
- [Build & Package for Windows](#build--package-for-windows)
- [For Family Users](#for-family-users)
- [Updating the App](#updating-the-app)
- [Expense vs Income](#expense-vs-income)
- [Auto-Categorization](#auto-categorization)
- [Multi-Currency Support](#multi-currency-support)
- [Feedback System](#feedback-system)
- [Troubleshooting](#troubleshooting)
- [Data & Privacy](#data--privacy)

---

## Features

- **Multi-user** - Each person has their own folder under `users/<Name>/` with separate categories, transactions, and settings.
- **Transactions** - Upload monthly bank/credit files (CSV/XLSX; Hebrew headers supported), review, and categorize.
- **Auto-categorization** - Transactions are automatically categorized on upload based on past data patterns.
- **Manual entry** - Add single transactions manually if needed.
- **Summary** - View totals by category/month with bar charts, pie charts, and cross-month comparison tables.
- **Statistics** - Powerful analytics dashboard with filtering by time period, type, categories, and export capabilities.
- **Data management** - Edit historical transactions with advanced multi-level filtering.
- **Multi-currency** - Toggle between ILS, USD, EUR, GBP per transaction.
- **Feedback system** - Built-in "Send Idea" button that saves feedback and emails it to the developer.
- **Tutorial** - In-app guide with quick startup instructions, expense vs income explanation, and feature walkthroughs.
- **Cloud deployable** - Dockerfile and deploy script included for Google Cloud Run with persistent storage.
- **No internet required** - Everything runs locally at `http://127.0.0.1:5003/` (or behind a cloud URL).

---

## Project Structure

```
MoneyTron/
+-- server/
|   +-- app.py                 # Flask backend - routes, auth, file I/O
|   +-- new_app.py             # Entry point (delegates to app.py)
|   +-- ingestion.py           # File parsing engine (XLS/XLSX/CSV)
|   +-- categorization.py      # Auto-categorization engine
|   +-- analytics.py           # Summary aggregation + statistics
|   +-- validation.py          # Save constraints / validation
|   +-- utils.py               # Shared helpers (date parsing, normalization)
+-- client/
|   +-- index.html             # Single-file React frontend (Babel JSX)
+-- users/
|   +-- <Username>/
|       +-- categories.json
|       +-- current_month_transactions.json
|       +-- past_data.json
|       +-- settings.json
+-- screenshots/               # App screenshots
+-- videos/                    # Demo videos
+-- Dockerfile                 # Cloud deployment container
+-- deploy.ps1                 # GCP Cloud Run deployment script (Windows)
+-- deploy.sh                  # GCP Cloud Run deployment script (macOS/Linux)
+-- requirements.txt           # Python dependencies
+-- start.command              # macOS launcher
+-- start.bat                  # Windows launcher
+-- README.md
```

---

## Architecture

- **Backend:** Python Flask (served via Waitress in production, gunicorn in Docker).
- **Frontend:** Single-file React app (`client/index.html`) using Babel JSX, Chart.js for visualizations, and Day.js for dates.
- **Storage:** JSON files per user in the `users/` directory. No database required.
- **Auth:** Password hashing (SHA-256) stored in `settings.json`. Cookie-based session (`mt_user`).
- **File Parsing:** Server-side parsing of Excel/CSV files using `openpyxl`, `xlrd`, and `csv`. Supports Hebrew bank formats (Leumi, Hapoalim, Max, Cal, etc.).
- **Auto-Categorization:** Vendor name matching + majority logic from past transactions, with fuzzy token-based similarity fallback.

---

## Quick Start (Dev Mode)

1. **Python & venv**
   ```bash
   cd MoneyTron
   python3 -m venv .venv            # Windows: py -m venv .venv
   source .venv/bin/activate        # Windows: .\.venv\Scripts\activate
   pip install -U pip flask waitress openpyxl xlrd beautifulsoup4 lxml
   ```

2. **Run the server**
   ```bash
   python3 server/new_app.py        # Windows: py server/new_app.py
   ```

3. **Open the app**
   Go to http://127.0.0.1:5003/ in your browser.

---

## Cloud Deployment (GCP)

MoneyTron includes a Dockerfile and deployment scripts for Google Cloud Run with persistent user data via GCS bucket mount.

**Windows (PowerShell):**
```powershell
# First time (full setup)
.\deploy.ps1

# Redeploy after code changes
.\deploy.ps1 -SkipSetup
```

**macOS / Linux (Bash):**
```bash
# First time (full setup)
./deploy.sh

# Redeploy after code changes
./deploy.sh -SkipSetup
```

See [DEPLOY_GUIDE.md](DEPLOY_GUIDE.md) for detailed instructions.

---

## Build & Package for macOS

1. **Install build deps**
   ```bash
   cd MoneyTron
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Build the single-file app**
   ```bash
   pyinstaller --name MoneyTron --onefile --add-data "client:client" server/new_app.py
   ```

3. **Move the executable**
   ```bash
   mv dist/MoneyTron .
   chmod +x start.command
   ```

4. **Prepare a zip** containing: `MoneyTron` (executable), `client/`, `users/`, `start.command`.

---

## Build & Package for Windows

1. **Install build deps (cmd)**
   ```bat
   cd MoneyTron
   py -m venv .venv
   .\.venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Build the single-file app (cmd)**
   ```bat
   pyinstaller --name MoneyTron --onefile --add-data "client;client" server\new_app.py
   ```

3. **Move the executable**
   ```bat
   move dist\MoneyTron.exe .
   ```

4. **Prepare a zip** containing: `MoneyTron.exe`, `client\`, `users\`, `start.bat`.

---

## For Family Users

### macOS
1. Unzip the folder you received.
2. Double-click `start.command` (right-click -> Open if macOS blocks it).
3. The app opens in your browser at **http://127.0.0.1:5003/**.

### Windows
1. Unzip the folder you received.
2. Double-click `start.bat` (click "More info -> Run anyway" if SmartScreen appears).
3. Your browser opens at **http://127.0.0.1:5003/**.

> **Your data lives in the `users/` folder.** Back it up occasionally.

---

## Updating the App

1. **Developer:** Rebuild the app and send a new zip.
2. **Family:** Delete the old folder, unzip the new one, and copy the old `users/` folder into the new location.

---

## Expense vs Income

MoneyTron distinguishes between **Expense** and **Income** transactions:

- **Expense** - Money going out (purchases, bills, subscriptions). Shown in red.
- **Income** - Money coming in (salary, refunds, transfers received). Shown in green.

When uploading bank files, the app auto-detects the type based on the sign of the amount. You can manually toggle any transaction's type by clicking the Expense/Income button in the table.

In the **Summary** tab, the "Net (Income - Expenses)" row shows the difference. Categories and subcategories are primarily used for expense tracking.

---

## Auto-Categorization

When you upload a bank file, MoneyTron automatically categorizes transactions by:

1. **Vendor name matching** - Normalizes names and looks for exact/similar vendors in past data.
2. **Majority logic** - Assigns the most common category/subcategory/type for each vendor.
3. **Fuzzy matching** - Uses token-based similarity for near matches (e.g., similar store names).
4. **Amount proximity** - Higher confidence when amounts are close to previous transactions.

The more you use MoneyTron and categorize transactions, the smarter the auto-categorization becomes.

---

## Multi-Currency Support

MoneyTron supports ILS, USD, EUR, and GBP:

1. Go to **Settings** tab and enable/disable currencies under "Allowed Currencies for Toggling".
2. In **Transactions** or **Data** tabs, click the currency button to cycle through enabled currencies.
3. Currency toggling is for labeling only - no automatic conversion.

---

## Feedback System

MoneyTron has a built-in feedback system (the "Send Idea" button in the bottom-right corner):

- Feedback is saved to a local file on the server (`users/_feedback.json`).
- If the user has an email address (set during sign-up), the feedback is emailed to the developer.
- Email sending uses SMTP (configurable via `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` environment variables).

---

## Troubleshooting

**Nothing opens / only background color**
- Ensure `client/index.html` exists next to the executable.
- Check the browser console (F12) for 404 errors.

**Port 5003 already in use**
- macOS: `lsof -ti:5003 | xargs kill -9`
- Windows: `for /f "tokens=5" %a in ('netstat -ano ^| findstr :5003') do taskkill /PID %a /F`

**macOS says the file is from an unidentified developer**
- Right-click `start.command` -> Open -> Open.
- Or: `xattr -dr com.apple.quarantine .`

**PowerShell build errors**
- Use Command Prompt (cmd) for build commands, or put everything on one line in PowerShell.

---

## Data & Privacy

- All data stays local in `users/<Name>/`.
- To back up, copy the entire `users/` folder.
- To move computers, copy `users/` into the new MoneyTron folder.
- No data is sent to any external service (except optional feedback emails).

**Files per user:**
- `categories.json` - Categories & subcategories
- `current_month_transactions.json` - Staged transactions (current upload)
- `past_data.json` - All saved historical transactions
- `settings.json` - User preferences (date format, currency, password hash, email)
