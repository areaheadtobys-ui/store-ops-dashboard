import { useEffect, useState } from 'react';
import { useArea } from '../context/AreaContext.jsx';
import { api } from '../lib/api.js';
import { formatNumber, formatPercent } from '../lib/format.js';

const METRICS = [
  { key: 'sales', label: 'Sales' },
  { key: 'growth_pct', label: 'Growth %' },
  { key: 'target_achievement_pct', label: 'Target Achievement %' },
  { key: 'projected_achievement_pct', label: 'Projected Achievement %' },
];

export default function RankingsPage() {
  const { areas, canSwitchArea, areaId: currentAreaId } = useArea();
  const [scope, setScope] = useState('all');
  const [direction, setDirection] = useState('top');
  const [limit, setLimit] = useState(10);
  const [metric, setMetric] = useState('sales');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Non-Super-Admin users are locked to their own area's scope.
  useEffect(() => {
    if (!canSwitchArea) setScope(currentAreaId);
  }, [canSwitchArea, currentAreaId]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ scope, direction, limit, metric });
    api.get(`/rankings?${params.toString()}`).then(setData).finally(() => setLoading(false));
  }, [scope, direction, limit, metric]);

  const metricLabel = METRICS.find((m) => m.key === metric)?.label;

  return (
    <div>
      <div className="card">
        <h2>Top &amp; Bottom Performers</h2>
        <p className="text-muted">Rank stores across the whole company or within one Area, by Sales, Growth, Target Achievement, or Projected Achievement.</p>
        <div className="filter-bar">
          <div className="field">
            <label>Scope</label>
            <select value={scope} onChange={(e) => setScope(e.target.value)} disabled={!canSwitchArea}>
              <option value="all">Company (all areas)</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.area_name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Ranking</label>
            <select value={`${direction}_${limit}`} onChange={(e) => {
              const [d, l] = e.target.value.split('_');
              setDirection(d); setLimit(Number(l));
            }}>
              <option value="top_5">Top 5</option>
              <option value="top_10">Top 10</option>
              <option value="bottom_5">Bottom 5</option>
              <option value="bottom_10">Bottom 10</option>
            </select>
          </div>
          <div className="field">
            <label>Metric</label>
            <select value={metric} onChange={(e) => setMetric(e.target.value)}>
              {METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>{direction === 'top' ? 'Top' : 'Bottom'} {limit} Stores — {scope === 'all' ? 'Company' : areas.find((a) => String(a.id) === String(scope))?.area_name} — by {metricLabel}</h3>
        {loading || !data ? (
          <p className="text-muted">Loading…</p>
        ) : data.results.length === 0 ? (
          <p className="text-muted">No stores with data for this period yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th><th>Store</th><th>Area</th><th>Sales</th><th>Target</th>
                <th>Growth %</th><th>Target Achievement %</th><th>Projected Achievement %</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((r, i) => (
                <tr key={r.storeId}>
                  <td>{i + 1}</td>
                  <td>{r.storeName}</td>
                  <td>{r.areaName}</td>
                  <td>{formatNumber(r.sales)}</td>
                  <td>{formatNumber(r.target)}</td>
                  <td><Pct value={r.growthPct} /></td>
                  <td><Pct value={r.targetAchievementPct} /></td>
                  <td><Pct value={r.projectedAchievementPct} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Pct({ value }) {
  if (value === null || value === undefined) return '—';
  return <span className={`pill ${value >= 0 ? 'good' : 'bad'}`}>{formatPercent(value)}</span>;
}
