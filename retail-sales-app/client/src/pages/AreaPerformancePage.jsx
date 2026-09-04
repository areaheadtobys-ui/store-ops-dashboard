import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { formatNumber, formatPercent } from '../lib/format.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const COLUMNS = [
  { key: 'mtdSales', label: 'MTD Sales', type: 'number' },
  { key: 'ly', label: 'LY MTD', type: 'number' },
  { key: 'target', label: 'Target', type: 'number' },
  { key: 'pctVsLy', label: '% vs LY', type: 'pct' },
  { key: 'pctVsTarget', label: '% vs Target', type: 'pct' },
  { key: 'projectedEom', label: 'Projected EOM', type: 'number' },
  { key: 'projectedPctAchievement', label: 'Projected Achievement %', type: 'pct' },
];

export default function AreaPerformancePage() {
  const [period, setPeriod] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState('mtdSales');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ areaId: 'all' });
    if (period) { params.set('year', period.year); params.set('month', period.month); }
    api.get(`/company/dashboard?${params.toString()}`).then((res) => {
      setData(res);
      if (!period) setPeriod({ year: res.year, month: res.month });
    }).finally(() => setLoading(false));
  }, [period]);

  const sortedRows = useMemo(() => {
    if (!data) return [];
    const rows = [...data.areaRows];
    rows.sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
    return rows;
  }, [data, sortKey, sortDir]);

  function toggleSort(key) {
    if (key === sortKey) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortKey(key); setSortDir('desc'); }
  }

  return (
    <div>
      <div className="card">
        <div className="flex-between">
          <div>
            <h2 style={{ margin: 0 }}>Area Performance</h2>
            <p className="text-muted">Compare Central, North, and South. Click a column to sort Highest → Lowest, click again for Lowest → Highest.</p>
          </div>
          {data && (
            <div style={{ display: 'flex', gap: 10 }}>
              <select style={{ width: 'auto', minWidth: 90 }} value={period?.year} onChange={(e) => setPeriod({ year: Number(e.target.value), month: period.month })}>
                {data.availableYears.length === 0 && <option value={period.year}>{period.year}</option>}
                {data.availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <select style={{ width: 'auto', minWidth: 130 }} value={period?.month} onChange={(e) => setPeriod({ year: period.year, month: Number(e.target.value) })}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        {loading || !data ? (
          <p className="text-muted">Loading…</p>
        ) : sortedRows.length === 0 ? (
          <p className="text-muted">No areas to compare.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <SortableTh label="Area" active={false} />
                {COLUMNS.map((c) => (
                  <SortableTh key={c.key} label={c.label} active={sortKey === c.key} dir={sortDir} onClick={() => toggleSort(c.key)} />
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => (
                <tr key={r.areaId}>
                  <td>{r.areaName}</td>
                  {COLUMNS.map((c) => (
                    <td key={c.key}>{c.type === 'pct' ? <Pct value={r[c.key]} /> : formatNumber(r[c.key])}</td>
                  ))}
                </tr>
              ))}
              {data.totalRow && (
                <tr>
                  <td><strong>TOTAL</strong></td>
                  {COLUMNS.map((c) => (
                    <td key={c.key}><strong>{c.type === 'pct' ? <Pct value={data.totalRow[c.key]} /> : formatNumber(data.totalRow[c.key])}</strong></td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SortableTh({ label, active, dir, onClick }) {
  return (
    <th onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default', color: active ? 'var(--accent)' : undefined }}>
      {label}{active && (dir === 'desc' ? ' ▼' : ' ▲')}
    </th>
  );
}

function Pct({ value }) {
  if (value === null || value === undefined) return '—';
  return <span className={`pill ${value >= 0 ? 'good' : 'bad'}`}>{formatPercent(value)}</span>;
}
