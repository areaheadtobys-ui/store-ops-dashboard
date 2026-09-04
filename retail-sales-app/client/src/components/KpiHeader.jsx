import { formatNumber, formatPercent } from '../lib/format.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function KpiHeader({ title, data, loading, onChangePeriod }) {
  if (loading || !data) {
    return <div className="card"><p className="text-muted">Loading…</p></div>;
  }

  const { year, month, availableYears, kpis, insights } = data;

  return (
    <div className="card">
      <div className="flex-between">
        <h2 style={{ margin: 0 }}>{title}</h2>
        {onChangePeriod && (
          <div style={{ display: 'flex', gap: 10 }}>
            <select style={{ width: 'auto', minWidth: 90 }} value={year} onChange={(e) => onChangePeriod({ year: Number(e.target.value), month })}>
              {availableYears.length === 0 && <option value={year}>{year}</option>}
              {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select style={{ width: 'auto', minWidth: 130 }} value={month} onChange={(e) => onChangePeriod({ year, month: Number(e.target.value) })}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="stat-grid" style={{ marginTop: 16 }}>
        <Tile label="Total Company Sales (YTD)" value={formatNumber(kpis.totalCompanySales)} />
        <Tile label="Total MTD Sales" value={formatNumber(kpis.totalMtdSales)} />
        <Tile label="Total Target (YTD)" value={formatNumber(kpis.totalTarget)} />
        <Tile label="% Achievement" value={formatPercent(kpis.pctAchievement)} tone={tone(kpis.pctAchievement, 100)} />
        <Tile label="% vs LY" value={formatPercent(kpis.pctVsLy)} tone={tone(kpis.pctVsLy, 0)} />
        <Tile label="Projected EOM" value={formatNumber(kpis.projectedEom)} />
        <Tile label="Projected % Achievement" value={formatPercent(kpis.projectedPctAchievement)} tone={tone(kpis.projectedPctAchievement, 100)} />
      </div>

      {insights && insights.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.03em', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
            Management Insights
          </div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {insights.map((line, i) => <li key={i} style={{ marginBottom: 6 }}>{line}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function tone(value, mid) {
  if (value === null || value === undefined) return 'neutral';
  return value >= mid ? 'good' : 'bad';
}

function Tile({ label, value, tone: t }) {
  return (
    <div className="stat-tile">
      <div className="label">{label}</div>
      <div className={`value ${t === 'good' ? 'pill good' : t === 'bad' ? 'pill bad' : ''}`} style={t ? { fontSize: 20, display: 'inline-block' } : undefined}>
        {value}
      </div>
    </div>
  );
}
