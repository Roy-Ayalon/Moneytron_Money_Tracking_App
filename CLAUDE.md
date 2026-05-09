# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tech Stack

- **Backend:** Python 3.11, Flask 2.3, Waitress (local) / Gunicorn (Docker)
- **Frontend:** React 18 SPA — Vite 5 build, `@vitejs/plugin-react`, Chart.js 4.4.1 (pinned), Day.js
- **Storage:** JSON files per user in `users/<username>/` — no database
- **File parsing:** openpyxl (XLSX), xlrd (XLS), csv (CSV), BeautifulSoup4

## Running Locally

```bash
# Backend (terminal 1)
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python3 server/new_app.py          # serves at http://127.0.0.1:5003/

# Frontend dev server (terminal 2) — HMR, proxies /api to :5003
cd client && npm install && npm run dev   # http://localhost:5173
```

## Building for Production

```bash
cd client && npm run build   # outputs to client/dist/
# Flask then serves client/dist/ automatically (via MONEYTRON_CLIENT_DIR)
```

## Running Tests

```bash
python -m unittest discover tests/
# or a single file:
python -m unittest tests/test_amount_parsing.py
```

## Architecture

### Backend modules (`server/`)

| File | Responsibility |
|------|----------------|
| `app.py` | All Flask routes (auth, data, upload, analytics) — PROTECTED |
| `new_app.py` | Entry point — delegates to `app.py`. Patches `CLIENT_DIR` via `MONEYTRON_CLIENT_DIR` env var. Runs with `use_reloader=True` |
| `auth.py` | Password hashing (bcrypt), CSRF token lifecycle, session cookies |
| `storage.py` | `_sanitize_user`, `_user_dir`, `_paths`, `_read_json`, `_atomic_write`, `_glock` |
| `ingestion.py` | CSV/XLSX/XLS parsing; detects Hebrew bank formats (Leumi, Hapoalim, Max, Cal) — PROTECTED |
| `categorization.py` | Auto-categorizes via vendor normalization, fuzzy matching, majority voting |
| `analytics.py` | Monthly aggregations and statistics (means, medians, rollups) |
| `analytics_legacy.py` | Migration artifact — 4 deprecated stat functions re-exported by `analytics.py`; candidate for removal |
| `email_util.py` | Sends feedback emails via SMTP; reads `SMTP_*` env vars |
| `utils.py` | Date parsing (Excel serial + flexible formats), amount parsing, Hebrew normalization |
| `validation.py` | Transaction save constraints |

### Frontend (`client/src/`)

Vite 5 + React 18 component architecture. Entry: `client/src/main.jsx`.

```
client/
├── public/favicon.png
├── src/
│   ├── index.html          # Vite entry HTML
│   ├── main.jsx            # ReactDOM.createRoot + dayjs.extend
│   ├── api.js              # API singleton (CSRF-aware fetch, all methods)
│   ├── utils.js            # fmt2, I18N, getCookie, makeTranslator, formatDMY,
│   │                       #   parseDMYtoISO, parseAmount, asArray, asCategories
│   ├── styles/main.css     # All app CSS
│   └── components/
│       ├── App.jsx         # Root — global state, tab routing
│       ├── FeedbackButton.jsx
│       ├── TitleBar.jsx
│       ├── LoginView.jsx
│       ├── CategoryCard.jsx
│       ├── CategoriesTab.jsx
│       ├── TransactionsTab.jsx   ★ HIGH TOKEN COST — keep focused
│       ├── DataTab.jsx           ★ HIGH TOKEN COST — keep focused
│       ├── SummaryTab.jsx
│       ├── StatisticsTab.jsx
│       ├── StatsPieChart.jsx
│       ├── SettingsTab.jsx
│       ├── ChangePasswordForm.jsx
│       └── TutorialTab.jsx
├── package.json
└── vite.config.js
```

### User data layout

```
users/<username>/
  settings.json                  # user prefs + hashed password
  categories.json
  current_month_transactions.json
  past_data.json
```

Writes use an atomic temp-file-then-rename pattern. User paths are sanitized via `_sanitize_user()` in `storage.py`.

