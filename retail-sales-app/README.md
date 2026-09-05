# Store Ops Dashboard

A web app for analyzing monthly retail sales data across a company's
operational **Areas** (Central, North, South, and any more you add) and the
**Stores** within each one. React (Vite) frontend, Node/Express + SQLite
backend. All data is stored locally in a SQLite file; nothing leaves your
machine unless you explicitly share it (see "Sharing with other users"
below). The app is gated by per-user accounts — the first person to open it
creates the Super Admin account, then adds everyone else from the Users page.

## Organizational model

**Company → Area → Store → (Store Supervisor) → Sales.** Every store
belongs to exactly one Area. Areas are configurable master data (a Super
Admin can rename them or add more — VISAYAS, MINDANAO, ... — from the Areas
page any time, with no code change), not hard-coded, but the app ships
seeded with three: **CENTRAL, NORTH, SOUTH**. There is one shared sales
table for every Area — a store's Area is always looked up through
`stores.area_id`, never duplicated onto the sales data — so company-wide
reporting and per-Area reporting come from the same rows.

### Roles

- **Super Admin** — sees every Area and every Store, lands on the **Company
  Sales Dashboard**, and is the only role that can manage Users, Areas, and
  switch between Areas / "Company (all areas)" from the top bar.
- **Area Supervisor** — assigned to one Area; sees only that Area's stores,
  sales, dashboard, and reports. Lands on their Area's dashboard automatically.
- **Store Supervisor** — assigned to one Store; sees only that store's data.
  Lands on their store's (Area-scoped) dashboard, filtered to just that store.

A signed-in user can never widen their own scope through the API — every
route re-validates the requested Area/Store against the caller's role
server-side, not just in the UI.

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
Open http://localhost:5173 — the Vite dev server proxies `/api/*` to the backend, so no extra config is needed. The very first visit asks you to **create the Super Admin account** (name, email, password). From there, sign in with that account and add everyone else — Area Supervisors and Store Supervisors — from the **Users** page, assigning each one an Area or a Store. Each person changes their own password from Settings.

## Combined single-port mode (for sharing)

For day-to-day solo use, the two-terminal setup above is fine. For sharing with anyone else — same WiFi or hosted — it's simpler to build the client once and let the server serve everything from one port:

```bash
cd retail-sales-app/client
npm install
npm run build          # produces client/dist

cd ../server
npm install
npm start               # serves the app + API together on http://localhost:4000
```

Now there's just one process, one port, and one URL (`http://localhost:4000`) instead of two. Re-run `npm run build` in `client/` whenever you pull code changes; `npm start` in `server/` always picks up the latest build automatically.

## Sharing with other users on the same WiFi/office network

The server listens on your network, not just `localhost`, so anyone on the same WiFi can reach it directly — no extra software needed:

1. Run the combined single-port mode above (`npm start` in `server/`, after building the client).
2. Find your computer's local network address: open a terminal and run `ipconfig` (Windows) or `ifconfig`/`ip addr` (Mac/Linux) — look for the **IPv4 Address** on your active WiFi/Ethernet adapter, e.g. `192.168.1.42`.
3. On Windows, the first time you start the server you may get a **Windows Defender Firewall** popup asking to allow Node.js — click **Allow access** (at least for Private networks).
4. Share `http://<that-IP>:4000` with people on the same WiFi — they open it in their own browser and sign in with the shared password.

This only works while you're on the same network and your computer + the server process stay running.

## Sharing with other users over the internet

Your computer isn't a public web server by default, so the URLs above only work on your own network unless you expose it further. Two ways to do that:

