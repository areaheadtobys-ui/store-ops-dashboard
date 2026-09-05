import { useEffect, useState } from 'react';
import { useArea } from '../context/AreaContext.jsx';
import { useFilters } from '../context/FiltersContext.jsx';
import { MONTHS } from '../components/FiltersBar.jsx';
import { api } from '../lib/api.js';
import { formatNumber, formatPercent } from '../lib/format.js';

const now = new Date();

export default function DailyEntryPage() {
  const { isCompanyView } = useArea();
  const { stores, storeId, setStoreId, storeLocked } = useFilters();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [targetInput, setTargetInput] = useState('');
  const [savingTarget, setSavingTarget] = useState(false);
  const [savingDay, setSavingDay] = useState(null);
  const [error, setError] = useState('');

  const effectiveStoreId = storeId !== 'all' ? storeId : (stores[0]?.id ?? null);

  function load() {
    if (!effectiveStoreId) { setData(null); setLoading(false); return; }
    setLoading(true);
    setError('');
    api.get(`/sales/daily?storeId=${effectiveStoreId}&year=${year}&month=${month}`)
      .then((res) => { setData(res); setTargetInput(res.target ?? ''); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [effectiveStoreId, year, month]);

  async function saveDay(day, salesAmount) {
    if (salesAmount === '' || salesAmount === null) return;
    const amount = Number(salesAmount);
    if (!Number.isFinite(amount) || amount < 0) return;
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSavingDay(day);
    try {
      await api.put('/sales/daily', { storeId: effectiveStoreId, date, salesAmount: amount });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingDay(null);
    }
  }

  async function clearDay(day) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSavingDay(day);
    try {
      await api.del(`/sales/daily?storeId=${effectiveStoreId}&date=${date}`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingDay(null);
    }
  }

  async function saveTarget() {
    setSavingTarget(true);
    try {
      await api.put('/sales/daily/target', {
        storeId: effectiveStoreId, year, month,
        targetAmount: targetInput === '' ? null : Number(targetInput),
      });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingTarget(false);
    }
  }

  if (isCompanyView) {
    return (
      <div className="card">
        <h2>Daily Sales Entry</h2>
        <p className="text-muted">Select a single Area above to enter daily sales for one of its stores.</p>
      </div>
    );
  }

  const byDay = new Map((data?.days || []).map((d) => [d.day, d]));
  const mtdSales = (data?.days || []).reduce((sum, d) => sum + d.salesAmount, 0);
  const pctVsTarget = data?.target ? ((mtdSales - data.target) / data.target) * 100 : null;

  return (
    <div>
      <div className="card">
        <h2>Daily Sales Entry</h2>
        <p className="text-muted">Log each day's sales for a store. Importing a monthly file later will replace whatever's entered here for that store and month.</p>

        <div className="filter-bar">
          {!storeLocked && (
            <div className="field">
              <label>Store</label>
              <select value={effectiveStoreId ?? ''} onChange={(e) => setStoreId(e.target.value)}>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <div className="field">
            <label>Year</label>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Month</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Monthly target</label>
            <input
              type="number" min={0} value={targetInput} disabled={savingTarget}
              onChange={(e) => setTargetInput(e.target.value)}
              onBlur={saveTarget}
              placeholder="No target set"
            />
          </div>
        </div>

        {error && <div className="banner error">{error}</div>}
      </div>

      {!effectiveStoreId ? (
        <div className="card empty-state"><p>No store available. Add one from the Stores page first.</p></div>
      ) : loading ? (
        <div className="card"><p className="text-muted">Loading…</p></div>
      ) : !data ? (
        <div className="card empty-state"><p>Couldn't load daily entries for this store and period.</p></div>
      ) : (
        <>
          <div className="card">
            <div className="stat-grid">
              <div className="stat-tile">
                <div className="label">MTD Sales</div>
                <div className="value">{formatNumber(mtdSales)}</div>
              </div>
              <div className="stat-tile">
                <div className="label">Target</div>
                <div className="value">{data.target !== null ? formatNumber(data.target) : '—'}</div>
              </div>
              <div className="stat-tile">
                <div className="label">% vs Target</div>
                <div className="value">{pctVsTarget === null ? '—' : formatPercent(pctVsTarget)}</div>
              </div>
              <div className="stat-tile">
                <div className="label">Days Entered</div>
                <div className="value">{data.days.length} / {data.daysInMonth}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <table>
              <thead><tr><th style={{ width: 80 }}>Day</th><th>Sales Amount</th><th style={{ width: 100 }}></th></tr></thead>
              <tbody>
                {Array.from({ length: data.daysInMonth }, (_, i) => i + 1).map((day) => (
                  <DayRow
                    key={day}
                    day={day}
                    entry={byDay.get(day)}
                    saving={savingDay === day}
                    onSave={(amount) => saveDay(day, amount)}
                    onClear={() => clearDay(day)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function DayRow({ day, entry, saving, onSave, onClear }) {
  const [value, setValue] = useState(entry?.salesAmount ?? '');
  useEffect(() => setValue(entry?.salesAmount ?? ''), [entry?.salesAmount]);

  return (
    <tr>
      <td>{day}</td>
      <td>
        <input
          type="number" min={0} value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => { if (value !== '' && Number(value) !== entry?.salesAmount) onSave(value); }}
          placeholder="—"
        />
      </td>
      <td>
        {saving ? <span className="text-muted" style={{ fontSize: 12 }}>Saving…</span>
          : entry ? <button className="btn secondary" onClick={onClear}>Clear</button> : null}
      </td>
    </tr>
  );
}
