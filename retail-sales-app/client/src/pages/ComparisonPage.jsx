import { useEffect, useMemo, useState } from 'react';
import { useArea } from '../context/AreaContext.jsx';
import { useFilters } from '../context/FiltersContext.jsx';
import { MONTHS } from '../components/FiltersBar.jsx';
import GroupedBarChart from '../components/GroupedBarChart.jsx';
import { api } from '../lib/api.js';
import { colorForIndex } from '../lib/chartColors.js';
import { formatNumber, formatPercent } from '../lib/format.js';

export default function ComparisonPage() {
  const { areaId } = useArea();
  const { storeId, setStoreId, stores, years } = useFilters();
  const [yearA, setYearA] = useState(null);
  const [yearB, setYearB] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (years.length === 0) return;
    const sorted = [...years].sort((a, b) => a - b);
    setYearB(sorted[sorted.length - 1]);
    setYearA(sorted.length > 1 ? sorted[sorted.length - 2] : sorted[sorted.length - 1]);
  }, [years]);

  useEffect(() => {
    if (!yearA || !yearB) return;
    setLoading(true);
    const params = new URLSearchParams({ areaId: String(areaId) });
    if (storeId !== 'all') params.set('storeId', storeId);
    api.get(`/sales?${params.toString()}`).then(setRecords).finally(() => setLoading(false));
  }, [areaId, storeId, yearA, yearB]);

  const { categories, series, rows } = useMemo(
    () => buildComparison(records, yearA, yearB),
    [records, yearA, yearB],
  );

  return (
    <div>
      <div className="card">
        <h2>Year-over-Year Sales Comparison</h2>
        <p className="text-muted">Compare monthly sales between two years, with percentage change.</p>
        <div className="filter-bar">
          <div className="field">
            <label>Store</label>
            <select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              <option value="all">All stores</option>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Base year</label>
            <select value={yearA ?? ''} onChange={(e) => setYearA(Number(e.target.value))}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Compare year</label>
            <select value={yearB ?? ''} onChange={(e) => setYearB(Number(e.target.value))}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p className="text-muted">Loading…</p>
        ) : records.length === 0 ? (
          <div className="empty-state"><p>No sales data matches these filters yet.</p></div>
        ) : (
          <GroupedBarChart categories={categories} series={series} />
        )}
      </div>

      {!loading && rows.length > 0 && (
        <div className="card">
          <h3>Monthly detail</h3>
          <table>
            <thead>
              <tr><th>Month</th><th>{yearA}</th><th>{yearB}</th><th>Change</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month}>
                  <td>{MONTHS[r.month - 1]}</td>
                  <td>{formatNumber(r.a)}</td>
                  <td>{formatNumber(r.b)}</td>
                  <td>
                    <span className={`pill ${r.pct === null ? 'neutral' : r.pct >= 0 ? 'good' : 'bad'}`}>
                      {formatPercent(r.pct)}
                    </span>
                  </td>
                </tr>
              ))}
              <tr>
                <td><strong>Total</strong></td>
                <td><strong>{formatNumber(rows.reduce((s, r) => s + (r.a || 0), 0))}</strong></td>
                <td><strong>{formatNumber(rows.reduce((s, r) => s + (r.b || 0), 0))}</strong></td>
                <td>
                  <strong>
                    {formatPercent(percentChange(
                      rows.reduce((s, r) => s + (r.a || 0), 0),
                      rows.reduce((s, r) => s + (r.b || 0), 0),
                    ))}
                  </strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function percentChange(a, b) {
  if (!a) return null;
  return ((b - a) / a) * 100;
}

function buildComparison(records, yearA, yearB) {
  const monthsPresent = [...new Set(records.filter((r) => r.year === yearA || r.year === yearB).map((r) => r.month))].sort((a, b) => a - b);
  const sumFor = (year, month) => records
    .filter((r) => r.year === year && r.month === month)
    .reduce((s, r) => s + r.sales_amount, 0);

  const rows = monthsPresent.map((month) => {
    const a = sumFor(yearA, month) || null;
    const b = sumFor(yearB, month) || null;
    return { month, a, b, pct: a && b !== null ? percentChange(a, b) : null };
  });

  const categories = monthsPresent.map((m) => MONTHS[m - 1].slice(0, 3));
  const series = [
    { name: String(yearA), color: colorForIndex(0), values: rows.map((r) => r.a) },
    { name: String(yearB), color: colorForIndex(1), values: rows.map((r) => r.b) },
  ];

  return { categories, series, rows };
}