**Option A — a tunnel** (quick, temporary, needs your computer on and running): [Cloudflare Quick Tunnel](https://developers.cloudflare.com/pages/how-to/preview-with-cloudflare-tunnel/) or `npx localtunnel` point a public URL at the combined server above (`cloudflared tunnel --url http://localhost:4000` or `npx localtunnel --port 4000`). **Heads up:** on a locked-down work computer, both may be blocked outright by security software or network policy (a real user hit "Access is denied" running the `cloudflared.exe`, then `npx localtunnel` hung indefinitely trying to connect) — that's the machine's security policy working as intended, not a bug in this app, and isn't something to try to bypass. If that happens, use the same-WiFi option above, or Option B below.

**Option B — real hosting** (always-on, independent of your computer): deploy this app (the combined single-port mode) to a host like Render, Railway, or Fly.io.
- The server reads `PORT` from the environment automatically (hosting providers set this for you) and `DATA_DIR` to control where the SQLite file is written — point `DATA_DIR` at your host's persistent disk/volume path if it has one.
- **Free tiers on most hosts do not persist disk storage** — the SQLite file (and everything imported) can be wiped on every redeploy, and often on every restart after a period of inactivity. If you go this route on a free tier, treat any data you import as temporary/at-risk, and consider periodically exporting anything important. A paid tier with a persistent disk (commonly ~$5–7/month on Render) is what actually keeps data safe long-term.
- Build command: `cd client && npm install && npm run build && cd ../server && npm install`. Start command: `cd server && npm start`.

Anyone opening the link (tunnel or hosted) signs in with their own account. Every sales/import/user-management action is attributed to a signed-in user (`entered_by` on sales rows, sessions per user), so — unlike a shared password — there is a basic per-user audit trail; still worth keeping in mind for anything sensitive.

## Feature tour / what to test

**Area switcher** (top right, every page): "Company" (Super Admin only) plus one button per Area. Selecting an Area filters the *entire* app — dashboard, stores, imports, trends, comparisons — to that Area; Area and Store Supervisors don't get a switcher at all, since they're locked to their own assignment. The filter hierarchy is consistent everywhere: **Year → Month → Area → Store**.

### Company Sales Dashboard (Super Admin, "Company" selected)
Total Company Sales, Total MTD Sales, Total Target, % Achievement, % vs LY, Projected EOM, and Projected % Achievement, plus an Area Performance comparison table (Central/North/South + TOTAL) and a few auto-generated **Management Insights** sentences built from the underlying numbers (not hard-coded).

### Area Dashboard (an Area selected, or an Area/Store Supervisor's landing page)
The same KPI header and insights, scoped to one Area, plus the original Totals / Sales by Store / Sales by Month cards, Sales Trend, YoY Comparison, and Performance & Remarks — all now scoped to that Area's stores only.

### Area Performance page
Compares Central/North/South side by side (MTD Sales, LY, Target, % vs LY, % vs Target, Projected EOM, Projected Achievement %); click any column header to sort Highest → Lowest, click again for Lowest → Highest.

### Top & Bottom Performers page
Pick a **Scope** (Company or one Area), a **Ranking** (Top 5/10, Bottom 5/10), and a **Metric** (Sales, Growth %, Target Achievement %, Projected Achievement %) to rank stores from every Area at once (when scope is Company) or just one.

### Daily Entry (per Area — select a store)
Log sales day-by-day instead of importing a monthly file: pick a Year/Month, set an optional **monthly target** once, then fill in each day's sales amount (autosaves on blur). Shows running MTD Sales, % vs Target, and days entered out of the month. A Store Supervisor is locked to their own store; Area Supervisors and the Super Admin can pick any store in the selected Area. **Importing a monthly file for a store/month replaces whatever's here** (see below) — the two entry methods are not meant to be mixed for the same store in the same month.

### Import Data (per Area — select an Area first)
1. Click **Choose File** and upload a monthly Excel/CSV file.
2. **Map your columns**: every detected column, a sample value, and a dropdown to map it to Store Name, Year, Month (or a single Date column instead), Sales Amount, Target Amount, or a Driver Metric (name it anything — footfall, transactions, basket size, ...).
3. **Import data** → an **Import complete** summary: rows added, rows updated, rows that failed and why, and how many stores were auto-created from names in the sheet.
4. **Re-upload the same month** (or a month with Daily Entry rows) — the store's data for that month is replaced with the file's totals, never duplicated or double-counted.
5. Next time you upload with the same column headers, your mapping is remembered automatically ("Using remembered mapping" badge); a changed layout prompts you to re-map.
6. **Recent imports** at the bottom is a running log per Area. If you uploaded the wrong file, click **Delete** next to it — this removes the rows it added, unless a later upload already corrected them (those stay, since they belong to the newer import now).

**Sales button** (on the Area Dashboard, below the store filters): click to expand a Top 10 leaderboard. Pick a Year, a From/To month range (e.g. Jan–Jun instead of the whole year), and a mode — **Vs. Target** or **Vs. Last Year** — to rank that Area's best-performing stores for the period.

### Sales Trend
Monthly sales over time within the selected Area. Pick a store to see just its line, or leave "All stores" to compare every store at once. Hover the chart for exact values.

### YoY Comparison / Drivers Comparison
Within the selected Area: pick a base year and a compare year (defaults to the two most recent years you have data for) to see a month-by-month bar chart and a % change table — one for total sales, one for any driver metric you've mapped (footfall, transactions, etc.).

### Performance & Remarks (bottom of the Area Dashboard)
- Choose the rule: **top/bottom % by growth** vs. a prior year, or **vs. target** (needs a Target Amount column mapped during import). Adjust the threshold %.
- Each store gets a High performer / Low performer / On track flag.
- Type a free-text remark per store for a chosen month — it autosaves on blur and persists across reloads.

### Settings
Per-Area checkboxes to show/hide each dashboard card and each of the Sales Trend / YoY Comparison / Drivers Comparison tabs — turn off what you don't need this month. Everyone also changes their own password here.

### Stores
Add a store (name + optional code + Area), deactivate a closed store (keeps its sales history, just stops it showing in filters/new imports as active), reactivate, or remove entirely (only allowed if it has no sales history — otherwise it's deactivated instead, so historical data is never silently lost).

### Users (Super Admin only)
Create accounts and assign each one a role — Super Admin, Area Supervisor (+ an Area), or Store Supervisor (+ a Store) — deactivate or remove them.

### Areas (Super Admin only)
Add a new Area (code + name), rename one, or deactivate one. No code change needed to grow past Central/North/South.

## How daily entry and monthly import coexist

`sales_records` is one row per store per **calendar day** (`UNIQUE(store_id, sales_date)`), not one row per month. Daily Entry writes exactly the days you fill in; a monthly Excel import writes a single row dated the 1st of the imported month. A month's **target** always lives on that month's day-1 row, so every dashboard/ranking query that sums `target_amount` across a month keeps working correctly regardless of how many daily rows exist alongside it.

**Importing a month is authoritative for that store/month**: it deletes every row already there (bulk or daily) before writing the file's total, so re-uploading a month with existing Daily Entry rows replaces them rather than double-counting on top of them. In practice, pick one method per store per month — don't bulk-import a month you're also entering daily, since whichever you do last wins.

"MTD" and "Projected EOM" figures on the dashboards are the sum of whatever `sales_records` rows exist for the period (prorated by calendar days elapsed for the current month when projecting) — see `server/src/services/metrics.js`.

## Known limitation

A security advisory exists against the `xlsx` (SheetJS) npm package with no upstream npm fix — SheetJS only publishes patched builds via their own CDN (`cdn.sheetjs.com`), which wasn't reachable from the environment this app was built in. Since this app only ever parses files you upload yourself on your own machine, the risk is low, but if you want the patched build: `npm install https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz` inside `server/`.

## Troubleshooting

**`npm install` fails with `gyp ERR! find Python` or asks for a C++ compiler**: you're on an old copy of this app that used `better-sqlite3`, which needs a native build toolchain on Windows. Pull the latest version — it now uses Node's built-in SQLite support and needs nothing beyond Node.js itself.

## Non-goals (by design, v1)

- No cloud sync — the SQLite file on your machine is the only copy. Back it up (`server/data/retail-sales.db`) if that matters to you.

## Upgrading from an older copy of this app

Older copies of this app used two hard-coded "datasets" (Company Owned /
Franchise) and one shared password instead of Areas and per-user accounts.
Starting the server against an existing `retail-sales.db` from that version
migrates it automatically and in place: `stores`/`sales_records`/import
config move onto the new `Area` model (the old **Company Owned** dataset
becomes **Central**, **Franchise** becomes **North** — reassign any store to
a different Area afterwards from the Stores page), and the old shared
password is dropped in favor of the Super Admin setup screen. This runs once
automatically; nothing to do beyond starting the server as usual.

A copy from just before Daily Entry shipped (Area model already in place, but
`sales_records` still one row per store per month) migrates the same way,
automatically: existing rows already satisfy the new one-row-per-day
constraint as-is, so this is a pure rename+copy with no data changes.
