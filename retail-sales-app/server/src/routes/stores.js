import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const { dataset, includeInactive } = req.query;
  if (!dataset) return res.status(400).json({ error: 'dataset is required' });
  const stores = includeInactive === 'true'
    ? db.prepare('SELECT * FROM stores WHERE dataset = ? ORDER BY name').all(dataset)
    : db.prepare('SELECT * FROM stores WHERE dataset = ? AND is_active = 1 ORDER BY name').all(dataset);
  res.json(stores);
});

router.post('/', (req, res) => {
  const { dataset, name, code } = req.body;
  if (!dataset || !name) return res.status(400).json({ error: 'dataset and name are required' });
  try {
    const info = db.prepare('INSERT INTO stores (dataset, name, code) VALUES (?, ?, ?)').run(dataset, name.trim(), code || null);
    const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(store);
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'A store with this name already exists in this dataset' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', (req, res) => {
  const { name, code, is_active } = req.body;
  const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(req.params.id);
  if (!store) return res.status(404).json({ error: 'Store not found' });

  db.prepare(`
    UPDATE stores SET
      name = COALESCE(?, name),
      code = COALESCE(?, code),
      is_active = COALESCE(?, is_active),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(name ?? null, code ?? null, is_active === undefined ? null : (is_active ? 1 : 0), req.params.id);

  res.json(db.prepare('SELECT * FROM stores WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(req.params.id);
  if (!store) return res.status(404).json({ error: 'Store not found' });
  const recordCount = db.prepare('SELECT COUNT(*) AS c FROM sales_records WHERE store_id = ?').get(req.params.id).c;
  if (recordCount > 0) {
    db.prepare(`UPDATE stores SET is_active = 0, updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
    return res.json({ deactivated: true, message: 'Store has sales history, so it was deactivated instead of deleted.' });
  }
  db.prepare('DELETE FROM stores WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

export default router;
