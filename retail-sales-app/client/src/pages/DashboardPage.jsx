import { useEffect, useMemo, useState } from 'react';
import { useDataset } from '../context/DatasetContext.jsx';
import { useFilters, buildQuery } from '../context/FiltersContext.jsx';
import FiltersBar, { MONTHS } from '../components/FiltersBar.jsx';
import { api } from '../lib/api.js';
import { formatNumber } from '../lib/format.js';

export default function DashboardPage() {
  const { dataset } = useDataset();
  const filters = useFilters();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/sales?${buildQuery(dataset, filters)}`)
      .then(setRecords)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset, filters.storeId, filters.year, filters.month]);

  const byStore = useMemo(() => aggregateByStore(records), [records]);
  const byMonth = useMemo(() => aggregateByMonth(records), [records]);
  const totals = useMemo(() => computeTotals(records), [records]);

  return (
    <div>
      <div className="card">
        <h2>Dashboard</h2>
        <FiltersBar />
      </div>

      {loading ? (
        <div className="card"><p className="text-muted">Loading…</p></div>
      ) : records.length === 0 ? (
        <div className="card empty-state">
          <p>No sales data matches these filters yet.</p>
          <p className="text-muted">Import a monthly file from the Import Data tab to get started.</p>
        </div>
      ) : (
        <>
          <div className="card">
            <h3>Totals</h3>
            <div className="stat-grid">
              <div className="stat-tile">
                <div className="label">Total Sales</div>
                <div className="value">{formatNumber(totals.totalSales)}</div>
              </div>
              <div className="stat-tile">
                <div className="label">Stores</div>
                <div className="value">{totals.storeCount}</div>
              </div>
              <div className="stat-tile">
                <div className="label">Records</div>
                <div className="value">{records.length}</div>
              </div>
              <div className="stat-tile">
                <div className="label">Avg Sales / Record</div>
                <div className="value">{formatNumber(totals.avgSales)}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Sales by Store</h3>
            <BreakdownBars rows={byStore} labelKey="name" />
          </div>

          <div className="card">
            <h3>Sales by Month</h3>
            <BreakdownBars rows={byMonth} labelKey="name" />
          </div>
        </>
      )}
    </div>
  );
}

function BreakdownBars({ rows }) {
  if (rows.length === 0) return <p className="text-muted">No data.</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <table>
      <thead><tr><th>Name</th><th>Sales</th><th style={{ width: '45%' }}></th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name}>
            <td>{r.name}</td>
            <td>{formatNumber(r.value)}</td>
            <td>
              <div style={{ background: '#eef3ff', borderRadius: 4, height: 10 }}>
                <div style={{ background: '#2f6fed', borderRadius: 4, height: 10, width: `${(r.value / max) * 100}%` }} />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function aggregateByStore(records) {
  const map = new Map();
  for (const r of records) {
    map.set(r.store_name, (map.get(r.store_name) || 0) + r.sales_amount);
  }
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function aggregateByMonth(records) {
  const map = new Map();
  for (const r of records) {
    const key = `${r.year}-${String(r.month).padStart(2, '0')}`;
    map.set(key, (map.get(key) || 0) + r.sales_amount);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => {
      const [year, month] = key.split('-');
      return { name: `${MONTHS[Number(month) - 1]} ${year}`, value };
    });
}

function computeTotals(records) {
  const totalSales = records.reduce((sum, r) => sum + r.sales_amount, 0);
  const storeCount = new Set(records.map((r) => r.store_id)).size;
  return {
    totalSales,
    storeCount,
    avgSales: records.length > 0 ? totalSales / records.length : 0,
  };
}
