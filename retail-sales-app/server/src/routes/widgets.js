import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const { dataset } = req.query;
  if (!dataset) return res.status(400).json({ error: 'dataset is required' });
  const rows = db.prepare('SELECT * FROM dashboard_widgets WHERE dataset = ? ORDER BY sort_order').all(dataset);
  res.json(rows);
});

router.patch('/:key', (req, res) => {
  const { dataset, visible } = req.body;
  if (!dataset) return res.status(400).json({ error: 'dataset is required' });
  db.prepare(`
    UPDATE dashboard_widgets SET visible = ? WHERE dataset = ? AND widget_key = ?
  `).run(visible ? 1 : 0, dataset, req.params.key);
  res.json(db.prepare('SELECT * FROM dashboard_widgets WHERE dataset = ? AND widget_key = ?').get(dataset, req.params.key));
});

export default router;
