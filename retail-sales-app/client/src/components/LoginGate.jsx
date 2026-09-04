import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginGate({ children }) {
  const { status, loading } = useAuth();

  if (loading || !status) {
    return <div className="app-shell"><p className="text-muted" style={{ marginTop: 40 }}>Loading…</p></div>;
  }

  if (!status.hasUsers) return <SetupScreen />;
  if (!status.authenticated) return <LoginScreen />;
  return children;
}

function SetupScreen() {
  const { setupSuperAdmin } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Name is required.');
    if (!email.trim()) return setError('Email is required.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      await setupSuperAdmin({ name: name.trim(), email: email.trim(), password });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell" style={{ maxWidth: 420, paddingTop: 80 }}>
      <div className="card">
        <h2>Create the Super Admin account</h2>
        <p className="text-muted">This app has no users yet. Set up the first account — it gets Super Admin access to every Area and Store. You'll create Area and Store Supervisor accounts afterwards from the Users page.</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Your name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="field">
            <label>Confirm password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {error && <div className="banner error">{error}</div>}
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Setting up…' : 'Create account and continue'}</button>
        </form>
      </div>
    </div>
  );
}

function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login({ email, password });
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
        <p className="text-muted">Enter your email and password to access the Store Ops Dashboard.</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <div className="banner error">{error}</div>}
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </div>
  );
}
