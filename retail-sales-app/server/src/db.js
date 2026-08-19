import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'retail-sales.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset TEXT NOT NULL CHECK (dataset IN ('company', 'franchise')),
  name TEXT NOT NULL,
  code TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (dataset, name)
);

CREATE TABLE IF NOT EXISTS field_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset TEXT NOT NULL UNIQUE CHECK (dataset IN ('company', 'franchise')),
  mapping_json TEXT NOT NULL,
  source_columns_signature TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS driver_definitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset TEXT NOT NULL CHECK (dataset IN ('company', 'franchise')),
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  unit TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (dataset, key)
);

CREATE TABLE IF NOT EXISTS imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset TEXT NOT NULL CHECK (dataset IN ('company', 'franchise')),
  filename TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  rows_added INTEGER NOT NULL DEFAULT 0,
  rows_updated INTEGER NOT NULL DEFAULT 0,
  rows_failed INTEGER NOT NULL DEFAULT 0,
  errors_json TEXT
);

CREATE TABLE IF NOT EXISTS sales_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  dataset TEXT NOT NULL CHECK (dataset IN ('company', 'franchise')),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  sales_amount REAL NOT NULL,
  target_amount REAL,
  drivers_json TEXT NOT NULL DEFAULT '{}',
  import_id INTEGER REFERENCES imports(id) ON DELETE SET NULL,
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
  dataset TEXT NOT NULL UNIQUE CHECK (dataset IN ('company', 'franchise')),
  method TEXT NOT NULL DEFAULT 'top_bottom_pct' CHECK (method IN ('top_bottom_pct', 'vs_target')),
  pct_threshold REAL NOT NULL DEFAULT 20,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset TEXT NOT NULL CHECK (dataset IN ('company', 'franchise')),
  widget_key TEXT NOT NULL,
  visible INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (dataset, widget_key)
);
`);

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
  `INSERT OR IGNORE INTO dashboard_widgets (dataset, widget_key, visible, sort_order) VALUES (?, ?, 1, ?)`
);
const insertSettings = db.prepare(
  `INSERT OR IGNORE INTO performance_settings (dataset, method, pct_threshold) VALUES (?, 'top_bottom_pct', 20)`
);

for (const dataset of ['company', 'franchise']) {
  for (const [key, , order] of DEFAULT_WIDGETS) {
    insertWidget.run(dataset, key, order);
  }
  insertSettings.run(dataset);
}

export default db;
export { DEFAULT_WIDGETS };
