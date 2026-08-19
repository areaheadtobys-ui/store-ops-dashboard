import { useEffect, useMemo, useState } from 'react';
import { useDataset } from '../context/DatasetContext.jsx';
import { useFilters } from '../context/FiltersContext.jsx';
import { MONTHS } from './FiltersBar.jsx';
import { api } from '../lib/api.js';
import { formatNumber, formatPercent } from '../lib/format.js';

export default function PerformanceSection() {
  const { dataset } = useDataset();
  const { years } = useFilters();
  const [settings, setSettings] = useState(null);
  const [year, setYear] = useState(null);
  const [compareYear, setCompareYear] = useState(null);
  const [remarkMonth, setRemarkMonth] = useState(new Date().getMonth() + 1);
  const [perf, setPerf] = useState(null);
  const [remarks, setRemarks] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingStore, setSavingStore] = useState(null);

  useEffect(() => {
    api.get(`/performance/settings?dataset=${dataset}`).then(setSettings);
  }, [dataset]);

  useEffect(() => {
    if (years.length === 0) return;
    const sorted = [...years].sort((a, b) => a - b);
    setYear(sorted[sorted.length - 1]);
    setCompareYear(sorted.length > 1 ? sorted[sorted.length - 2] : '');
    setRemarkMonth((m) => m);
  }, [years]);

  useEffect(() => {
    if (!year) return;
    setLoading(true);
    const params = new URLSearchParams({ dataset, year });
    if (compareYear) params.set('compareYear', compareYear);
    api.get(`/performance?${params.toString()}`).then(setPerf).finally(() => setLoading(false));
  }, [dataset, year, compareYear]);

  useEffect(() => {
    if (!year || !remarkMonth) return;
    api.get(`/remarks?dataset=${dataset}&year=${year}&month=${remarkMonth}`).then((rows) => {
      const map = {};
      for (const r of rows) map[r.store_id] = r.text;
      setRemarks(map);
    });
  }, [dataset, year, remarkMonth]);

  async function updateSetting(patch) {
    const updated = await api.patch('/performance/settings', { dataset, ...patch });
    setSettings(updated);
  }

  async function saveRemark(storeId, text) {
    setSavingStore(storeId);
    try {
      await api.put('/remarks', { storeId, year, month: remarkMonth, text });
    } finally {
      setSavingStore(null);
    }
  }

  const rows = useMemo(() => perf?.results || [], [perf]);

  return (
    <div className="card">
      <div className="flex-between">
        <h3>Performance & Remarks</h3>
      </div>

      <div className="filter-bar">
        <div className="field">
          <label>Sales year</label>
          <select value={year ?? ''} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Rule</label>
          <select value={settings?.method || 'top_bottom_pct'} onChange={(e) => updateSetting({ method: e.target.value })}>
            <option value="top_bottom_pct">Top/bottom % by growth vs prior year</option>
            <option value="vs_target">Vs. target</option>
          </select>
        </div>
        {settings?.method !== 'vs_target' && (
          <div className="field">
            <label>Compare against year</label>
            <select value={compareYear ?? ''} onChange={(e) => setCompareYear(Number(e.target.value))}>
              {years.filter((y) => y !== year).map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
        <div className="field" style={{ minWidth: 100 }}>
          <label>Threshold %</label>
          <input
            type="number" min={1} max={50} value={settings?.pct_threshold ?? 20}
            onChange={(e) => updateSetting({ pct_threshold: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>Remark month</label>
          <select value={remarkMonth} onChange={(e) => setRemarkMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted">No stores with data for this year yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Store</th>
              <th>{year} Sales</th>
              <th>{settings?.method === 'vs_target' ? 'Vs. Target' : `Growth vs ${compareYear || '—'}`}</th>
              <th>Flag</th>
              <th style={{ width: '30%' }}>Remark for {MONTHS[remarkMonth - 1]} {year}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.storeId}>
                <td>{r.storeName}</td>
                <td>{formatNumber(r.sales)}</td>
                <td>{formatPercent(settings?.method === 'vs_target' ? r.vsTargetPct : r.growthPct)}</td>
                <td><FlagPill flag={r.flag} /></td>
                <td>
                  <RemarkInput
                    value={remarks[r.storeId] || ''}
                    saving={savingStore === r.storeId}
                    onChange={(text) => setRemarks((prev) => ({ ...prev, [r.storeId]: text }))}
                    onSave={(text) => saveRemark(r.storeId, text)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function FlagPill({ flag }) {
  if (flag === 'high') return <span className="pill good">High performer</span>;
  if (flag === 'low') return <span className="pill bad">Low performer</span>;
  if (flag === 'unknown') return <span className="pill neutral">No data</span>;
  return <span className="pill neutral">On track</span>;
}

function RemarkInput({ value, saving, onChange, onSave }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
      <textarea
        rows={1}
        value={local}
        placeholder="Add a remark…"
        onChange={(e) => { setLocal(e.target.value); onChange(e.target.value); }}
        onBlur={() => onSave(local)}
        style={{ minHeight: 34 }}
      />
      {saving && <span className="text-muted" style={{ fontSize: 12 }}>Saving…</span>}
    </div>
  );
}
