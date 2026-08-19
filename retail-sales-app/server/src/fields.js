// The fixed set of app fields a spreadsheet column can be mapped to.
// 'driver' is repeatable: each column mapped to it becomes its own driver metric.
export const APP_FIELDS = [
  { field: 'store_name', label: 'Store Name', required: true, repeatable: false },
  { field: 'period_date', label: 'Date (a single column with the month/year, e.g. a date)', required: false, repeatable: false },
  { field: 'year', label: 'Year', required: false, repeatable: false },
  { field: 'month', label: 'Month', required: false, repeatable: false },
  { field: 'sales_amount', label: 'Sales Amount', required: true, repeatable: false },
  { field: 'target_amount', label: 'Target Amount', required: false, repeatable: false },
  { field: 'driver', label: 'Driver Metric (footfall, transactions, basket size, etc.)', required: false, repeatable: true },
  { field: 'ignore', label: 'Ignore this column', required: false, repeatable: true },
];

export const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

export function parseMonth(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value >= 1 && value <= 12) return Math.round(value);
    return null;
  }
  const str = String(value).trim().toLowerCase();
  if (/^\d+$/.test(str)) {
    const n = Number(str);
    return n >= 1 && n <= 12 ? n : null;
  }
  const idx = MONTH_NAMES.findIndex((m) => m.startsWith(str) || str.startsWith(m.slice(0, 3)));
  if (idx >= 0) return idx + 1;
  return null;
}

export function parseYear(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 100) return 2000 + n;
  if (n >= 1900 && n <= 2100) return Math.round(n);
  return null;
}

export function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/[,₹$\s]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
