import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginGate({ children }) {
  const { status, loading } = useAuth();

  if (loading || !status) {
    return <div className="app-shell"><p className="text-muted" style={{ marginTop: 40 }}>Loading…</p></div>;
  }

  if (!status.passwordSet) return <SetupScreen />;
  if (!status.authenticated) return <LoginScreen />;
  return children;
}

function SetupScreen() {
  const { setupPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      await setupPassword(password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell" style={{ maxWidth: 420, paddingTop: 80 }}>
      <div className="card">
        <h2>Set a shared password</h2>
        <p className="text-muted">This app has no password yet. Set one now — anyone you share access with will use this same password to sign in.</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>New password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label>Confirm password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {error && <div className="banner error">{error}</div>}
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Setting…' : 'Set password and continue'}</button>
        </form>
      </div>
    </div>
  );
}

function LoginScreen() {
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell" style={{ maxWidth: 420, paddingTop: 80 }}>
      <div className="card">
        <h2>Sign in</h2>
        <p className="text-muted">Enter the shared password to access the Retail Sales Analysis app.</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          </div>
          {error && <div className="banner error">{error}</div>}
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </div>
  );
}
