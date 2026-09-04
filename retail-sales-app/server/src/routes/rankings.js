import { Router } from 'express';
import db from '../db.js';
import { resolveAreaScope } from '../rbac.js';
import { projectEndOfMonth, resolveDefaultPeriod } from '../services/metrics.js';

const router = Router();

const METRICS = ['sales', 'growth_pct', 'target_achievement_pct', 'projected_achievement_pct'];

function sumFor(storeId, year, month) {
  return db.prepare(`
    SELECT COALESCE(SUM(sales_amount), 0) AS sales, COALESCE(SUM(target_amount), 0) AS target,
           SUM(CASE WHEN target_amount IS NOT NULL THEN 1 ELSE 0 END) AS nTarget, COUNT(*) AS n
    FROM sales_records WHERE store_id = ? AND year = ? AND month = ?
  `).get(storeId, year, month);
}

// Company Top & Bottom Performers: Scope (Company/Area) x Ranking (top/bottom
// 5/10) x Metric (sales, growth %, target achievement %, projected
// achievement %), ranking stores from every area at once when scope=all.
router.get('/', (req, res) => {
  const { areaId, ok } = resolveAreaScope(req.user, req.query.scope ?? req.query.areaId);
  if (!ok) return res.status(403).json({ error: 'Not permitted for this area' });

  const metric = METRICS.includes(req.query.metric) ? req.query.metric : 'sales';
  const direction = req.query.direction === 'bottom' ? 'bottom' : 'top';
  const limit = [5, 10].includes(Number(req.query.limit)) ? Number(req.query.limit) : 10;

  const defaults = resolveDefaultPeriod(areaId);
  const year = req.query.year ? Number(req.query.year) : defaults.year;
  const month = req.query.month ? Number(req.query.month) : defaults.month;

  const stores = areaId === null
    ? db.prepare(`
        SELECT s.id, s.name, a.id AS area_id, a.area_code, a.area_name
        FROM stores s JOIN areas a ON a.id = s.area_id WHERE s.is_active = 1
      `).all()
    : db.prepare(`
        SELECT s.id, s.name, a.id AS area_id, a.area_code, a.area_name
        FROM stores s JOIN areas a ON a.id = s.area_id WHERE s.area_id = ? AND s.is_active = 1
      `).all(areaId);

  const rows = stores.map((store) => {
    const current = sumFor(store.id, year, month);
    if (current.n === 0) return null;
    const prior = sumFor(store.id, year - 1, month);
    const target = current.nTarget > 0 ? current.target : null;
    const ly = prior.n > 0 ? prior.sales : null;
    const projectedEom = projectEndOfMonth(current.sales, year, month);

    const growthPct = ly ? ((current.sales - ly) / ly) * 100 : null;
    const targetAchievementPct = target ? (current.sales / target) * 100 : null;
    const projectedAchievementPct = target ? (projectedEom / target) * 100 : null;

    const metricValue = { sales: current.sales, growth_pct: growthPct, target_achievement_pct: targetAchievementPct, projected_achievement_pct: projectedAchievementPct }[metric];

    return {
      storeId: store.id,
      storeName: store.name,
      areaId: store.area_id,
      areaCode: store.area_code,
      areaName: store.area_name,
      sales: current.sales,
      target,
      ly,
      growthPct,
      targetAchievementPct,
      projectedEom,
      projectedAchievementPct,
      metricValue,
    };
  }).filter((r) => r && r.metricValue !== null);

  rows.sort((a, b) => (direction === 'top' ? b.metricValue - a.metricValue : a.metricValue - b.metricValue));

  res.json({
    year,
    month,
    scope: areaId === null ? 'company' : String(areaId),
    metric,
    direction,
    limit,
    results: rows.slice(0, limit),
  });
});

export default router;
