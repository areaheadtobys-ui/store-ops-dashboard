import { useEffect, useMemo, useState } from 'react';
import { useDataset } from '../context/DatasetContext.jsx';
import { useFilters } from '../context/FiltersContext.jsx';
import FiltersBar, { MONTHS } from '../components/FiltersBar.jsx';
import LineTrendChart from '../components/LineTrendChart.jsx';
import { api } from '../lib/api.js';
import { colorForIndex } from '../lib/chartColors.js';

export default function TrendPage() {
  const { dataset } = useDataset();
  const { storeId, year, stores } = useFilters();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ dataset });
    if (storeId !== 'all') params.set('storeId', storeId);
    if (year !== 'all') params.set('year', year);
    api.get(`/sales?${params.toString()}`).then(setRecords).finally(() => setLoading(false));
  }, [dataset, storeId, year]);

  const { categories, series } = useMemo(() => buildTrendSeries(records, storeId, stores), [records, storeId, stores]);

  return (
    <div>
      <div className="card">
        <h2>Sales Trend</h2>
        <p className="text-muted">Monthly sales over time. Use the store filter to focus on one store, or leave it on "All stores" to compare stores side by side.</p>
        <FiltersBar showMonth={false} />
      </div>

      <div className="card">
        {loading ? (
          <p className="text-muted">Loading…</p>
        ) : records.length === 0 ? (
          <div className="empty-state"><p>No sales data matches these filters yet.</p></div>
        ) : (
          <LineTrendChart categories={categories} series={series} />
        )}
      </div>
    </div>
  );
}

function buildTrendSeries(records, storeId, stores) {
  const byKey = new Map(); // 'YYYY-MM' -> { store_name -> total }
  const keySet = new Set();
  for (const r of records) {
    const key = `${r.year}-${String(r.month).padStart(2, '0')}`;
    keySet.add(key);
    if (!byKey.has(key)) byKey.set(key, new Map());
    const m = byKey.get(key);
    m.set(r.store_name, (m.get(r.store_name) || 0) + r.sales_amount);
  }
  const sortedKeys = [...keySet].sort();
  const categories = sortedKeys.map((k) => {
    const [y, m] = k.split('-');
    return `${MONTHS[Number(m) - 1].slice(0, 3)} ${y}`;
  });

  if (storeId !== 'all') {
    const store = stores.find((s) => String(s.id) === String(storeId));
    const values = sortedKeys.map((k) => byKey.get(k)?.get(store?.name) ?? null);
    return { categories, series: [{ name: store?.name || 'Store', color: colorForIndex(0), values }] };
  }

  const storeNames = [...new Set(records.map((r) => r.store_name))].sort();
  const series = storeNames.map((name, i) => ({
    name,
    color: colorForIndex(i),
    values: sortedKeys.map((k) => byKey.get(k)?.get(name) ?? null),
  }));
  return { categories, series };
}
