import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { ROLE_LABELS } from '../context/AuthContext.jsx';

const ROLES = ['super_admin', 'area_supervisor', 'store_supervisor'];

function PendingUserRow({ user, areas, stores, onAssign, onRemove }) {
  const [role, setRole] = useState('store_supervisor');
  const [areaId, setAreaId] = useState('');
  const [storeId, setStoreId] = useState('');
  const [busy, setBusy] = useState(false);

  async function assign() {
    if (role === 'area_supervisor' && !areaId) return;
    if (role === 'store_supervisor' && !storeId) return;
    setBusy(true);
    try {
      await onAssign({ role, area_id: role === 'area_supervisor' ? Number(areaId) : undefined, store_id: role === 'store_supervisor' ? Number(storeId) : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td>{user.name}</td>
      <td>{user.email}</td>
      <td colSpan={2}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="pill neutral">Pending — signed up, awaiting assignment</span>
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: 'auto' }}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          {role === 'area_supervisor' && (
            <select value={areaId} onChange={(e) => setAreaId(e.target.value)} style={{ width: 'auto' }}>
              <option value="">Select area…</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.area_name}</option>)}
            </select>
          )}
          {role === 'store_supervisor' && (
            <select value={storeId} onChange={(e) => setStoreId(e.target.value)} style={{ width: 'auto' }}>
              <option value="">Select store…</option>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.area_name})</option>)}
            </select>
          )}
          <button className="btn" onClick={assign} disabled={busy}>Assign</button>
        </div>
      </td>
      <td></td>
      <td><button className="btn danger" onClick={onRemove}>Remove</button></td>
    </tr>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [areas, setAreas] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'store_supervisor', area_id: '', store_id: '' });
  const [adding, setAdding] = useState(false);

  function loadUsers() {
    setLoading(true);
    api.get('/users').then(setUsers).finally(() => setLoading(false));
  }

  useEffect(() => {
    loadUsers();
    api.get('/areas').then(setAreas);
    api.get('/stores?areaId=all&includeInactive=true').then(setStores);
  }, []);

  async function addUser(e) {
    e.preventDefault();
    setError('');
    setAdding(true);
    try {
      const payload = { name: form.name, email: form.email, password: form.password, role: form.role };
      if (form.role === 'area_supervisor') payload.area_id = Number(form.area_id);
      if (form.role === 'store_supervisor') payload.store_id = Number(form.store_id);
      await api.post('/users', payload);
      setForm({ name: '', email: '', password: '', role: 'store_supervisor', area_id: '', store_id: '' });
      loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function updateUser(user, patch) {
    try {
      await api.patch(`/users/${user.id}`, patch);
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeUser(user) {
    if (!confirm(`Remove ${user.name}'s account?`)) return;
    try {
      await api.del(`/users/${user.id}`);
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="card">
        <h2>Users</h2>
        <p className="text-muted">Create accounts and assign each person a role and scope. Area Supervisors see only their Area's stores; Store Supervisors see only their one store.</p>

        <form onSubmit={addUser} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ marginBottom: 0, minWidth: 160 }}>
            <label>Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="field" style={{ marginBottom: 0, minWidth: 200 }}>
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="field" style={{ marginBottom: 0, minWidth: 160 }}>
            <label>Password</label>
            <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          </div>
          <div className="field" style={{ marginBottom: 0, minWidth: 170 }}>
            <label>Role</label>
            <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          {form.role === 'area_supervisor' && (
            <div className="field" style={{ marginBottom: 0, minWidth: 150 }}>
              <label>Area</label>
              <select value={form.area_id} onChange={(e) => setForm((f) => ({ ...f, area_id: e.target.value }))}>
                <option value="">Select area…</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.area_name}</option>)}
              </select>
            </div>
          )}
          {form.role === 'store_supervisor' && (
            <div className="field" style={{ marginBottom: 0, minWidth: 180 }}>
              <label>Store</label>
              <select value={form.store_id} onChange={(e) => setForm((f) => ({ ...f, store_id: e.target.value }))}>
                <option value="">Select store…</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.area_name})</option>)}
              </select>
            </div>
          )}
          <button className="btn" type="submit" disabled={adding}>Add user</button>
        </form>
        {error && <div className="banner error" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      <div className="card">
        {loading ? (
          <p className="text-muted">Loading…</p>
        ) : (
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Scope</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                u.role === 'pending'
                  ? <PendingUserRow key={u.id} user={u} areas={areas} stores={stores} onAssign={(patch) => updateUser(u, patch)} onRemove={() => removeUser(u)} />
                  : (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>{ROLE_LABELS[u.role]}</td>
                      <td>{u.role === 'super_admin' ? 'Everything' : u.role === 'area_supervisor' ? u.area_name : u.store_name}</td>
                      <td>{u.status === 'active' ? <span className="pill good">Active</span> : <span className="pill neutral">Inactive</span>}</td>
                      <td style={{ display: 'flex', gap: 8 }}>
                        <button className="btn secondary" onClick={() => updateUser(u, { status: u.status === 'active' ? 'inactive' : 'active' })}>
                          {u.status === 'active' ? 'Deactivate' : 'Reactivate'}
                        </button>
                        <button className="btn danger" onClick={() => removeUser(u)}>Remove</button>
                      </td>
                    </tr>
                  )
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
