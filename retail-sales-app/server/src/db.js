import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Overridable so a hosting provider's persistent disk can be mounted elsewhere.
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'retail-sales.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = OFF'); // off for the duration of any legacy rebuild below

function columnNames(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}

function tableExists(name) {
  return !!db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`).get(name);
}

// --- Migration from the pre-Area ("dataset": company/franchise, shared
// single password) schema. SQLite can't ALTER-DROP a column that's part of a
// UNIQUE constraint (every dataset-keyed table has one), so instead: rename
// each legacy table out of the way here, let the fresh-schema block below
// recreate the real table under its normal name, then copy the old rows
// across further down (once the areas they map to exist) and drop the
// renamed originals. Safe to run repeatedly — nothing to do once migrated.
const legacyTables = ['stores', 'field_mappings', 'driver_definitions', 'imports', 'sales_records', 'performance_settings', 'dashboard_widgets'];
const migratingTables = new Set();
for (const table of legacyTables) {
  if (tableExists(table) && columnNames(table).includes('dataset')) {
    db.exec(`ALTER TABLE ${table} RENAME TO legacy_${table}`);
    migratingTables.add(table);
  }
}
const migratingSessions = tableExists('sessions') && !columnNames('sessions').includes('user_id');
if (migratingSessions) db.exec('DROP TABLE sessions'); // shared-password sessions are invalid under per-user auth anyway
if (tableExists('app_auth')) db.exec('DROP TABLE app_auth');

// --- Core schema -----------------------------------------------------------
// Organizational hierarchy: COMPANY -> AREA -> STORE -> (STORE SUPERVISOR) -> sales.
// Areas are configurable master data (not hard-coded) so new areas can be
// added later without any schema change. One shared sales fact table
// (sales_records) covers every area; the area is always derived through
// store_id -> stores.area_id, never duplicated onto the fact table, so there
// is exactly one place sales data lives no matter how many areas exist.
db.exec(`
CREATE TABLE IF NOT EXISTS areas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  area_code TEXT NOT NULL UNIQUE,
  area_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  area_id INTEGER NOT NULL REFERENCES areas(id),
  name TEXT NOT NULL,
  code TEXT,
  store_type TEXT,
  region TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (area_id, name)
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'area_supervisor', 'store_supervisor')),
  area_id INTEGER REFERENCES areas(id),
  store_id INTEGER REFERENCES stores(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS field_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  area_id INTEGER NOT NULL UNIQUE REFERENCES areas(id),
  mapping_json TEXT NOT NULL,
  source_columns_signature TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS driver_definitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  area_id INTEGER NOT NULL REFERENCES areas(id),
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  unit TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (area_id, key)
);

CREATE TABLE IF NOT EXISTS imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  area_id INTEGER NOT NULL REFERENCES areas(id),
  filename TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  rows_added INTEGER NOT NULL DEFAULT 0,
  rows_updated INTEGER NOT NULL DEFAULT 0,
  rows_failed INTEGER NOT NULL DEFAULT 0,
  errors_json TEXT
);

-- Monthly sales fact table. The organizational spec describes daily entry
-- (sales_date, entered_by) for a future manual data-entry feature; this
-- build keeps the existing monthly Excel-import grain (the app's only entry
-- path today) but carries both columns now so that feature can be added
-- later without another migration. sales_date is the 1st of (year, month).
CREATE TABLE IF NOT EXISTS sales_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  sales_date TEXT NOT NULL,
  sales_amount REAL NOT NULL,
  target_amount REAL,
  drivers_json TEXT NOT NULL DEFAULT '{}',
  import_id INTEGER REFERENCES imports(id) ON DELETE SET NULL,
  entered_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (store_id, year, month)
);

CREATE TABLE IF NOT EXISTS remarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (store_id, year, month)
);

