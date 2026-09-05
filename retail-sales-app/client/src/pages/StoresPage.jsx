import { useEffect, useState } from 'react';
import { useArea } from '../context/AreaContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

import { api } from '../lib/api.js';

export default function StoresPage() {
  const { areaId, areas, selectedArea, isCompanyView } = useArea();
  const { user } = useAuth();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newAreaId, setNewAreaId] = useState('');
  const [adding, setAdding] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  function load() {
    setLoading(true);
    api.get(`/stores?areaId=${areaId}&includeInactive=true`).then(setStores).finally(() => setLoading(false));
  }

  useEffect(load, [areaId]);
  useEffect(() => {
    if (!isCompanyView) setNewAreaId(String(selectedArea?.id || ''));
    else if (!newAreaId && areas.length > 0) setNewAreaId(String(areas[0].id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompanyView, selectedArea?.id, areas.length]);

  async function addStore(e) {
    e.preventDefault();
    if (!newName.trim() || !newAreaId) return;
    setError('');
    setAdding(true);
    try {
      await api.post('/stores', { areaId: Number(newAreaId), name: newName.trim(), code: newCode.trim() || null });
      setNewName('');
      setNewCode('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function toggleActive(store) {
    await api.patch(`/stores/${store.id}`, { is_active: store.is_active ? 0 : 1 });
    load();
  }

  async function removeStore(store) {
    if (!confirm(`Remove "${store.name}"? If it has sales history it will be deactivated instead of deleted.`)) return;
    await api.del(`/stores/${store.id}`);
    load();
  }

  async function bulkImport(e) {
    e.preventDefault();
    setBulkResult(null);
    const rows = bulkText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [areaCode, code, ...nameParts] = line.split(',');
        return { areaCode: (areaCode || '').trim(), code: (code || '').trim(), name: nameParts.join(',').trim() };
      });
    if (rows.length === 0) return;
    setBulkBusy(true);
    try {
      const result = await api.post('/stores/bulk-import', { rows });
      setBulkResult(result);
      setBulkText('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div>
      <div className="card">
        <h2>Stores</h2>
        <p className="text-muted">
          {isCompanyView
            ? 'All stores across every Area you have access to.'
            : <>Manage stores for <strong>{selectedArea?.area_name}</strong>.</>}
          {' '}Deactivate a store when it closes instead of deleting it, so its sales history is kept.
        </p>

        <form onSubmit={addStore} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
            <label>New store name</label>
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Riverside Mall" />
          </div>
          <div className="field" style={{ marginBottom: 0, minWidth: 140 }}>
            <label>Code (optional)</label>
            <input type="text" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="e.g. RVM01" />
          </div>
          {isCompanyView && (
            <div className="field" style={{ marginBottom: 0, minWidth: 160 }}>
              <label>Area</label>
              <select value={newAreaId} onChange={(e) => setNewAreaId(e.target.value)}>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.area_name}</option>)}
              </select>
            </div>
          )}
          <button className="btn" type="submit" disabled={adding || !newName.trim()}>Add store</button>
        </form>
        {error && <div className="banner error" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      {user?.role === 'super_admin' && isCompanyView && (
        <div className="card">
          <h3>Bulk import stores</h3>
          <p className="text-muted">
            Paste one store per line as <code>AREA,CODE,NAME</code> (area codes: {areas.map((a) => a.area_code).join(', ')}).
            Existing store codes are skipped, so it's safe to paste the same list again.
          </p>
          <form onSubmit={bulkImport}>
            <textarea
              rows={8}
              style={{ width: '100%', fontFamily: 'monospace' }}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={'CENTRAL,MEG,MEGAMALL\nNORTH,BAG,SM BAGUIO\nSOUTH,MOA,MALL OF ASIA'}
            />
            <button className="btn" type="submit" disabled={bulkBusy || !bulkText.trim()} style={{ marginTop: 10 }}>
              {bulkBusy ? 'Importing…' : 'Import'}
            </button>
          </form>
          {bulkResult && (
            <div className="banner" style={{ marginTop: 12 }}>
              Created {bulkResult.created}, skipped {bulkResult.skipped} (already existed).
              {bulkResult.errors.length > 0 && (
                <ul>
                  {bulkResult.errors.map((e, i) => <li key={i}>{e.reason}: {JSON.stringify(e.row)}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      <div className="card">
        {loading ? (
          <p className="text-muted">Loading…</p>
        ) : stores.length === 0 ? (
          <p className="text-muted">No stores yet. Add one above, or they'll be created automatically the first time you import a file that references them.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Code</th>{isCompanyView && <th>Area</th>}<th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.code || '—'}</td>
                  {isCompanyView && <td>{s.area_name}</td>}
                  <td>{s.is_active ? <span className="pill good">Active</span> : <span className="pill neutral">Inactive</span>}</td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="btn secondary" onClick={() => toggleActive(s)}>
                      {s.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                    <button className="btn danger" onClick={() => removeStore(s)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
