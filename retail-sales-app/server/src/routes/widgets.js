import { Router } from 'express';
import db from '../db.js';
import { resolveAreaScope } from '../rbac.js';

const router = Router();

router.get('/', (req, res) => {
  const { areaId, ok } = resolveAreaScope(req.user, req.query.areaId);
  if (!ok) return res.status(403).json({ error: 'Not permitted for this area' });
  if (areaId === null) return res.json([]); // company-wide view has its own fixed layout
  const rows = db.prepare('SELECT * FROM dashboard_widgets WHERE area_id = ? ORDER BY sort_order').all(areaId);
  res.json(rows);
});

router.patch('/:key', (req, res) => {
  const { areaId: rawAreaId, visible } = req.body;
  const { areaId, ok } = resolveAreaScope(req.user, rawAreaId);
  if (!ok) return res.status(403).json({ error: 'Not permitted for this area' });
  if (areaId === null) return res.status(400).json({ error: 'A single area must be selected' });
  db.prepare(`
    UPDATE dashboard_widgets SET visible = ? WHERE area_id = ? AND widget_key = ?
  `).run(visible ? 1 : 0, areaId, req.params.key);
  res.json(db.prepare('SELECT * FROM dashboard_widgets WHERE area_id = ? AND widget_key = ?').get(areaId, req.params.key));
});

export default router;
