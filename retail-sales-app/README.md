# Retail Sales Analysis App

A local, single-user web app for analyzing monthly retail sales data across two
independent datasets — **Company Owned Stores** and **Franchise Stores**. React
(Vite) frontend, Node/Express + SQLite backend. All data is stored locally in a
SQLite file; nothing leaves your machine, and there's no login/auth by design.

**Requires Node.js 22.5 or newer** (uses Node's built-in `node:sqlite` — no
native compiler/build tools needed to install, unlike most SQLite packages).
Check with `node --version`; get the latest from [nodejs.org](https://nodejs.org)
if you're below that.

## Project layout

```
retail-sales-app/
  server/   Express API + SQLite database (port 4000)
  client/   React (Vite) frontend (port 5173)
```

## Running locally

Open two terminals.

**Terminal 1 — backend:**
```bash
cd retail-sales-app/server
npm install
npm run dev
```
Starts the API on http://localhost:4000 and creates `server/data/retail-sales.db` on first run (auto-created, gitignored — this file **is your data**, back it up if you care about it).

**Terminal 2 — frontend:**
```bash
cd retail-sales-app/client
npm install
npm run dev
```
Open http://localhost:5173 — the Vite dev server proxies `/api/*` to the backend, so no extra config is needed.

## Feature tour / what to test

**Company Owned Stores / Franchise Stores toggle** (top right, every page): switches the entire app to a fully separate dataset — its own stores, sales, mappings, remarks, and settings. Nothing you do in one leaks into the other; confirm by adding data to one side and checking the other stays empty.

### Import Data
1. Click **Choose File** and upload a monthly Excel/CSV file.
2. **Map your columns**: every detected column, a sample value, and a dropdown to map it to Store Name, Year, Month (or a single Date column instead), Sales Amount, Target Amount, or a Driver Metric (name it anything — footfall, transactions, basket size, ...).
3. **Import data** → an **Import complete** summary: rows added, rows updated, rows that failed and why, and how many stores were auto-created from names in the sheet.
4. **Re-upload the same month** — rows are updated in place (matched on store + year + month), never duplicated.
5. Next time you upload with the same column headers, your mapping is remembered automatically ("Using remembered mapping" badge); a changed layout prompts you to re-map.
6. **Recent imports** at the bottom is a running log per dataset. If you uploaded the wrong file, click **Delete** next to it — this removes the rows it added, unless a later upload already corrected them (those stay, since they belong to the newer import now).

### Dashboard
Totals, Sales by Store, and Sales by Month, filterable by Store / Year / Month. Filters carry over as you move between Dashboard, Sales Trend, and the comparison pages.

### Sales Trend
Monthly sales over time. Pick a store to see just its line, or leave "All stores" to compare every store at once. Hover the chart for exact values.

### YoY Comparison / Drivers Comparison
Pick a base year and a compare year (defaults to the two most recent years you have data for) to see a month-by-month bar chart and a % change table — one for total sales, one for any driver metric you've mapped (footfall, transactions, etc.).

### Performance & Remarks (bottom of Dashboard)
- Choose the rule: **top/bottom % by growth** vs. a prior year, or **vs. target** (needs a Target Amount column mapped during import). Adjust the threshold %.
- Each store gets a High performer / Low performer / On track flag.
- Type a free-text remark per store for a chosen month — it autosaves on blur and persists across reloads.

### Settings
Checkboxes to show/hide each dashboard card and each of the Sales Trend / YoY Comparison / Drivers Comparison tabs, per dataset — turn off what you don't need this month.

### Stores
Add a store (name + optional code), deactivate a closed store (keeps its sales history, just stops it showing in filters/new imports as active), reactivate, or remove entirely (only allowed if it has no sales history — otherwise it's deactivated instead, so historical data is never silently lost).

## Known limitation

A security advisory exists against the `xlsx` (SheetJS) npm package with no upstream npm fix — SheetJS only publishes patched builds via their own CDN (`cdn.sheetjs.com`), which wasn't reachable from the environment this app was built in. Since this app only ever parses files you upload yourself on your own machine, the risk is low, but if you want the patched build: `npm install https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz` inside `server/`.

## Troubleshooting

**`npm install` fails with `gyp ERR! find Python` or asks for a C++ compiler**: you're on an old copy of this app that used `better-sqlite3`, which needs a native build toolchain on Windows. Pull the latest version — it now uses Node's built-in SQLite support and needs nothing beyond Node.js itself.

## Non-goals (by design, v1)

- No multi-user login/auth — single user, local use only.
- No cloud sync — the SQLite file on your machine is the only copy. Back it up (`server/data/retail-sales.db`) if that matters to you.
