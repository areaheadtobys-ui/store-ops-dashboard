import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export default function AreasPage() {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);

  function load() {
    setLoading(true);
    api.get('/areas').then(setAreas).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function addArea(e) {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;
    setError('');
    setAdding(true);
    try {
      await api.post('/areas', { area_code: code.trim(), area_name: name.trim() });
      setCode('');
      setName('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function toggleStatus(area) {
    await api.patch(`/areas/${area.id}`, { status: area.status === 'active' ? 'inactive' : 'active' });
    load();
  }

  async function rename(area) {
    const next = prompt('New area name', area.area_name);
    if (!next || !next.trim()) return;
    await api.patch(`/areas/${area.id}`, { area_name: next.trim() });
    load();
  }

  return (
    <div>
      <div className="card">
        <h2>Areas</h2>
        <p className="text-muted">Areas are configurable master data — add a new one (e.g. VISAYAS, MINDANAO) any time, with no code changes required. Every store belongs to exactly one Area.</p>

        <form onSubmit={addArea} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ marginBottom: 0, minWidth: 140 }}>
            <label>Area code</label>
            <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. VISAYAS" />
          </div>
          <div className="field" style={{ marginBottom: 0, minWidth: 200 }}>
            <label>Area name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Visayas" />
          </div>
          <button className="btn" type="submit" disabled={adding}>Add area</button>
        </form>
        {error && <div className="banner error" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      <div className="card">
        {loading ? (
          <p className="text-muted">Loading…</p>
        ) : (
          <table>
            <thead>
              <tr><th>Code</th><th>Name</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {areas.map((a) => (
                <tr key={a.id}>
                  <td>{a.area_code}</td>
                  <td>{a.area_name}</td>
                  <td>{a.status === 'active' ? <span className="pill good">Active</span> : <span className="pill neutral">Inactive</span>}</td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="btn secondary" onClick={() => rename(a)}>Rename</button>
                    <button className="btn secondary" onClick={() => toggleStatus(a)}>
                      {a.status === 'active' ? 'Deactivate' : 'Reactivate'}
                    </button>
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
