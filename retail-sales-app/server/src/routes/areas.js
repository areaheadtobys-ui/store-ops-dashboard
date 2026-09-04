import { Router } from 'express';
import db from '../db.js';
import { ensureAreaDefaults } from '../db.js';
import { allowedAreaIds, requireSuperAdmin } from '../rbac.js';

const router = Router();

// Areas are configurable master data — Super Admin can add more later
// (VISAYAS, MINDANAO, ...) without any code or schema change.
router.get('/', (req, res) => {
  const allowed = allowedAreaIds(req.user);
  const areas = allowed === null
    ? db.prepare('SELECT * FROM areas ORDER BY sort_order, area_name').all()
    : allowed.length === 0
      ? []
      : db.prepare(`SELECT * FROM areas WHERE id IN (${allowed.map(() => '?').join(',')}) ORDER BY sort_order, area_name`).all(...allowed);
  res.json(areas);
});

router.post('/', requireSuperAdmin, (req, res) => {
  const { area_code, area_name } = req.body;
  if (!area_code || !area_name) return res.status(400).json({ error: 'area_code and area_name are required' });
  try {
    const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM areas').get().m;
    const info = db.prepare('INSERT INTO areas (area_code, area_name, sort_order) VALUES (?, ?, ?)')
      .run(area_code.trim().toUpperCase(), area_name.trim(), maxOrder + 1);
    ensureAreaDefaults(info.lastInsertRowid);
    res.status(201).json(db.prepare('SELECT * FROM areas WHERE id = ?').get(info.lastInsertRowid));
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'An area with this code already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', requireSuperAdmin, (req, res) => {
  const area = db.prepare('SELECT * FROM areas WHERE id = ?').get(req.params.id);
  if (!area) return res.status(404).json({ error: 'Area not found' });
  const { area_name, status } = req.body;
  if (status && !['active', 'inactive'].includes(status)) {
    return res.status(400).json({ error: 'status must be "active" or "inactive"' });
  }
  db.prepare(`
    UPDATE areas SET area_name = COALESCE(?, area_name), status = COALESCE(?, status), updated_at = datetime('now')
    WHERE id = ?
  `).run(area_name ?? null, status ?? null, req.params.id);
  res.json(db.prepare('SELECT * FROM areas WHERE id = ?').get(req.params.id));
});

export default router;
