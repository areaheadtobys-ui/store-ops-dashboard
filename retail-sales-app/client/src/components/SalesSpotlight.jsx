import { useEffect, useState } from 'react';
import { useArea } from '../context/AreaContext.jsx';
import { useFilters } from '../context/FiltersContext.jsx';
import { MONTHS } from './FiltersBar.jsx';
import { api } from '../lib/api.js';
import { formatNumber, formatPercent } from '../lib/format.js';

export default function SalesSpotlight() {
  const { areaId } = useArea();
  const { years } = useFilters();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(null);
  const [monthFrom, setMonthFrom] = useState(1);
  const [monthTo, setMonthTo] = useState(12);
  const [mode, setMode] = useState('vs_target');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (years.length > 0 && (year === null || !years.includes(year))) setYear(years[0]);
  }, [years, year]);

  useEffect(() => {
    if (!open || !year || monthFrom > monthTo) return;
    setLoading(true);
    const params = new URLSearchParams({ areaId: String(areaId), year, mode, monthFrom, monthTo, limit: 10 });
    api.get(`/sales/top-performers?${params.toString()}`).then(setData).finally(() => setLoading(false));
  }, [open, areaId, year, mode, monthFrom, monthTo]);

  return (
    <div className="card">
      <button
        className="btn"
        onClick={() => setOpen((o) => !o)}
        style={{ fontSize: 15, padding: '10px 22px' }}
      >
        {open ? 'Hide Sales ▲' : 'Sales ▼'}
      </button>

      {open && (
        <div style={{ marginTop: 20 }}>
          <div className="filter-bar">
            <div className="field">
              <label>Year</label>
              <select value={year ?? ''} onChange={(e) => setYear(Number(e.target.value))}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="field">
              <label>From month</label>
              <select value={monthFrom} onChange={(e) => setMonthFrom(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="field">
              <label>To month</label>
              <select value={monthTo} onChange={(e) => setMonthTo(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Top 10 by</label>
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="vs_target">Vs. Target</option>
                <option value="vs_last_year">Vs. Last Year</option>
              </select>
            </div>
          </div>

          {monthFrom > monthTo ? (
            <div className="banner error">"From month" should come before "To month".</div>
          ) : loading ? (
            <p className="text-muted">Loading…</p>
          ) : !data || data.results.length === 0 ? (
            <p className="text-muted">No stores with data for this range yet{mode === 'vs_target' ? ' (make sure a Target Amount column was mapped when importing)' : ''}.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Store</th>
                  <th>Sales ({MONTHS[monthFrom - 1].slice(0, 3)}–{MONTHS[monthTo - 1].slice(0, 3)} {year})</th>
                  <th>{mode === 'vs_target' ? 'Target' : `Same period ${year - 1}`}</th>
                  <th>{mode === 'vs_target' ? 'Vs. Target' : 'Growth'}</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((r, i) => (
                  <tr key={r.storeId}>
                    <td>{i + 1}</td>
                    <td>{r.storeName}</td>
                    <td>{formatNumber(r.sales)}</td>
                    <td>{formatNumber(r.compareSales)}</td>
                    <td>
                      <span className={`pill ${r.comparePct >= 0 ? 'good' : 'bad'}`}>
                        {formatPercent(r.comparePct)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
