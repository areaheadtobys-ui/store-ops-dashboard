import { Router } from 'express';
import db from '../db.js';
import { resolveAreaScope } from '../rbac.js';

const router = Router();

router.get('/settings', (req, res) => {
  const { areaId, ok } = resolveAreaScope(req.user, req.query.areaId);
  if (!ok) return res.status(403).json({ error: 'Not permitted for this area' });
  if (areaId === null) return res.status(400).json({ error: 'A single area must be selected' });
  const settings = db.prepare('SELECT * FROM performance_settings WHERE area_id = ?').get(areaId);
  res.json(settings);
});

router.patch('/settings', (req, res) => {
  const { areaId: rawAreaId, method, pct_threshold } = req.body;
  const { areaId, ok } = resolveAreaScope(req.user, rawAreaId);
  if (!ok) return res.status(403).json({ error: 'Not permitted for this area' });
  if (areaId === null) return res.status(400).json({ error: 'A single area must be selected' });
  if (method && !['top_bottom_pct', 'vs_target'].includes(method)) {
    return res.status(400).json({ error: 'Invalid method' });
  }
  db.prepare(`
    UPDATE performance_settings SET
      method = COALESCE(?, method),
      pct_threshold = COALESCE(?, pct_threshold),
      updated_at = datetime('now')
    WHERE area_id = ?
  `).run(method ?? null, pct_threshold ?? null, areaId);
  res.json(db.prepare('SELECT * FROM performance_settings WHERE area_id = ?').get(areaId));
});

router.get('/', (req, res) => {
  const { areaId, ok } = resolveAreaScope(req.user, req.query.areaId);
  if (!ok) return res.status(403).json({ error: 'Not permitted for this area' });
  const { year, compareYear, storeId } = req.query;
  if (!year) return res.status(400).json({ error: 'year is required' });

  const settings = areaId !== null ? db.prepare('SELECT * FROM performance_settings WHERE area_id = ?').get(areaId) : null;
  const stores = areaId === null
    ? db.prepare('SELECT id, name FROM stores WHERE is_active = 1 ORDER BY name').all()
    : db.prepare('SELECT id, name FROM stores WHERE area_id = ? AND is_active = 1 ORDER BY name').all(areaId);

  const sumFor = db.prepare(`
    SELECT COALESCE(SUM(sales_amount), 0) AS sales, COALESCE(SUM(target_amount), 0) AS target,
           COUNT(*) AS n, SUM(CASE WHEN target_amount IS NOT NULL THEN 1 ELSE 0 END) AS nTarget
    FROM sales_records WHERE store_id = ? AND year = ?
  `);

  const results = stores.map((store) => {
    const current = sumFor.get(store.id, Number(year));
    const prior = compareYear ? sumFor.get(store.id, Number(compareYear)) : null;

    const hasCurrent = current.n > 0;
    const growthPct = hasCurrent && prior && prior.sales > 0 ? ((current.sales - prior.sales) / prior.sales) * 100 : null;
    const vsTargetPct = hasCurrent && current.nTarget > 0 && current.target > 0
      ? ((current.sales - current.target) / current.target) * 100
      : null;

    return {
      storeId: store.id,
      storeName: store.name,
      sales: hasCurrent ? current.sales : null,
      priorSales: prior && prior.n > 0 ? prior.sales : null,
      growthPct,
      target: current.nTarget > 0 ? current.target : null,
      vsTargetPct,
    };
  });

  const method = settings?.method || 'top_bottom_pct';
  const threshold = settings?.pct_threshold ?? 20;

  if (method === 'vs_target') {
    for (const r of results) {
      if (r.vsTargetPct === null) r.flag = 'unknown';
      else if (r.vsTargetPct >= 0) r.flag = 'high';
      else if (r.vsTargetPct <= -threshold) r.flag = 'low';
      else r.flag = 'neutral';
    }
  } else {
    const ranked = results.filter((r) => r.growthPct !== null).sort((a, b) => b.growthPct - a.growthPct);
    const cutoff = Math.max(1, Math.round(ranked.length * (threshold / 100)));
    const highSet = new Set(ranked.slice(0, cutoff).map((r) => r.storeId));
    const lowSet = new Set(ranked.slice(-cutoff).map((r) => r.storeId));
    for (const r of results) {
      if (r.growthPct === null) r.flag = 'unknown';
      else if (highSet.has(r.storeId) && ranked.length > 1) r.flag = 'high';
      else if (lowSet.has(r.storeId) && ranked.length > 1) r.flag = 'low';
      else r.flag = 'neutral';
    }
  }

  // Filter to one store only after ranking, so top/bottom-% flags stay
  // computed relative to every store, not just the one being viewed.
  const filtered = storeId ? results.filter((r) => String(r.storeId) === String(storeId)) : results;

  res.json({ method, threshold, results: filtered });
});

export default router;
