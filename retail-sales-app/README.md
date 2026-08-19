# Retail Sales Analysis App

A local, single-user web app for analyzing monthly retail sales data across two
independent datasets — **Company Owned Stores** and **Franchise Stores**. React
(Vite) frontend, Node/Express + SQLite backend. All data is stored locally in a
SQLite file; nothing leaves your machine.

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
This starts the API on http://localhost:4000 and creates `server/data/retail-sales.db` on first run (auto-created, gitignored).

**Terminal 2 — frontend:**
```bash
cd retail-sales-app/client
npm install
npm run dev
```
Open http://localhost:5173 — the Vite dev server proxies `/api/*` requests to the backend, so no extra config is needed.

## Stage 1: Import Data (file upload + column mapping)

This is the first stage built. What to test:

1. Go to the **Import Data** tab. Use the **Company Owned Stores / Franchise Stores** toggle at the top to confirm you're importing into the dataset you intend — each is a fully separate set of stores and data.
2. Click **Choose File** and upload your monthly Excel file (`.xlsx`/`.xls`/`.csv`).
3. You'll see a **Map your columns** step: every column detected in your sheet, a sample value, and a dropdown to map it to an app field (Store Name, Year, Month, Sales Amount, Target Amount, or a Driver Metric like Footfall/Transactions — name the driver whatever you like). A single "Date" column is also supported instead of separate Year/Month columns.
4. Click **Import data**. You'll get an **Import complete** summary: rows added, rows updated, rows that failed and why (e.g. a blank store name), and how many new stores were auto-created from names in the sheet that didn't match an existing store.
5. **Re-upload the same file (or same month) again** — rows for the same store+year+month are **updated in place**, not duplicated. Try it and confirm "Rows updated" reflects this instead of "Rows added".
6. On your next upload, if the column headers are unchanged, the app reuses your saved mapping automatically (look for the "Using remembered mapping" badge). If you change your sheet's layout, you'll be asked to map again.
7. Check **Recent imports** at the bottom for a running log of every upload for the current dataset.

Known limitation for now: a known security advisory exists in the `xlsx` (SheetJS) npm package with no upstream npm fix (SheetJS publishes patched builds only via their own CDN, which isn't reachable from this environment). Since this app only ever parses files you upload yourself on your own machine, the risk is low, but if you want the patched build, you can manually replace `server/node_modules/xlsx` with a build from https://cdn.sheetjs.com later.

Stages 2–5 (dashboard & filters, trend & YoY comparisons, performance flags & remarks, widget/store customization) are in progress — see the top-level task list.
