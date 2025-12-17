# MoneyTron v4.0 — README

**🆕 Major Update: October 2025**  
MoneyTron v4.0 introduces a powerful Statistics Dashboard, unified DD-MM-YYYY date format, improved navigation, and enhanced auto-categorization. See [UPGRADE_SUMMARY.md](UPGRADE_SUMMARY.md) for complete details.

A simple, cross-platform personal finance tracker for families and friends.  
Upload your bank/credit files, categorize transactions, and view monthly summaries — all in your browser, with **no cloud and no accounts**. Data lives in the local `users/` folder.


---



## Screenshots

Below are screenshots of MoneyTron in action (see the `screenshots/` folder for all images):

**Login Page**
![Login Page](screenshots/login%20page.png)

**Categories Tab**
![Categories Tab](screenshots/catagories%20tab.png)

**Statistics Tab** 🆕
*A powerful analytics dashboard with filtering and insights.*

**Summary Tab (with data)**
![Summary Tab With Data](screenshots/summary%20tab%20st%20image.png)

**Transactions Tab**
![Transactions Tab](screenshots/transactions%20tab.png)

---



## Demo Video



https://github.com/user-attachments/assets/d97ff34d-4bb7-4767-bf24-8f172e75f099

h

---

---


## Table of contents

- [What's New in v4.0](#whats-new-in-v40)
- [What you can do](#what-you-can-do)
- [Project structure](#project-structure)
- [How it works (high-level)](#how-it-works-high-level)
- [Quick start (dev mode)](#quick-start-dev-mode)
- [Build & package for macOS](#build--package-for-macos)
- [Build & package for Windows](#build--package-for-windows)
- [For family users (how to run it)](#for-family-users-how-to-run-it)
- [Updating the app (what-to-do-on-update)](#updating-the-app-what-to-do-on-update)
- [Expense vs Income: How MoneyTron Handles Transaction Types](#expense-vs-income-how-moneytron-handles-transaction-types)
- [Auto-Categorization: How MoneyTron Suggests Categories & Subcategories](#auto-categorization-how-moneytron-suggests-categories--subcategories)
- [Troubleshooting](#troubleshooting)
- [Data & privacy](#data--privacy)

---

## What's New in v4.0

### 📈 Statistics Dashboard (replaces Settings tab)
- **Comprehensive filtering** by tags (months), years, categories, subcategories, and type
- **KPI cards** showing Mean, Max, Min, and transaction count
- **Per-tag analysis** with means across selected months
- **Income breakdown** by category and subcategory
- **Rollup tables** showing totals, means, and counts
- **Quick filters:** Last 3/6 months, Year-to-date (YTD)
- **CSV export** for external analysis

### 📅 DD-MM-YYYY Date Format Everywhere
- All dates now display as **DD-MM-YYYY** consistently
- Automatic conversion on import (supports multiple input formats)
- No more YYYY-MM-DD confusion
- New fields: `date_iso`, `date_str`, `year`, `month_tag`

### 🔧 Improved Transaction Upload
- **Automatic year and month detection** from dates
- **No manual tag entry** required
- Upload summary shows: rows imported, years detected, validation errors
- Enhanced auto-categorization confidence

### 📊 Enhanced Summary Tab
- Navigate **1 month at a time** (was 6 months)
- **Visual separation** for net totals row with purple border
- **Hides empty categories** automatically for cleaner view
- Better color coding (green for income, red for expenses)

### 🎯 Simplified Data Tab
- Streamlined to **3 KPI cards** (removed Total Spending)
- Focus on: Total Transactions, Categories, Active Months
- Cleaner, more focused interface

### 🐛 Bug Fixes
- **Fixed tag assignment:** Tags now correctly based on date only
- **Fixed date parsing:** Better handling of various date formats
- **Fixed category filtering:** Improved multi-level filtering

For complete details, see [UPGRADE_SUMMARY.md](UPGRADE_SUMMARY.md) and [QUICK_START.md](QUICK_START.md).

---

## What you can do

- **Multi-user:** each person has their own folder under `users/<Name>/`.
- **Transactions:** upload monthly bank/credit files (CSV/XLSX; Hebrew headers supported), review & categorize.
- **Manual add:** add single transactions if needed.
- **Summary:** view totals by category/month with enhanced navigation and visual clarity.
- **Statistics:** 🆕 Powerful analytics dashboard with filtering, KPIs, and export capabilities.
- **Data management:** Edit historical transactions with advanced filtering.
- **No internet required:** everything runs locally at `http://127.0.0.1:5003/`.

---

## Project structure

```
MoneyTron/
├─ server/
│  └─ new_app.py              # Flask backend (Waitress), serves the UI and APIs (port 5003)
├─ client/
│  └─ index.html              # Single-file React frontend
├─ users/
│  └─ Roy/
│     ├─ categories.json
│     ├─ current_month_transactions.json
│     └─ past_data.json
│     └─ settings.json
├─ start.command              # (macOS) double-click to run (kills port 5003; opens Chrome; starts app)
├─ Start_MoneyTron.bat        # (Windows) double-click to run (kills port 5003; opens browser; starts app)
└─ README.md
```

> The backend expects the **executable** (after packaging) to sit next to `client/` and `users/`.

---

## How it works (high-level)

- On launch, the backend serves `client/index.html` and static assets.  
- The `users/` directory stores all personal data (per user).  
- When you upload files, they are parsed, shown in **Transactions**, and (when you save) written to:
  - `users/<Name>/current_month_transactions.json`
  - `users/<Name>/past_data.json` (merge happens only when you explicitly save)

---

## Quick start (dev mode)

> Use this for local development, testing, or quick fixes without packaging.

1. **Python & venv**
   ```bash
   cd MoneyTron
   python3 -m venv .venv            # Windows: py -m venv .venv
   source .venv/bin/activate        # Windows: .\.venv\Scripts\activate
   pip install -U pip flask waitress
   ```

2. **Run the server**
   ```bash
   python3 server/new_app.py        # Windows: py server/new_app.py
   ```

3. **Open the app**  
   Go to http://127.0.0.1:5003/ in your browser.

---

## Build & package for macOS

> Requires Python 3.10–3.12 and PyInstaller.

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

3. **Move the executable next to folders**
   ```bash
   mv dist/MoneyTron .
   ```

4. **Create (or update) `start.command`**  
   Save this file at `MoneyTron/start.command`:

   ```bash
   #!/bin/bash
   set -euo pipefail

   if [ -n "${BASH_SOURCE:-}" ]; then
   SRC="${BASH_SOURCE[0]}"
   elif [ -n "${ZSH_VERSION:-}" ]; then
   SRC="${(%):-%N}"
   else
   SRC="$0"
   fi
   SCRIPT_DIR="$(cd "$(dirname "$SRC")" && pwd)"
   cd "$SCRIPT_DIR"

   echo "[Start] MoneyTron launcher"
   echo "[Start] Working dir: $(pwd)"

   echo "[Start] Checking for MoneyTron executable in working dir"
   echo "[Start] Users dir: $(pwd)/users"
   if [ ! -f "MoneyTron" ]; then
   echo "[Error] MoneyTron executable not found in working directory. Make sure the PyInstaller build is in this folder."
   read -n1 -r -p "Press any key to close..."
   exit 1
   fi


   # Check if port 5003 is in use and force kill it if so
   PIDS=$(lsof -ti :5003)
   if [ -n "$PIDS" ]; then
   echo "[Start] Port 5003 is in use. Force killing process(es): $PIDS"
   kill -9 $PIDS 2>/dev/null || true
   sleep 1
   fi

   echo "[Start] Launching server..."

   chmod +x "MoneyTron" || true
   xattr -dr com.apple.quarantine "MoneyTron" 2>/dev/null || true

   echo "[Start] Launching server..."
   nohup ./MoneyTron > "moneytron.log" 2>&1 &


   # Wait for server to be ready, then open browser
   ( 
   for i in {1..30}; do
      if curl -sSf http://127.0.0.1:5003 >/dev/null 2>&1; then
         if command -v "google-chrome" >/dev/null 2>&1; then
         "google-chrome" "http://127.0.0.1:5003"
         elif command -v "chrome" >/dev/null 2>&1; then
         "chrome" "http://127.0.0.1:5003"
         elif [ -d "/Applications/Google Chrome.app" ]; then
         open -a "Google Chrome" "http://127.0.0.1:5003"
         else
         open "http://127.0.0.1:5003"
         fi
         exit 0
      fi
      sleep 1
   done
   echo "[Warning] Server did not start in time. Please open http://127.0.0.1:5003 manually."
   ) &

   echo "MoneyTron is launching. The app should open in your browser."
   echo "If it does not, open http://127.0.0.1:5003 manually."
   exit 0
   ```

   Make it executable:
   ```bash
   chmod +x start.command
   ```

5. **Prepare a zip for family**
   - Ensure the folder contains: `MoneyTron` (executable), `client/`, `users/`, `start.command`.
   - Right-click the **MoneyTron** folder → **Compress**.
   - Send the resulting `.zip`.

---

## Build & package for Windows

> Use **Command Prompt (cmd)** for the build commands below.  
> (PowerShell uses different line continuations; see Troubleshooting.)

1. **Install build deps (cmd)**
   ```bat
   cd MoneyTron
   py -m venv .venv
   .\.venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Build the single-file app (cmd)**
   ```bat
         pyinstaller `
      --noconfirm --clean `
      --name MoneyTron `
      --onefile `
      --add-data "client;client" `
      --add-data "users;users" `
      --collect-all flask `
      --collect-all jinja2 `
      --collect-all werkzeug `
      --collect-all click `
      --collect-all itsdangerous `
      --collect-all markupsafe `
      --collect-all waitress `
      server\new_app.py
   ```

3. **Move the executable next to folders (cmd)**
   ```bat
   move dist\MoneyTron.exe .
   ```

4. **Create (or update) `Start_MoneyTron.bat`**  
   Save this file at `MoneyTron/Start_MoneyTron.bat`:

   ```bat
   @echo off
   cd /d "%~dp0"

   echo ============================================
   echo [Start] MoneyTron launcher
   echo [Info ] Working dir: %cd%
   echo ============================================

   REM Kill anything still running on port 5003
   echo [Step ] Checking for existing process on port 5003...
   for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5003') do (
   echo [Kill ] Terminating PID %%a ...
   taskkill /F /PID %%a >nul 2>&1
   )

   REM Start MoneyTron
   echo [Step ] Launching MoneyTron.exe ...
   start "" /b MoneyTron.exe

   REM Wait up to 40 seconds for server to be ready
   setlocal enabledelayedexpansion
   set COUNT=0
   :loop
   echo [Wait ] Attempt !COUNT!/40 ... probing http://127.0.0.1:5003
   powershell -command "try {Invoke-WebRequest -Uri http://127.0.0.1:5003 -UseBasicParsing | Out-Null; exit 0} catch {exit 1}"
   if !errorlevel! equ 0 (
      echo [OK   ] Server is responding on port 5003.
      echo [Step ] Opening browser...
      start "" http://127.0.0.1:5003
      echo [Done ] MoneyTron launched successfully.
      pause
      exit /b 0
   )
   set /a COUNT+=1
   if !COUNT! geq 40 (
      echo [ERROR] Server did not start after 40s. Check moneytron.log
      pause
      exit /b 1
   )
   timeout /t 1 /nobreak >nul
   goto loop
   ```

5. **Prepare a zip for family**
   - Ensure the folder contains: `MoneyTron.exe`, `client\`, `users\`, `Start_MoneyTron.bat`.
   - Right-click the **MoneyTron** folder → **Send to → Compressed (zipped) folder**.
   - Send the `.zip`.

---

## For family users (how to run it)

### macOS (once or twice a month)

1. **Unzip** the folder you received (e.g., to Desktop).  
2. **Double-click `start.command`**.  
   - If macOS warns that it’s from the internet, right-click → **Open** → **Open**.  
   - If still blocked, see Troubleshooting.
3. The app opens in Chrome (or your default browser) at **http://127.0.0.1:5003/**.
4. Use the app:
   - **Transactions** → upload your monthly files, review & categorize → **Save**.
   - **Summary** → view your month, categories, insights.

### Windows (once or twice a month)

1. **Unzip** the folder you received (e.g., to Desktop).  
2. **Double-click `Start_MoneyTron.bat`**.  
   - If SmartScreen appears, click **More info → Run anyway**.
3. Your browser opens at **http://127.0.0.1:5003/**.
4. Use **Transactions** to upload & categorize → **Save** → check **Summary**.

> **Your data lives in the `users/` folder.** Back it up occasionally (copy that folder).

---


## Updating the app (what-to-do-on-update)

There are two common types of updates:

### 1) UI change only (`client/index.html`)
- **Developer:** rebuild the app and send a **new zip**  
   (Because the packaged executable embeds the `client/` folder.)
   - macOS: run the PyInstaller command again, update `MoneyTron` + `start.command`, zip and send.
   - Windows: run the PyInstaller command again, update `MoneyTron.exe` + `Start_MoneyTron.bat`, zip and send.
- **Family:** delete the old folder, unzip the new one. **Keep your old `users/` folder!**  
   If needed, copy your old `users/` into the new folder (replace the empty one).

### 2) Backend change (`server/new_app.py`)
- Same process as above: **rebuild and send a new zip** for macOS/Windows.

> **Fast patch (developers only, dev mode):** you can test changes by running `python server/new_app.py` locally without packaging. For family distribution, always rebuild.

---

## Expense vs Income: How MoneyTron Handles Transaction Types

MoneyTron distinguishes between **Expense** and **Income** transactions throughout the app. This distinction is important for accurate summaries, charts, and category breakdowns.

- **Expense:** Money going out (e.g., purchases, bills). These are shown as positive numbers in the "Debit" column and are included in spending totals.
- **Income:** Money coming in (e.g., salary, refunds). These are shown as positive numbers in the "Debit" column but are marked as type "Income" and are included in income totals.

**How the app treats Expense vs Income in each tab:**

- **Transactions Tab:**
   - Each row has a "Type" toggle (Expense/Income). By default, uploaded transactions are auto-detected (based on sign and context), but you can manually switch the type.
   - Expenses are added to spending totals; incomes are added to income totals.
   - The "Total Amount" and "Categorized" KPIs reflect both types, but net calculations subtract income from expenses.

- **Data Tab:**
   - You can filter and view both Expense and Income transactions.
   - The "Total Spending" KPI only sums Expenses (not Income).
   - You can toggle the type for any transaction if needed.

- **Summary Tab:**
   - Charts and tables show both Income and Expense per month.
   - The "Net (Income − Outcome)" row shows the difference between total income and total expenses for each month.
   - Category and subcategory breakdowns only include Expenses (Income is not categorized).

- **Categories Tab:**
   - Categories and subcategories are used for Expenses. Income transactions can be left uncategorized or given a category if desired, but are not included in category breakdowns.

- **Settings Tab:**
   - You can see your average monthly spending (Expenses only) and last transaction (of any type).

**Note:** When uploading files, the app tries to detect the type (Expense/Income) based on the sign of the amount and the column context. You can always adjust the type manually in the Transactions or Data tabs.

---


## Multi-Currency Support: Toggle Between 4 Currencies

MoneyTron lets you work with up to **four different currencies** (ILS, USD, EUR, GBP) for your transactions. You can choose which currencies are available for toggling, and easily switch the currency for any transaction in the Transactions and Data tabs.

**How to enable and use multiple currencies:**

1. **Go to the Settings Tab:**
   - In the app, open the **Settings** tab (⚙️).
   - Under **Preferences**, you'll see "Allowed Currencies for Toggling".

2. **Select Your Currencies:**
   - Click the currency buttons (ILS, USD, EUR, GBP) to enable or disable them. Enabled currencies are highlighted.
   - You can select any combination of the four currencies.
   - Click **Save Preferences** to apply your changes.

3. **Toggle Currency in Transactions/Data:**
   - In the **Transactions** or **Data** tab, each transaction row has a currency button (₪, $, €, £) next to the amount.
   - Click this button to cycle through your enabled currencies for that transaction.
   - The selected currency is saved per transaction.

**Notes:**
- The default currency is ILS, but you can change it in Settings.
- Only the currencies you enable in Settings will be available for toggling in transaction rows.
- Currency toggling does not convert amounts automatically; it is for tracking and labeling only.

This feature is useful for users who have accounts or transactions in multiple currencies, such as ILS and USD, or for tracking foreign purchases.

---

## Auto-Categorization: How MoneyTron Suggests Categories & Subcategories

MoneyTron includes a smart auto-categorization system to make organizing your transactions easier and faster. When you upload new transactions, the app tries to automatically assign the most likely **Category**, **Sub-category**, and **Type** (Expense/Income) for each row, based on your past data and category definitions.

**How it works:**

1. **Vendor/Name Matching:**
    - The app normalizes the transaction name (removing noise, company suffixes, etc.) and looks for exact or similar names in your past transactions.
    - If a match is found, it checks if the amount is similar to previous transactions for that vendor.

2. **Majority Logic:**
    - If a vendor has a clear majority of past transactions in a certain category/subcategory/type, the app will suggest those values for new transactions from the same vendor.
    - If the amount is close to a previous transaction, the confidence is higher.

3. **Fuzzy Matching:**
    - If no exact match is found, the app uses token-based similarity to find near matches (e.g., similar store names).
    - If a likely match is found, it suggests the most common category/subcategory/type for that vendor.

4. **Validation:**
    - The app checks that suggested subcategories exist in your current categories.json.
    - Only confident suggestions (above a threshold) are auto-filled; others are left blank for you to choose.

**Where you see auto-categorization:**

- **Transactions Tab:**
   - When you upload a file, most transactions will be auto-filled with category, subcategory, and type if a confident match is found.
   - You can always review and change these suggestions before saving.

- **Data Tab:**
   - Past transactions are used to improve future auto-categorization. Editing and saving your data helps the system learn.

- **Categories Tab:**
   - Keeping your categories and subcategories organized helps the auto-categorization logic work better.

**Tip:** The more you use MoneyTron and categorize your transactions, the smarter the auto-categorization becomes, making future uploads faster and more comfortable.

---

## Troubleshooting

**A) Nothing opens / only background color**  
- Make sure `client/` was included in the build:
  - macOS: `--add-data "client:client"`
  - Windows: `--add-data "client;client"`
- Ensure the executable (`MoneyTron` or `MoneyTron.exe`) sits **next to** `client/` and `users/`.
- Open the browser console (F12) and check for 404s; if `index.html` can’t be found, rebuild.

**B) “Port 5003 already in use”**  
- The start scripts try to kill existing processes, but you can also do it manually:
  - macOS:
    ```bash
    lsof -ti:5003 | xargs kill -9
    ```
  - Windows (cmd):
    ```bat
    for /f "tokens=5" %a in ('netstat -ano ^| findstr :5003') do taskkill /PID %a /F
    ```

**C) macOS says the file is from an unidentified developer**  
- Right-click `start.command` → **Open** → **Open**.  
- Or remove quarantine:
  ```bash
  xattr -dr com.apple.quarantine .
  ```

**D) PowerShell errors like “Missing expression after unary operator --”**  
- You’re running the **Windows build command in PowerShell** with caret `^` line breaks.  
- Use **Command Prompt (cmd)**, or put it on **one line** in PowerShell:
  ```powershell
  pyinstaller --name MoneyTron --onefile --add-data "client;client" server/new_app.py
  ```

**E) 404 on “/”**  
- Run from the **project root**.
- Verify `server/new_app.py` serves the UI and that `client/index.html` exists.

---

## Data & privacy

- All your data stays local in `users/<Name>/`.
- To back up, copy the entire `users/` folder.
- To move computers, copy `users/` into the new MoneyTron folder.

**Files:**
- `categories.json` — your categories & preferences
- `current_month_transactions.json` — the month you are currently editing
- `past_data.json` — archive of saved months

---


## Build scripts (copy-paste)

### `start.command` (macOS)

```bash
#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

chmod +x MoneyTron || true

if lsof -ti:5003 >/dev/null 2>&1; then
  lsof -ti:5003 | xargs kill -9 || true
fi

( sleep 2; open -a "Google Chrome" "http://127.0.0.1:5003/" || open "http://127.0.0.1:5003/" ) &

./MoneyTron
```

Make executable:
```bash
chmod +x start.command
```

### `Start_MoneyTron.bat` (Windows)

```bat
@echo off
setlocal
cd /d "%~dp0"

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5003') do taskkill /PID %%a /F >nul 2>&1

start "" cmd /c "timeout /t 2 >nul & start "" http://127.0.0.1:5003/"

MoneyTron.exe
```

---

## Build commands (copy-paste)

### macOS

```bash
cd MoneyTron
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip pyinstaller flask waitress

pyinstaller   --name MoneyTron   --onefile   --add-data "client:client"   server/new_app.py

mv dist/MoneyTron .
chmod +x start.command
```

### Windows (cmd)

```bat
cd MoneyTron
py -m venv .venv
.\.venv\Scriptsctivate
pip install -U pip pyinstaller flask waitress

pyinstaller ^
  --name MoneyTron ^
  --onefile ^
  --add-data "client;client" ^
  server
ew_app.py

move /Y dist\MoneyTron.exe .
```
