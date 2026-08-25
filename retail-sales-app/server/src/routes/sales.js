import { Router } from 'express';
import db from '../db.js';

const router = Router();

function buildFilters(query) {
  const clauses = ['s.dataset = ?'];
  const params = [query.dataset];
  if (query.year) { clauses.push('s.year = ?'); params.push(Number(query.year)); }
  if (query.month) { clauses.push('s.month = ?'); params.push(Number(query.month)); }
  if (query.storeId) { clauses.push('s.store_id = ?'); params.push(Number(query.storeId)); }
  return { where: clauses.join(' AND '), params };
}

router.get('/', (req, res) => {
  if (!req.query.dataset) return res.status(400).json({ error: 'dataset is required' });
  const { where, params } = buildFilters(req.query);
  const rows = db.prepare(`
    SELECT s.id, s.store_id, st.name AS store_name, s.dataset, s.year, s.month,
           s.sales_amount, s.target_amount, s.drivers_json
    FROM sales_records s
    JOIN stores st ON st.id = s.store_id
    WHERE ${where}
    ORDER BY s.year, s.month, st.name
  `).all(...params);
  res.json(rows.map((r) => ({ ...r, drivers: JSON.parse(r.drivers_json || '{}'), drivers_json: undefined })));
});

router.get('/years', (req, res) => {
  if (!req.query.dataset) return res.status(400).json({ error: 'dataset is required' });
  const rows = db.prepare('SELECT DISTINCT year FROM sales_records WHERE dataset = ? ORDER BY year DESC').all(req.query.dataset);
  res.json(rows.map((r) => r.year));
});

router.get('/drivers', (req, res) => {
  if (!req.query.dataset) return res.status(400).json({ error: 'dataset is required' });
  const rows = db.prepare('SELECT key, label, unit FROM driver_definitions WHERE dataset = ? ORDER BY sort_order').all(req.query.dataset);
  res.json(rows);
});

router.get('/top-performers', (req, res) => {
  const { dataset, year, mode } = req.query;
  if (!dataset || !year) return res.status(400).json({ error: 'dataset and year are required' });
  if (!['vs_target', 'vs_last_year'].includes(mode)) {
    return res.status(400).json({ error: 'mode must be "vs_target" or "vs_last_year"' });
  }

  const monthFrom = req.query.monthFrom ? Number(req.query.monthFrom) : 1;
  const monthTo = req.query.monthTo ? Number(req.query.monthTo) : 12;
  const limit = req.query.limit ? Math.max(1, Number(req.query.limit)) : 10;
  const yearNum = Number(year);

  const stores = db.prepare('SELECT id, name FROM stores WHERE dataset = ? AND is_active = 1').all(dataset);
  const sumFor = db.prepare(`
    SELECT COALESCE(SUM(sales_amount), 0) AS sales, COALESCE(SUM(target_amount), 0) AS target, COUNT(*) AS n
    FROM sales_records WHERE store_id = ? AND year = ? AND month BETWEEN ? AND ?
  `);

  const results = stores.map((store) => {
    const current = sumFor.get(store.id, yearNum, monthFrom, monthTo);
    if (current.n === 0) return null;

    let comparePct = null;
    let compareSales = null;
    if (mode === 'vs_target') {
      if (current.target > 0) comparePct = ((current.sales - current.target) / current.target) * 100;
      compareSales = current.target > 0 ? current.target : null;
    } else {
      const prior = sumFor.get(store.id, yearNum - 1, monthFrom, monthTo);
      if (prior.n > 0 && prior.sales > 0) comparePct = ((current.sales - prior.sales) / prior.sales) * 100;
      compareSales = prior.n > 0 ? prior.sales : null;
    }

    return {
      storeId: store.id,
      storeName: store.name,
      sales: current.sales,
      compareSales,
      comparePct,
    };
  }).filter((r) => r && r.comparePct !== null);

  results.sort((a, b) => b.comparePct - a.comparePct);

  res.json({ mode, monthFrom, monthTo, results: results.slice(0, limit) });
});

export default router;
