import { Router } from 'express';
import db from '../db.js';
import { resolveAreaScope, canAccessStore } from '../rbac.js';

const router = Router();

router.get('/', (req, res) => {
  const { areaId, ok } = resolveAreaScope(req.user, req.query.areaId);
  if (!ok) return res.status(403).json({ error: 'Not permitted for this area' });
  const { year, month } = req.query;
  if (!year || !month) return res.status(400).json({ error: 'year and month are required' });
  const rows = areaId === null
    ? db.prepare(`
        SELECT r.store_id, r.text, r.updated_at FROM remarks r
        WHERE r.year = ? AND r.month = ?
      `).all(Number(year), Number(month))
    : db.prepare(`
        SELECT r.store_id, r.text, r.updated_at
        FROM remarks r
        JOIN stores st ON st.id = r.store_id
        WHERE st.area_id = ? AND r.year = ? AND r.month = ?
      `).all(areaId, Number(year), Number(month));
  res.json(rows);
});

router.put('/', (req, res) => {
  const { storeId, year, month, text } = req.body;
  if (!storeId || !year || !month) return res.status(400).json({ error: 'storeId, year, and month are required' });
  if (!canAccessStore(req.user, storeId)) return res.status(403).json({ error: 'Not permitted for this store' });
  db.prepare(`
    INSERT INTO remarks (store_id, year, month, text, created_at, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(store_id, year, month) DO UPDATE SET text = excluded.text, updated_at = datetime('now')
  `).run(storeId, year, month, text || '');
  res.json(db.prepare('SELECT * FROM remarks WHERE store_id = ? AND year = ? AND month = ?').get(storeId, year, month));
});

export default router;
