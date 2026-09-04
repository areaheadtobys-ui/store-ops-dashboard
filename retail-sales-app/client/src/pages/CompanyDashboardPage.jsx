import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import KpiHeader from '../components/KpiHeader.jsx';
import { api } from '../lib/api.js';
import { formatNumber, formatPercent } from '../lib/format.js';

export default function CompanyDashboardPage() {
  const [period, setPeriod] = useState(null); // { year, month } once known
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ areaId: 'all' });
    if (period) {
      params.set('year', period.year);
      params.set('month', period.month);
    }
    api.get(`/company/dashboard?${params.toString()}`).then((res) => {
      setData(res);
      if (!period) setPeriod({ year: res.year, month: res.month });
    }).finally(() => setLoading(false));
  }, [period]);

  return (
    <div>
      <KpiHeader title="Company Sales Dashboard" data={data} loading={loading} onChangePeriod={setPeriod} />

      {!loading && data && (
        <div className="card">
          <div className="flex-between">
            <h3 style={{ margin: 0 }}>Area Performance</h3>
            <Link className="btn secondary" to="/area-performance">Open full comparison &rarr;</Link>
          </div>
          <table style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Area</th><th>MTD Sales</th><th>LY</th><th>Target</th>
                <th>% vs LY</th><th>% vs Target</th><th>Projected EOM</th>
              </tr>
            </thead>
            <tbody>
              {data.areaRows.map((r) => (
                <tr key={r.areaId}>
                  <td>{r.areaName}</td>
                  <td>{formatNumber(r.mtdSales)}</td>
                  <td>{formatNumber(r.ly)}</td>
                  <td>{formatNumber(r.target)}</td>
                  <td><Pct value={r.pctVsLy} /></td>
                  <td><Pct value={r.pctVsTarget} /></td>
                  <td>{formatNumber(r.projectedEom)}</td>
                </tr>
              ))}
              {data.totalRow && (
                <tr>
                  <td><strong>TOTAL</strong></td>
                  <td><strong>{formatNumber(data.totalRow.mtdSales)}</strong></td>
                  <td><strong>{formatNumber(data.totalRow.ly)}</strong></td>
                  <td><strong>{formatNumber(data.totalRow.target)}</strong></td>
                  <td><strong><Pct value={data.totalRow.pctVsLy} /></strong></td>
                  <td><strong><Pct value={data.totalRow.pctVsTarget} /></strong></td>
                  <td><strong>{formatNumber(data.totalRow.projectedEom)}</strong></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Pct({ value }) {
  if (value === null || value === undefined) return '—';
  return <span className={`pill ${value >= 0 ? 'good' : 'bad'}`}>{formatPercent(value)}</span>;
}