### Transaction object fields

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Dedup key on commit — sha of date+name+amount |
| `tag` | string | Month label, e.g. `"2025-03"` |
| `date` | string | Display date (DD-MM-YYYY) |
| `date_iso` | string | ISO date `YYYY-MM-DD` — used for sorting/filtering |
| `date_str` | string | Raw date string from source file |
| `year` | int | Calendar year |
| `month_tag` | int | Month number 1–12 |
| `name` | string | Vendor / description |
| `amount` | float | Always ≥ 0; debit flag separates expense from income |
| `debit` | bool | `true` = expense, `false` = income |
| `currency` | string | e.g. `"ILS"`, `"USD"` |
| `type` | string | `"expense"` or `"income"` |
| `category` | string | Category name |
| `subcategory` | string | **Must be non-empty** — required for all analytics |
| `notes` | string | Free-text user note |
| `vi` | bool | `true` = flagged/excluded from all totals and charts |
| `manual` | bool | `true` = manually entered (not uploaded from file) |

## Key API patterns

- Auth: `POST /api/login` / `POST /api/signup` / `POST /api/logout` — sets `mt_user` cookie
- All data endpoints require a valid session cookie
- `POST /api/upload` — file upload (CSV/XLSX); returns parsed transactions
- `GET /api/summary`, `POST /api/statistics` — analytics endpoints
- CORS headers are enabled globally

## Environment variables

| Variable | Purpose |
|----------|---------|
| `MONEYTRON_DATA_DIR` | Override user data directory (default: `users/`) |
| `MONEYTRON_CLIENT_DIR` | Override Flask's CLIENT_DIR — set to `client/dist/` in Docker |
| `PORT` | HTTP port (default 8080 in Docker) |
| `SMTP_HOST/PORT/USER/PASS` | Optional email for feedback feature |

## Deployment

Docker image: multi-stage Node 20-alpine (Vite build) → python:3.11-slim (runtime). Gunicorn serves the app via `new_app:app`.

### GCP project
- Project ID: `moneytron-488817` (personal Google account — unrelated to MedFlow/medflowlabs-dev)
- Service URL: `https://moneytron-wkanob3jka-ew.a.run.app/`
- User data bucket: `moneytron-data-moneytron-488817` (GCS, mounted at `/app/users`) — **never touch this**
- The deploy script outputs a numeric-format URL at the end — ignore it, the real URL above is correct

### Redeploy after code changes
```bash
gcloud config set project moneytron-488817
MONEYTRON_PROJECT_ID=moneytron-488817 bash deploy.sh -SkipSetup
```
- `gcloud config set project` is required — the script reads the active project via `gcloud config get-value project`, not just the env var
- The `bad substitution` warning at the end is harmless (macOS bash 3 + monitoring script) — deploy succeeds regardless

### First-time setup
```bash
gcloud config set project moneytron-488817
MONEYTRON_PROJECT_ID=moneytron-488817 bash deploy.sh
```

