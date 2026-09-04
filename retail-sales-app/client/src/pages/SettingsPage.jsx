import { useState } from 'react';
import { useWidgets, WIDGET_LABELS } from '../context/WidgetsContext.jsx';
import { useArea } from '../context/AreaContext.jsx';
import { api } from '../lib/api.js';

const ORDER = ['totals', 'by_store', 'by_month', 'trend', 'yoy_sales', 'yoy_drivers', 'performance'];

export default function SettingsPage() {
  const { widgets, loaded, setVisible } = useWidgets();
  const { isCompanyView, selectedArea } = useArea();

  return (
    <div>
      <div className="card">
        <h2>Dashboard sections</h2>
        {isCompanyView ? (
          <p className="text-muted">Select a single Area above to show or hide its dashboard sections and tabs. The Company Dashboard has a fixed layout.</p>
        ) : (
          <>
            <p className="text-muted">Show or hide sections and tabs for <strong>{selectedArea?.area_name}</strong>. Turn off anything you don't need this month — you can always turn it back on.</p>
            {!loaded ? (
              <p className="text-muted">Loading…</p>
            ) : (
              <table>
                <tbody>
                  {ORDER.map((key) => {
                    const w = widgets.find((x) => x.widget_key === key);
                    const checked = w ? !!w.visible : true;
                    return (
                      <tr key={key}>
                        <td style={{ width: 40 }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => setVisible(key, e.target.checked)}
                            style={{ width: 18, height: 18 }}
                          />
                        </td>
                        <td>{WIDGET_LABELS[key]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      <ChangePasswordCard />
    </div>
  );
}

function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword.length < 6) return setError('New password must be at least 6 characters.');
    if (newPassword !== confirm) return setError('New passwords do not match.');
    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setSuccess('Password changed.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Your password</h2>
      <p className="text-muted">Change the password for your own account.</p>
      <form onSubmit={handleSubmit} style={{ maxWidth: 320 }}>
        <div className="field">
          <label>Current password</label>
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
        <div className="field">
          <label>New password</label>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <div className="field">
          <label>Confirm new password</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {error && <div className="banner error">{error}</div>}
        {success && <div className="banner success">{success}</div>}
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Changing…' : 'Change password'}</button>
      </form>
    </div>
  );
}
