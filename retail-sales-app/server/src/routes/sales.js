import { Router } from 'express';
import db from '../db.js';
import { resolveAreaScope, resolveStoreScope } from '../rbac.js';

const router = Router();

function buildFilters(user, query) {
  const { areaId, ok } = resolveAreaScope(user, query.areaId);
  if (!ok) return { error: 'Not permitted for this area' };
  const { storeId, ok: storeOk } = resolveStoreScope(user, query.storeId, areaId);
  if (!storeOk) return { error: 'Not permitted for this store' };

  const clauses = [];
  const params = [];
  if (areaId !== null) { clauses.push('st.area_id = ?'); params.push(areaId); }
  if (storeId !== null) { clauses.push('s.store_id = ?'); params.push(storeId); }
  if (query.year) { clauses.push('s.year = ?'); params.push(Number(query.year)); }
  if (query.month) { clauses.push('s.month = ?'); params.push(Number(query.month)); }
  return { where: clauses.length ? clauses.join(' AND ') : '1 = 1', params, areaId, storeId };
}

router.get('/', (req, res) => {
  const f = buildFilters(req.user, req.query);
  if (f.error) return res.status(403).json({ error: f.error });
  const rows = db.prepare(`
    SELECT s.id, s.store_id, st.name AS store_name, st.area_id, ar.area_code, ar.area_name,
           s.year, s.month, s.sales_date, s.sales_amount, s.target_amount, s.drivers_json
    FROM sales_records s
    JOIN stores st ON st.id = s.store_id
    JOIN areas ar ON ar.id = st.area_id
    WHERE ${f.where}
    ORDER BY s.year, s.month, st.name
  `).all(...f.params);
  res.json(rows.map((r) => ({ ...r, drivers: JSON.parse(r.drivers_json || '{}'), drivers_json: undefined })));
});

router.get('/years', (req, res) => {
  const { areaId, ok } = resolveAreaScope(req.user, req.query.areaId);
  if (!ok) return res.status(403).json({ error: 'Not permitted for this area' });
  const rows = areaId === null
    ? db.prepare('SELECT DISTINCT year FROM sales_records ORDER BY year DESC').all()
    : db.prepare(`
        SELECT DISTINCT s.year FROM sales_records s JOIN stores st ON st.id = s.store_id
        WHERE st.area_id = ? ORDER BY s.year DESC
      `).all(areaId);
  res.json(rows.map((r) => r.year));
});

router.get('/drivers', (req, res) => {
  const { areaId, ok } = resolveAreaScope(req.user, req.query.areaId);
  if (!ok) return res.status(403).json({ error: 'Not permitted for this area' });
  const rows = areaId === null
    ? db.prepare('SELECT key, MIN(label) AS label, MIN(unit) AS unit FROM driver_definitions GROUP BY key ORDER BY key').all()
    : db.prepare('SELECT key, label, unit FROM driver_definitions WHERE area_id = ? ORDER BY sort_order').all(areaId);
  res.json(rows);
});

router.get('/top-performers', (req, res) => {
  const { areaId, ok } = resolveAreaScope(req.user, req.query.areaId);
  if (!ok) return res.status(403).json({ error: 'Not permitted for this area' });
  const { year, mode } = req.query;
  if (!year) return res.status(400).json({ error: 'year is required' });
  if (!['vs_target', 'vs_last_year'].includes(mode)) {
    return res.status(400).json({ error: 'mode must be "vs_target" or "vs_last_year"' });
  }

  const monthFrom = req.query.monthFrom ? Number(req.query.monthFrom) : 1;
  const monthTo = req.query.monthTo ? Number(req.query.monthTo) : 12;
  const limit = req.query.limit ? Math.max(1, Number(req.query.limit)) : 10;
  const yearNum = Number(year);

  const stores = areaId === null
    ? db.prepare('SELECT id, name FROM stores WHERE is_active = 1').all()
    : db.prepare('SELECT id, name FROM stores WHERE area_id = ? AND is_active = 1').all(areaId);
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
