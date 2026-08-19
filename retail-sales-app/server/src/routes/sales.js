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

export default router;
