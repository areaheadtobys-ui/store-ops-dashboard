import { Router } from 'express';
import db from '../db.js';
import { resolveAreaScope, canAccessArea } from '../rbac.js';

const router = Router();

router.get('/', (req, res) => {
  const { areaId: rawAreaId, includeInactive } = req.query;
  const { areaId, ok } = resolveAreaScope(req.user, rawAreaId);
  if (!ok) return res.status(403).json({ error: 'Not permitted for this area' });

  // A Store Supervisor is scoped to exactly one store, not every store in
  // their store's area — narrow the list even though their area scope
  // (needed for area-level config elsewhere) would otherwise allow more.
  if (req.user.role === 'store_supervisor') {
    const stores = db.prepare(`
      SELECT s.*, a.area_code, a.area_name FROM stores s JOIN areas a ON a.id = s.area_id WHERE s.id = ?
    `).all(req.user.store_id);
    return res.json(stores);
  }

  const activeClause = includeInactive === 'true' ? '' : 'AND s.is_active = 1';
  const stores = areaId === null
    ? db.prepare(`
        SELECT s.*, a.area_code, a.area_name FROM stores s
        JOIN areas a ON a.id = s.area_id
        WHERE 1 = 1 ${activeClause}
        ORDER BY a.sort_order, s.name
      `).all()
    : db.prepare(`
        SELECT s.*, a.area_code, a.area_name FROM stores s
        JOIN areas a ON a.id = s.area_id
        WHERE s.area_id = ? ${activeClause}
        ORDER BY s.name
      `).all(areaId);
  res.json(stores);
});

router.post('/', (req, res) => {
  const { areaId, name, code, store_type, region } = req.body;
  if (!areaId || !name) return res.status(400).json({ error: 'areaId and name are required' });
  if (!canAccessArea(req.user, areaId)) return res.status(403).json({ error: 'Not permitted for this area' });
  try {
    const info = db.prepare(`
      INSERT INTO stores (area_id, name, code, store_type, region) VALUES (?, ?, ?, ?, ?)
    `).run(Number(areaId), name.trim(), code || null, store_type || null, region || null);
    const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(store);
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'A store with this name already exists in this area' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', (req, res) => {
  const { name, code, is_active, store_type, region, areaId } = req.body;
  const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(req.params.id);
  if (!store) return res.status(404).json({ error: 'Store not found' });
  if (!canAccessArea(req.user, store.area_id)) return res.status(403).json({ error: 'Not permitted for this store' });
  if (areaId !== undefined && !canAccessArea(req.user, areaId)) {
    return res.status(403).json({ error: 'Not permitted for this area' });
  }

  db.prepare(`
    UPDATE stores SET
      name = COALESCE(?, name),
      code = COALESCE(?, code),
      store_type = COALESCE(?, store_type),
      region = COALESCE(?, region),
      area_id = COALESCE(?, area_id),
      is_active = COALESCE(?, is_active),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name ?? null, code ?? null, store_type ?? null, region ?? null,
    areaId ? Number(areaId) : null,
    is_active === undefined ? null : (is_active ? 1 : 0),
    req.params.id,
  );

  res.json(db.prepare('SELECT * FROM stores WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(req.params.id);
  if (!store) return res.status(404).json({ error: 'Store not found' });
  if (!canAccessArea(req.user, store.area_id)) return res.status(403).json({ error: 'Not permitted for this store' });

  const recordCount = db.prepare('SELECT COUNT(*) AS c FROM sales_records WHERE store_id = ?').get(req.params.id).c;
  if (recordCount > 0) {
    db.prepare(`UPDATE stores SET is_active = 0, updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
    return res.json({ deactivated: true, message: 'Store has sales history, so it was deactivated instead of deleted.' });
  }
  db.prepare('DELETE FROM stores WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

export default router;
