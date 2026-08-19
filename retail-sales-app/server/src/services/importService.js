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

export function suggestMapping(dataset, headers) {
  const signature = [...headers].sort().join('|');
  const stored = db.prepare('SELECT * FROM field_mappings WHERE dataset = ?').get(dataset);

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

export function saveMapping(dataset, headers, mapping) {
  const signature = [...headers].sort().join('|');
  db.prepare(`
    INSERT INTO field_mappings (dataset, mapping_json, source_columns_signature, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(dataset) DO UPDATE SET mapping_json = excluded.mapping_json,
      source_columns_signature = excluded.source_columns_signature, updated_at = datetime('now')
  `).run(dataset, JSON.stringify(mapping), signature);
}

function getOrCreateStore(dataset, name) {
  const trimmed = String(name).trim();
  let store = db.prepare('SELECT * FROM stores WHERE dataset = ? AND lower(name) = lower(?)').get(dataset, trimmed);
  let created = false;
  if (!store) {
    const info = db.prepare('INSERT INTO stores (dataset, name) VALUES (?, ?)').run(dataset, trimmed);
    store = db.prepare('SELECT * FROM stores WHERE id = ?').get(info.lastInsertRowid);
    created = true;
  }
  return { store, created };
}

function upsertDriverDefinition(dataset, key, label) {
  const existing = db.prepare('SELECT id FROM driver_definitions WHERE dataset = ? AND key = ?').get(dataset, key);
  if (!existing) {
    const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM driver_definitions WHERE dataset = ?').get(dataset).m;
    db.prepare('INSERT INTO driver_definitions (dataset, key, label, sort_order) VALUES (?, ?, ?, ?)')
      .run(dataset, key, label, maxOrder + 1);
  }
}

export function performImport({ dataset, filename, headers, rows, mapping }) {
  saveMapping(dataset, headers, mapping);

  const driverColumns = Object.entries(mapping).filter(([, m]) => m.field === 'driver');
  for (const [, m] of driverColumns) {
    upsertDriverDefinition(dataset, m.driverKey, m.driverLabel || m.driverKey);
  }

  let storesCreated = 0;
  let rowsAdded = 0;
  let rowsUpdated = 0;
  const failures = [];

  const findExisting = db.prepare('SELECT id FROM sales_records WHERE store_id = ? AND year = ? AND month = ?');
  const insertSales = db.prepare(`
    INSERT INTO sales_records (store_id, dataset, year, month, sales_amount, target_amount, drivers_json, import_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(store_id, year, month) DO UPDATE SET
      sales_amount = excluded.sales_amount,
      target_amount = excluded.target_amount,
      drivers_json = excluded.drivers_json,
      import_id = excluded.import_id,
      updated_at = datetime('now')
  `);

  const importRow = db.prepare(`
    INSERT INTO imports (dataset, filename, uploaded_at, rows_added, rows_updated, rows_failed, errors_json)
    VALUES (?, ?, datetime('now'), 0, 0, 0, '[]')
  `);
  const importInfo = importRow.run(dataset, filename);
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

        const { store, created } = getOrCreateStore(dataset, storeName);
        if (created) storesCreated += 1;

        const existing = findExisting.get(store.id, year, month);
        insertSales.run(store.id, dataset, year, month, salesAmount, targetAmount, JSON.stringify(drivers), importId);
        if (existing) rowsUpdated += 1;
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
