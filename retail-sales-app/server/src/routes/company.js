import { Router } from 'express';
import db from '../db.js';
import { resolveAreaScope } from '../rbac.js';
import { computePeriodMetrics, resolveDefaultPeriod, generateCompanyInsights, generateAreaInsights } from '../services/metrics.js';

const router = Router();

function pctOrNull(numerator, denominator) {
  if (!denominator) return null;
  return (numerator / denominator) * 100;
}

// Powers both the top-level Company Sales Dashboard (areaId=all, Super Admin
// only) and a single Area Dashboard's KPI header (areaId=<id>) — same shape
// either way so the client renders them with one component.
router.get('/dashboard', (req, res) => {
  const { areaId, ok } = resolveAreaScope(req.user, req.query.areaId);
  if (!ok) return res.status(403).json({ error: 'Not permitted for this area' });

  const defaults = resolveDefaultPeriod(areaId);
  const year = req.query.year ? Number(req.query.year) : defaults.year;
  const month = req.query.month ? Number(req.query.month) : defaults.month;

  const areas = areaId === null
    ? db.prepare(`SELECT * FROM areas WHERE status = 'active' ORDER BY sort_order, area_name`).all()
    : [db.prepare('SELECT * FROM areas WHERE id = ?').get(areaId)].filter(Boolean);

  const areaRows = areas.map((area) => {
    const m = computePeriodMetrics(area.id, year, month);
    return {
      areaId: area.id,
      areaCode: area.area_code,
      areaName: area.area_name,
      mtdSales: m.mtdSales,
      ly: m.lySales,
      target: m.mtdTarget,
      pctVsLy: m.pctVsLy,
      pctVsTarget: m.pctVsTarget,
      projectedEom: m.projectedEom,
      projectedPctAchievement: m.projectedPctAchievement,
    };
  });

  let totalRow = null;
  if (areaRows.length > 1) {
    const sum = (key) => areaRows.reduce((s, r) => s + (r[key] || 0), 0);
    const hasAnyLy = areaRows.some((r) => r.ly !== null);
    const hasAnyTarget = areaRows.some((r) => r.target !== null);
    const mtdSales = sum('mtdSales');
    const ly = hasAnyLy ? sum('ly') : null;
    const target = hasAnyTarget ? sum('target') : null;
    const projectedEom = sum('projectedEom');
    totalRow = {
      areaId: 'total',
      areaCode: 'TOTAL',
      areaName: 'TOTAL',
      mtdSales,
      ly,
      target,
      pctVsLy: pctOrNull(mtdSales - (ly || 0), ly),
      pctVsTarget: pctOrNull(mtdSales - (target || 0), target),
      projectedEom,
      projectedPctAchievement: pctOrNull(projectedEom, target),
    };
  }

  const kpis = computePeriodMetrics(areaId, year, month);
  const scopeAreaName = areaId === null ? 'Company' : areas[0]?.area_name || null;

  const insights = areaId === null
    ? generateCompanyInsights(
        {
          pctAchievement: kpis.pctAchievement,
          pctYtdVsLy: kpis.pctYtdVsLy,
          projectedPctAchievement: kpis.projectedPctAchievement,
        },
        areaRows,
      )
    : generateAreaInsights(scopeAreaName, kpis);

  const yearsRows = areaId === null
    ? db.prepare('SELECT DISTINCT year FROM sales_records ORDER BY year DESC').all()
    : db.prepare(`
        SELECT DISTINCT s.year FROM sales_records s JOIN stores st ON st.id = s.store_id
        WHERE st.area_id = ? ORDER BY s.year DESC
      `).all(areaId);

  res.json({
    year,
    month,
    scope: { areaId, areaCode: areaId === null ? 'ALL' : areas[0]?.area_code, areaName: scopeAreaName },
    availableYears: yearsRows.map((r) => r.year),
    kpis: {
      totalCompanySales: kpis.ytdSales,
      totalMtdSales: kpis.mtdSales,
      totalTarget: kpis.ytdTarget,
      pctAchievement: kpis.pctAchievement,
      pctVsLy: kpis.pctYtdVsLy,
      projectedEom: kpis.projectedEom,
      projectedPctAchievement: kpis.projectedPctAchievement,
    },
    areaRows,
    totalRow,
    insights,
  });
});

export default router;