CREATE TABLE IF NOT EXISTS performance_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  area_id INTEGER NOT NULL UNIQUE REFERENCES areas(id),
  method TEXT NOT NULL DEFAULT 'top_bottom_pct' CHECK (method IN ('top_bottom_pct', 'vs_target')),
  pct_threshold REAL NOT NULL DEFAULT 20,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  area_id INTEGER NOT NULL REFERENCES areas(id),
  widget_key TEXT NOT NULL,
  visible INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (area_id, widget_key)
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
`);

// Seed the three required areas up front (idempotent) so a brand-new database
// already satisfies "must support three operational areas from the
// beginning", and so any legacy rows below have somewhere to land.
const insertArea = db.prepare(
  `INSERT OR IGNORE INTO areas (area_code, area_name, sort_order) VALUES (?, ?, ?)`
);
insertArea.run('CENTRAL', 'Central', 0);
insertArea.run('NORTH', 'North', 1);
insertArea.run('SOUTH', 'South', 2);

// --- Copy rows out of the renamed legacy tables, mapping the old two-way
// "dataset" split onto the new Area model (company -> CENTRAL, franchise ->
// NORTH — an arbitrary but harmless starting point; reassign stores to a
// different Area any time from the Stores page), then drop the originals.
if (migratingTables.size > 0) {
  const centralId = db.prepare(`SELECT id FROM areas WHERE area_code = 'CENTRAL'`).get().id;
  const northId = db.prepare(`SELECT id FROM areas WHERE area_code = 'NORTH'`).get().id;
  const areaIdFor = (datasetCol) => `(CASE ${datasetCol} WHEN 'company' THEN ${centralId} ELSE ${northId} END)`;

  if (migratingTables.has('stores')) {
    db.exec(`
      INSERT INTO stores (id, area_id, name, code, is_active, created_at, updated_at)
      SELECT id, ${areaIdFor('dataset')}, name, code, is_active, created_at, updated_at FROM legacy_stores
    `);
  }
  if (migratingTables.has('field_mappings')) {
    db.exec(`
      INSERT INTO field_mappings (id, area_id, mapping_json, source_columns_signature, updated_at)
      SELECT id, ${areaIdFor('dataset')}, mapping_json, source_columns_signature, updated_at FROM legacy_field_mappings
    `);
  }
  if (migratingTables.has('driver_definitions')) {
    db.exec(`
      INSERT INTO driver_definitions (id, area_id, key, label, unit, sort_order)
      SELECT id, ${areaIdFor('dataset')}, key, label, unit, sort_order FROM legacy_driver_definitions
    `);
  }
  if (migratingTables.has('imports')) {
    db.exec(`
      INSERT INTO imports (id, area_id, filename, uploaded_at, rows_added, rows_updated, rows_failed, errors_json)
      SELECT id, ${areaIdFor('dataset')}, filename, uploaded_at, rows_added, rows_updated, rows_failed, errors_json FROM legacy_imports
    `);
  }
  if (migratingTables.has('sales_records')) {
    db.exec(`
      INSERT INTO sales_records (id, store_id, year, month, sales_date, sales_amount, target_amount, drivers_json, import_id, created_at, updated_at)
      SELECT id, store_id, year, month, printf('%04d-%02d-01', year, month), sales_amount, target_amount, drivers_json, import_id, created_at, updated_at
      FROM legacy_sales_records
    `);
  }
  if (migratingTables.has('performance_settings')) {
    db.exec(`
      INSERT INTO performance_settings (id, area_id, method, pct_threshold, updated_at)
      SELECT id, ${areaIdFor('dataset')}, method, pct_threshold, updated_at FROM legacy_performance_settings
    `);
  }
  if (migratingTables.has('dashboard_widgets')) {
    db.exec(`
      INSERT INTO dashboard_widgets (id, area_id, widget_key, visible, sort_order)
      SELECT id, ${areaIdFor('dataset')}, widget_key, visible, sort_order FROM legacy_dashboard_widgets
    `);
  }
  for (const table of migratingTables) {
    db.exec(`DROP TABLE legacy_${table}`);
  }
}

db.exec('PRAGMA foreign_keys = ON');

const DEFAULT_WIDGETS = [
  ['totals', 'Totals Summary', 0],
  ['by_store', 'Sales by Store', 1],
  ['by_month', 'Sales by Month', 2],
  ['trend', 'Sales Trend', 3],
  ['yoy_sales', '2025 vs 2026 Sales Comparison', 4],
  ['yoy_drivers', 'Retail Drivers Comparison', 5],
  ['performance', 'Performance Remarks', 6],
];

const insertWidget = db.prepare(
  `INSERT OR IGNORE INTO dashboard_widgets (area_id, widget_key, visible, sort_order) VALUES (?, ?, 1, ?)`
);
const insertSettings = db.prepare(
  `INSERT OR IGNORE INTO performance_settings (area_id, method, pct_threshold) VALUES (?, 'top_bottom_pct', 20)`
);

function ensureAreaDefaults(areaId) {
  for (const [key, , order] of DEFAULT_WIDGETS) {
    insertWidget.run(areaId, key, order);
  }
  insertSettings.run(areaId);
}

for (const area of db.prepare('SELECT id FROM areas').all()) {
  ensureAreaDefaults(area.id);
}

export default db;
export { DEFAULT_WIDGETS, ensureAreaDefaults };
