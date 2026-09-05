import * as XLSX from 'xlsx';
import db from '../db.js';
import { parseMonth, parseYear, parseNumber } from '../fields.js';

export function parseWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
  const headers = rows.length > 0
    ? Object.keys(rows[0])
    : (XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] || []);
  return { sheetName, headers, rows };
}

function slugify(label) {
  return String(label).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'driver';
}

const GUESS_RULES = [
  { field: 'store_name', test: /store|branch|outlet|location/i },
  { field: 'year', test: /^year$|^yr$/i },
  { field: 'month', test: /^month$|^mo$/i },
  { field: 'period_date', test: /^date$|period/i },
  { field: 'sales_amount', test: /sales|revenue|turnover/i },
  { field: 'target_amount', test: /target|goal|budget/i },
];

const DRIVER_GUESS_RULES = [
  { test: /footfall|traffic|visitors?/i },
  { test: /transaction|txn|bills?|invoices?/i },
  { test: /basket|atv|average.?ticket|avg.?sale/i },
  { test: /conversion/i },
];

export function suggestMapping(areaId, headers) {
  const signature = [...headers].sort().join('|');
  const stored = db.prepare('SELECT * FROM field_mappings WHERE area_id = ?').get(areaId);

  if (stored && stored.source_columns_signature === signature) {
    return { mapping: JSON.parse(stored.mapping_json), exactMatch: true };
  }

  const storedMapping = stored ? JSON.parse(stored.mapping_json) : {};
  const mapping = {};
  for (const header of headers) {
    if (storedMapping[header]) {
      mapping[header] = storedMapping[header];
      continue;
    }
    const rule = GUESS_RULES.find((r) => r.test.test(header));
    if (rule) {
      mapping[header] = { field: rule.field };
      continue;
    }
    const driverRule = DRIVER_GUESS_RULES.find((r) => r.test.test(header));
    if (driverRule) {
      mapping[header] = { field: 'driver', driverKey: slugify(header), driverLabel: header };
      continue;
    }
    mapping[header] = { field: 'ignore' };
  }
  return { mapping, exactMatch: false };
}

export function saveMapping(areaId, headers, mapping) {
  const signature = [...headers].sort().join('|');
  db.prepare(`
    INSERT INTO field_mappings (area_id, mapping_json, source_columns_signature, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(area_id) DO UPDATE SET mapping_json = excluded.mapping_json,
      source_columns_signature = excluded.source_columns_signature, updated_at = datetime('now')
  `).run(areaId, JSON.stringify(mapping), signature);
}

function getOrCreateStore(areaId, name) {
  const trimmed = String(name).trim();
  let store = db.prepare('SELECT * FROM stores WHERE area_id = ? AND lower(name) = lower(?)').get(areaId, trimmed);
  let created = false;
  if (!store) {
    const info = db.prepare('INSERT INTO stores (area_id, name) VALUES (?, ?)').run(areaId, trimmed);
    store = db.prepare('SELECT * FROM stores WHERE id = ?').get(info.lastInsertRowid);
    created = true;
  }
  return { store, created };
}

function upsertDriverDefinition(areaId, key, label) {
  const existing = db.prepare('SELECT id FROM driver_definitions WHERE area_id = ? AND key = ?').get(areaId, key);
  if (!existing) {
    const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM driver_definitions WHERE area_id = ?').get(areaId).m;
    db.prepare('INSERT INTO driver_definitions (area_id, key, label, sort_order) VALUES (?, ?, ?, ?)')
      .run(areaId, key, label, maxOrder + 1);
  }
}

export function performImport({ areaId, filename, headers, rows, mapping, enteredBy }) {
  saveMapping(areaId, headers, mapping);

  const driverColumns = Object.entries(mapping).filter(([, m]) => m.field === 'driver');
  for (const [, m] of driverColumns) {
    upsertDriverDefinition(areaId, m.driverKey, m.driverLabel || m.driverKey);
  }

  let storesCreated = 0;
  let rowsAdded = 0;
  let rowsUpdated = 0;
  const failures = [];

  // sales_records is keyed by (store_id, sales_date) now, not (store_id,
  // year, month) — a store can have several rows in one month from Daily
  // Entry. Importing a month is authoritative for that store/month: it
  // deletes whatever's there first (bulk total or daily entries alike) and
  // writes a single day-1 row, so re-uploading a month never double-counts
  // against rows entered daily. Documented in the Upload page and README.
  const countExisting = db.prepare('SELECT COUNT(*) AS c FROM sales_records WHERE store_id = ? AND year = ? AND month = ?');
  const deleteExisting = db.prepare('DELETE FROM sales_records WHERE store_id = ? AND year = ? AND month = ?');
  const insertSales = db.prepare(`
    INSERT INTO sales_records (store_id, year, month, sales_date, sales_amount, target_amount, drivers_json, import_id, entered_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  const importRow = db.prepare(`
    INSERT INTO imports (area_id, filename, uploaded_at, rows_added, rows_updated, rows_failed, errors_json)
    VALUES (?, ?, datetime('now'), 0, 0, 0, '[]')
  `);
  const importInfo = importRow.run(areaId, filename);
  const importId = importInfo.lastInsertRowid;

  const runAll = () => {
    rows.forEach((row, index) => {
      try {
        let storeName = null;
        let year = null;
        let month = null;
        let salesAmount = null;
        let targetAmount = null;
        const drivers = {};

        for (const [header, m] of Object.entries(mapping)) {
          const raw = row[header];
          if (m.field === 'store_name') storeName = raw;
          else if (m.field === 'year') year = parseYear(raw);
          else if (m.field === 'month') month = parseMonth(raw);
          else if (m.field === 'period_date') {
            if (raw instanceof Date) {
              year = raw.getFullYear();
              month = raw.getMonth() + 1;
            } else if (typeof raw === 'string') {
              const d = new Date(raw);
              if (!Number.isNaN(d.getTime())) {
                year = d.getFullYear();
                month = d.getMonth() + 1;
              }
            }
          } else if (m.field === 'sales_amount') salesAmount = parseNumber(raw);
          else if (m.field === 'target_amount') targetAmount = parseNumber(raw);
          else if (m.field === 'driver') {
            const val = parseNumber(raw);
            if (val !== null) drivers[m.driverKey] = val;
          }
        }

        if (!storeName || String(storeName).trim() === '') {
          throw new Error('Missing store name');
        }
        if (!year) throw new Error('Missing or unrecognized year');
        if (!month) throw new Error('Missing or unrecognized month');
        if (salesAmount === null) throw new Error('Missing or unrecognized sales amount');

        const { store, created } = getOrCreateStore(areaId, storeName);
        if (created) storesCreated += 1;

        const existingCount = countExisting.get(store.id, year, month).c;
        if (existingCount > 0) deleteExisting.run(store.id, year, month);
        const salesDate = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
        insertSales.run(store.id, year, month, salesDate, salesAmount, targetAmount, JSON.stringify(drivers), importId, enteredBy ?? null);
        if (existingCount > 0) rowsUpdated += 1;
        else rowsAdded += 1;
      } catch (err) {
        failures.push({ row: index + 2, reason: err.message });
      }
    });

    db.prepare('UPDATE imports SET rows_added = ?, rows_updated = ?, rows_failed = ?, errors_json = ? WHERE id = ?')
      .run(rowsAdded, rowsUpdated, failures.length, JSON.stringify(failures), importId);
  };

  db.exec('BEGIN');
  try {
    runAll();
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return {
    importId,
    storesCreated,
    rowsAdded,
    rowsUpdated,
    rowsFailed: failures.length,
    failures,
  };
}