### Branch → deploy workflow
1. Work and commit on `beta-launch`
2. Fast-forward merge to `main`: `git checkout main && git merge beta-launch --ff-only && git push origin main`
3. Switch back: `git checkout beta-launch` — branches stay aligned after a FF merge
4. Deploy (Cloud Build reads from local working tree, not GitHub — branch name doesn't matter to the build)

### User impact on deploy
- **Data:** safe — GCS bucket is mounted at `/app/users` and is untouched by container redeployments
- **Sessions:** lost — Flask sessions are in-memory; active users must re-login once after a new revision goes live (unavoidable with current architecture)

---

## Protected Files
Do not modify these files without explicit approval:
- `server/app.py` — core auth logic and all routes
- `server/ingestion.py` — Hebrew bank format parsing (Leumi, Hapoalim, Max, Cal)
- `users/` — user data directory, never read or write directly

## Coding Rules
- Frontend uses Vite + React 18. JSX is compiled by `@vitejs/plugin-react` — `<>` shorthand works fine.
- `<React.Fragment>` is fine too but not required — both work in Vite.
- chart.js is pinned to `4.4.1` and chartjs-plugin-datalabels to `2.2.0` in `package.json`. Do NOT upgrade without testing all charts.
- `Chart.register(ChartDataLabels)` at module level is idempotent in Chart.js 4.x — no guard needed.
- All file writes must use the atomic temp-file-then-rename pattern already in place.
- Hebrew text normalization must go through `utils.py`, never inline.
- `window.settings` is set by `App.jsx` after login and read by `TransactionsTab` and `DataTab` for `allowedCurrencies`.
- `window.__mtCsrfToken` is set by `App.jsx` and read by `api.js` for CSRF.

## Workflow Rules
- Re-read this CLAUDE.md at the start of every task.
- Read relevant files and tests before making any edits.
- Always propose a plan first. Do not edit until approved.
- Default to minimum scope. Do not fix related issues unless explicitly asked. Report them separately instead.
- After completing a task, suggest what should be added to this CLAUDE.md.

## After Code Changes
- **Frontend changes:** Vite HMR auto-refreshes the browser at `http://localhost:5173`. No manual refresh needed.
- **Backend changes:** `use_reloader=True` restarts Flask automatically at `:5003`.
- The browser hook only triggers on `server/` file edits (opens `:5003`). For Vite dev, rely on HMR instead.
- Run unit tests if relevant: `python -m unittest discover tests/`
- Do NOT restart the server after editing .md files or non-app files.

## Known Pitfalls
- Vite builds JS/CSS to `/assets/...` (absolute paths). Flask must have the `/assets/<filename>` route in `app.py` or the SPA loads a blank page. Already in place — do not remove it.
- `users/` is gitignored but files inside it may still be tracked if they were committed before the rule was added. Always run `git ls-files users/` before any git operation involving user data; untrack with `git rm --cached` if needed.
- Sorting logic is fully duplicated between TransactionsTab and DataTab. Any sort fix must be applied in both files.
- `vi=true` maps to value `0` in the sort comparator (sorts first ascending). Fixed 2025-04.
- Server entry point is `server/new_app.py`, not `app.py`. Routes live in `app.py` but the process is `new_app.py`. Run `ps aux | grep python` to confirm.
- `CLIENT_DIR` in `app.py` is patched by `new_app.py` via `MONEYTRON_CLIENT_DIR` env var. In Docker, it points to `client/dist/`.
- `dayjs` must be imported directly in each component that uses it — it is not a global.
- `getCookie` must be imported from `utils.js` in components that call raw `fetch()` with CSRF (FeedbackButton, TransactionsTab).

## What Not To Do
- Do not commit anything inside `users/` — all live user data is in the GCS bucket and must never be tracked in git.
- Do not touch the GCS bucket (`moneytron-data-moneytron-488817`) during deployments — it holds all live user data and Cloud Run mounts it automatically.
- Do not change the active gcloud project away from `moneytron-488817` when working on this repo — `medflowlabs-dev` is a completely separate MedFlow project on a different account.
- Do not fix related issues that were not explicitly requested. Report them separately.
- Do not add CDN script tags — all JS is bundled by Vite.
- Do not use `window.Chart` or `window.ChartDataLabels` — import from `chart.js/auto` and `chartjs-plugin-datalabels`.
- Do not read or write to the users/ directory directly.
- Do not reason about toggle/initial-state before verifying the comparator value first.
- Do not plan broad tab-wide refactors when user reports a single element behaving unexpectedly. Start narrow.
- Do not start coding before checking which server file is running (`ps aux | grep python`).
- Do not implement shared state changes without tracing the full data flow first.
- Do not restart the server after every message — only when the user needs to verify a change in the browser.
- Do not use `if False:` as a recovery from a failed Edit — re-read the file and redo the edit correctly.
- Do not make multiple small sequential edits when a single larger replacement covers the same region.

## Lessons Learned
- All mistakes so far came from starting to code before finishing the read. Always answer first:
  1. Where does this data actually live at runtime?
  2. What is the exact runtime environment (server entry point, JS engine version)?
- For a wrong sort order bug: check the v() comparator value first, toggle logic second.
- Describe expected behavior in terms of rows ("flagged items at top"), not direction labels ("ascending") — row descriptions are directly testable in code.
- Before any module extraction, read all test setUp/tearDown methods first — they often monkey-patch module-level globals; the patch must follow the global to its new module.
- Before calling Edit on files with non-ASCII/Unicode characters (em-dashes, Hebrew, etc.), run `grep -n "target_string"` to confirm the exact byte representation is what you expect.
- When a refactor touches a large contiguous region of a file, plan all edits upfront and make as few Edit calls as possible — multiple small sequential edits on the same region compound errors.
- For a blank page at localhost:5173, ask for a DevTools console screenshot immediately — do not guess. The console shows the exact error in seconds (e.g. `/api.js 404` from an overly broad Vite proxy rule).
- Before editing a CSS property, grep for ALL rules targeting the same selector in the file. A later rule (e.g. `/* Polish Overrides */`) will silently win — change the last one, not the first.
- The Vite proxy key `'/api'` matches any path starting with those 4 characters, including `/api.js`. Always use `'^/api/'` (regex with trailing slash) to limit proxy scope to actual API routes.
- A blank white page on Cloud Run means static assets are 404ing — open DevTools → Network tab immediately to see which file is missing, then check the Flask route list in `app.py`. Do not redeploy blindly.

---

## Frontend Component Map (`client/src/components/`)

| Component | File | Purpose |
|-----------|------|---------|
| `App` | `App.jsx` | Root — global state, tab routing, modals |
| `FeedbackButton` | `FeedbackButton.jsx` | Floating feedback modal |
| `TitleBar` | `TitleBar.jsx` | Top nav (currently inline in App) |
| `LoginView` | `LoginView.jsx` | Login / signup gate |
| `CategoryCard` | `CategoryCard.jsx` | Single category + subcategory row |
| `CategoriesTab` | `CategoriesTab.jsx` | Category management, search, KPIs |
| `TransactionsTab` | `TransactionsTab.jsx` | Current-month staging area, upload, manual add |
| `DataTab` | `DataTab.jsx` | Historical data editor with 3-level filter |
| `SummaryTab` | `SummaryTab.jsx` | Monthly bar/pie charts, drill-down |
| `StatisticsTab` | `StatisticsTab.jsx` | Advanced filter dashboard |
| `StatsPieChart` | `StatsPieChart.jsx` | Chart.js pie chart sub-component |
| `SettingsTab` | `SettingsTab.jsx` | Preferences, export, account |
| `ChangePasswordForm` | `ChangePasswordForm.jsx` | Modal password change |
| `TutorialTab` | `TutorialTab.jsx` | In-app help, lightbox, videos |

**Shared utilities (`client/src/utils.js`):**
- `fmt2(n)` — format number to 2 decimal places
- `I18N` — Hebrew/English translation object
- `getCookie(name)` — read browser cookie
- `makeTranslator(lang)` — returns `t(key)` function
- `formatDMY(date)` — ISO → DD-MM-YYYY display
- `parseDMYtoISO(dmy)` — DD-MM-YYYY → YYYY-MM-DD storage
- `parseAmount(v)` — parses "1,234.56", "(1,234)", "₪1,234" → float
- `asArray(v)` / `asCategories(v)` — safe coerce from API responses

**API singleton (`client/src/api.js`):**
- `export const API` — all HTTP helpers (uses `window.__mtCsrfToken` for CSRF)

**Global state (managed by `App.jsx`):**
`user`, `tab`, `categories`, `past`, `stage`, `settings`, `dataFilter`, `lang`

**Global bridges (preserved for cross-component access):**
- `window.settings` — set by App, read by TransactionsTab/DataTab for `allowedCurrencies`
- `window.__mtCsrfToken` — set by App after login, read by api.js
- `window._loginSetErr` / `window._signupSetMsg` — set by LoginView, called by App

**Sorting is duplicated** — any sort fix must be applied in both:
- `TransactionsTab.jsx` — `v(r,k)` comparator function
- `DataTab.jsx` — identical `v(r,k)` comparator function

---

## Backend Module Function Reference

### `server/app.py` — Routes + auth + file I/O (PROTECTED)

**Key internal helpers:**
- `_sanitize_user(u)` — prevents path traversal
- `_require_user()` → username string, aborts 401 if no session
- `_user_dir(username)` → `Path` to user data directory
- `_paths(username)` → `{"settings": Path, "categories": Path, "stage": Path, "past": Path}`
- `_read_json(path, default)` — safe JSON read with fallback
- `_atomic_write(path, data)` — temp-file + rename pattern
- `_ensure_user_files(username)` — creates user directory + default files, returns `_paths()`
- `_check_password(username, password)` → `(ok: bool, needs_rehash: bool)`
- `_issue_csrf_token()` / `_validate_csrf()` — CSRF lifecycle
- `_rate_limited(path)` → `(is_limited: bool, retry_after: int)`
- `_build_uploaded_rows(extracted, tag, year, file_index)` → normalised transaction list

**Global state in `app.py`:**
- `USERS_DIR` — user data root (overridable via `MONEYTRON_DATA_DIR`)
- `CLIENT_DIR` — path to client build dir for static serving (overridable via `MONEYTRON_CLIENT_DIR` in `new_app.py`)
- `_rate_buckets` / `_rate_lock` — in-memory sliding-window rate limiter
- `_glock` — `RLock` for multi-file atomic ops (categories + transactions)

### `server/ingestion.py` — File parsing (PROTECTED)

Main entry: `extract_transactions(file_bytes, file_name)` → `{"rows": [...], "col_map": {...}}`

- `_read_xlsx(data)`, `_read_xls(data)`, `_read_csv(data)` — format parsers
- `_extract_from_sheet(matrix, ...)` — header detection + row extraction state machine
- `extract_transactions_with_mapping(file_bytes, file_name, mapping)` — re-parse with custom column map

### `server/categorization.py`

Main entry: `auto_categorize_rows(rows, past_data, categories)` → rows with category fields populated

- `build_past_index(past_data)` → `{vendor: [past_rows]}` for lookup
- `token_sim(a, b)` → 0–1 fuzzy similarity score
- `amount_close(a, b)` → True if amounts within 10%
- `_majority(counter)` → most common value in Counter

### `server/analytics.py`

- `compute_summary(past_data)` → `{category: {subcategory: {type: total}}}`
- `compute_statistics(past_data, payload)` → filtered aggregations
- `compute_statistics_summary(past_data, payload)` → min/max/mean/count
- `compute_category_last3_mean(past_data, payload)` → 3-month average
- `compute_income_means(past_data, payload)` → income breakdown
- `compute_rollup(past_data, payload)` → year × month aggregation

### `server/utils.py`

- `parse_date_flex(s)` → ISO date string or `None`
- `parse_amount(s)` / `numify(s)` → float
- `norm_heb_en_vendor(s)` → normalised lowercase vendor name
- `clean_html(s)` → strips HTML tags

### `server/validation.py`

- `validate_transactions(rows)` → `{"valid": bool, "errors": [str]}`

---

## Common Change Patterns

**Adding a new transaction field:**
1. `server/ingestion.py` — extract it from the raw file row
2. `_build_uploaded_rows()` in `server/app.py` — include it in the normalised row dict
3. `server/validation.py` — add constraint if required
4. `client/src/components/TransactionsTab.jsx` — render + edit it
5. `client/src/components/DataTab.jsx` — render + edit it (duplicated logic)
6. Run `python -m unittest discover tests/`

**Adding a new API endpoint:**
1. Write logic in appropriate module
2. Add route in `server/app.py` — REQUIRES APPROVAL
3. Add client call in `API` object in `client/src/api.js`
4. Call from relevant tab component

**Adding/renaming a category field:**
1. `client/src/components/CategoriesTab.jsx` — update the form
2. `server/app.py` `api_categories()` — REQUIRES APPROVAL
3. `server/categorization.py` `_validate_cat_sub()` — update if validation changes

**Fixing a sort order bug:**
1. Check comparator value first (`v()` function), not toggle logic
2. `TransactionsTab.jsx` and `DataTab.jsx` — both must be fixed
3. `vi=true` maps to value `0` (sorts first ascending) — confirmed fix 2025-04

**Extracting a module from app.py:**
1. `grep -rn "module_name" tests/` — find every test that patches the source module
2. Read all setUp/tearDown — identify every monkey-patched global
3. Plan full extraction: functions moving, imports, test patches
4. One Edit per contiguous region — not one per function
5. Run `python -m unittest discover tests/` immediately after
