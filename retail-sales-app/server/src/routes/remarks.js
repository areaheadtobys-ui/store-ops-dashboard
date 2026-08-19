import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const { dataset, year, month } = req.query;
  if (!dataset || !year || !month) return res.status(400).json({ error: 'dataset, year, and month are required' });
  const rows = db.prepare(`
    SELECT r.store_id, r.text, r.updated_at
    FROM remarks r
    JOIN stores st ON st.id = r.store_id
    WHERE st.dataset = ? AND r.year = ? AND r.month = ?
  `).all(dataset, Number(year), Number(month));
  res.json(rows);
});

router.put('/', (req, res) => {
  const { storeId, year, month, text } = req.body;
  if (!storeId || !year || !month) return res.status(400).json({ error: 'storeId, year, and month are required' });
  db.prepare(`
    INSERT INTO remarks (store_id, year, month, text, created_at, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(store_id, year, month) DO UPDATE SET text = excluded.text, updated_at = datetime('now')
  `).run(storeId, year, month, text || '');
  res.json(db.prepare('SELECT * FROM remarks WHERE store_id = ? AND year = ? AND month = ?').get(storeId, year, month));
});

export default router;
