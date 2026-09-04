import db from '../db.js';

// Shared math for every "MTD sales / Target / % vs LY / % vs Target /
// Projected EOM" style figure across the Company, Area, and Rankings views,
// so the definitions stay identical everywhere they're shown.
//
// Sales data is monthly-grain (one row per store per month from Excel
// import), not literally daily, so "MTD" here means "the selected month's
// imported total so far" and "Projected EOM" prorates that by calendar days
// elapsed when the selected month is the current real-world month; for a
// past (complete) month the projection simply equals the actual total.

export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function periodClause(alias, areaId) {
  const clauses = [];
  const params = [];
  if (areaId !== null && areaId !== undefined) {
    clauses.push(`${alias}.area_id = ?`);
    params.push(areaId);
  }
  return { clauses, params };
}

function sumSales(areaId, year, monthFrom, monthTo) {
  const { clauses, params } = periodClause('st', areaId);
  clauses.push('s.year = ?', 's.month BETWEEN ? AND ?');
  params.push(year, monthFrom, monthTo);
  const row = db.prepare(`
    SELECT COALESCE(SUM(s.sales_amount), 0) AS sales,
           COALESCE(SUM(s.target_amount), 0) AS target,
           SUM(CASE WHEN s.target_amount IS NOT NULL THEN 1 ELSE 0 END) AS nTarget,
           COUNT(*) AS n
    FROM sales_records s JOIN stores st ON st.id = s.store_id
    WHERE ${clauses.join(' AND ')}
  `).get(...params);
  return row;
}

// True "today" unless overridden (used by tests); exposed as a function so
// projections stay correct across midnight/month boundaries within a run.
function today() {
  return new Date();
}

export function projectEndOfMonth(mtdSales, year, month) {
  const now = today();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  const totalDays = daysInMonth(year, month);
  if (!isCurrentMonth) return mtdSales; // past month: complete; future month: nothing to project from
  const elapsed = Math.min(now.getDate(), totalDays);
  if (elapsed <= 0) return 0;
  return (mtdSales / elapsed) * totalDays;
}

function pct(numerator, denominator) {
  if (!denominator) return null;
  return (numerator / denominator) * 100;
}

// Full metric set for one scope (areaId, or null = company-wide) and period.
export function computePeriodMetrics(areaId, year, month) {
  const mtd = sumSales(areaId, year, month, month);
  const ly = sumSales(areaId, year - 1, month, month);
  const ytd = sumSales(areaId, year, 1, month);
  const ytdLy = sumSales(areaId, year - 1, 1, month);

  const mtdSales = mtd.sales;
  const mtdTarget = mtd.nTarget > 0 ? mtd.target : null;
  const lySales = ly.n > 0 ? ly.sales : null;
  const ytdSales = ytd.sales;
  const ytdTarget = ytd.nTarget > 0 ? ytd.target : null;
  const ytdLySales = ytdLy.n > 0 ? ytdLy.sales : null;
  const projectedEom = projectEndOfMonth(mtdSales, year, month);

  return {
    hasData: mtd.n > 0 || ytd.n > 0,
    mtdSales,
    mtdTarget,
    lySales,
    ytdSales,
    ytdTarget,
    ytdLySales,
    projectedEom,
    pctVsLy: pct(mtdSales - (lySales ?? 0), lySales),
    pctVsTarget: pct(mtdSales - (mtdTarget ?? 0), mtdTarget),
    pctYtdVsLy: pct(ytdSales - (ytdLySales ?? 0), ytdLySales),
    pctAchievement: pct(ytdSales, ytdTarget),
    projectedPctAchievement: pct(projectedEom, mtdTarget),
  };
}

export function resolveDefaultPeriod(areaId) {
  const { clauses, params } = periodClause('st', areaId);
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const row = db.prepare(`
    SELECT s.year, s.month FROM sales_records s JOIN stores st ON st.id = s.store_id
    ${where}
    ORDER BY s.year DESC, s.month DESC LIMIT 1
  `).get(...params);
  if (row) return { year: row.year, month: row.month };
  const now = today();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function fmtPct(n) {
  if (n === null || n === undefined) return null;
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function joinNames(names) {
  if (names.length <= 1) return names[0] || '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

export function generateCompanyInsights(kpis, areaRows) {
  const insights = [];
  if (kpis.pctAchievement !== null) {
    const lyPart = kpis.pctYtdVsLy !== null
      ? `, ${kpis.pctYtdVsLy >= 0 ? 'up' : 'down'} ${Math.abs(kpis.pctYtdVsLy).toFixed(1)}% vs last year`
      : '';
    insights.push(`Company sales are currently ${kpis.pctAchievement.toFixed(1)}% of target for the period${lyPart}.`);
  }

  const withTarget = areaRows.filter((r) => r.pctVsTarget !== null);
  const above = withTarget.filter((r) => r.pctVsTarget >= 0).map((r) => r.areaName);
  const below = withTarget.filter((r) => r.pctVsTarget < 0).map((r) => r.areaName);
  if (above.length > 0 && below.length > 0) {
    insights.push(`${joinNames(above)} ${above.length > 1 ? 'are' : 'is'} performing above target while ${joinNames(below)} ${below.length > 1 ? 'are' : 'is'} below target.`);
  } else if (above.length > 0 && withTarget.length > 0) {
    insights.push(`Every area with a target set (${joinNames(above)}) is performing above target.`);
  } else if (below.length > 0 && withTarget.length > 0) {
    insights.push(`Every area with a target set (${joinNames(below)}) is currently below target.`);
  }

  if (withTarget.length > 1) {
    const best = [...withTarget].sort((a, b) => b.pctVsTarget - a.pctVsTarget)[0];
    const worst = [...withTarget].sort((a, b) => a.pctVsTarget - b.pctVsTarget)[0];
    if (best.areaId !== worst.areaId) {
      insights.push(`${best.areaName} is the best-performing area at ${fmtPct(best.pctVsTarget)} vs target; ${worst.areaName} is the weakest at ${fmtPct(worst.pctVsTarget)}.`);
    }
  }

  if (kpis.projectedPctAchievement !== null) {
    insights.push(`Company sales are projected to finish the month at ${kpis.projectedPctAchievement.toFixed(1)}% of target.`);
  }

  return insights;
}

export function generateAreaInsights(areaName, kpis) {
  const insights = [];
  if (kpis.pctVsLy !== null) {
    const achievementPart = kpis.pctAchievement !== null ? ` with ${kpis.pctAchievement.toFixed(1)}% target achievement` : '';
    insights.push(`${areaName} Area is currently ${fmtPct(kpis.pctVsLy)} vs LY${achievementPart}.`);
  } else if (kpis.pctAchievement !== null) {
    insights.push(`${areaName} Area is currently at ${kpis.pctAchievement.toFixed(1)}% of target.`);
  }
  if (kpis.projectedPctAchievement !== null) {
    insights.push(`${areaName} is projected to finish at ${kpis.projectedPctAchievement.toFixed(1)}% of monthly target.`);
  } else if (!kpis.hasData) {
    insights.push(`${areaName} has no sales data for this period yet.`);
  }
  return insights;
}
