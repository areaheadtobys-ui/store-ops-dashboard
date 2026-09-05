import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginGate({ children }) {
  const { status, loading } = useAuth();

  if (loading || !status) {
    return <div className="app-shell"><p className="text-muted" style={{ marginTop: 40 }}>Loading…</p></div>;
  }

  if (!status.hasUsers) return <SetupScreen />;
  if (!status.authenticated) return <AuthScreen signupEmailDomain={status.signupEmailDomain} />;
  if (status.user?.role === 'pending') return <PendingScreen />;
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

function AuthScreen({ signupEmailDomain }) {
  const [tab, setTab] = useState('signin');

  return (
    <div className="app-shell" style={{ maxWidth: 420, paddingTop: 80 }}>
      <div className="card">
        <h2>Store Ops Dashboard</h2>
        <p className="text-muted">Sign in, or create your own account to get started.</p>
        <div className="dataset-toggle" style={{ marginBottom: 20, width: '100%' }}>
          <button style={{ flex: 1 }} className={tab === 'signin' ? 'active' : ''} onClick={() => setTab('signin')}>Sign in</button>
          <button style={{ flex: 1 }} className={tab === 'signup' ? 'active' : ''} onClick={() => setTab('signup')}>Create account</button>
        </div>
        {tab === 'signin' ? <LoginForm /> : <SignupForm signupEmailDomain={signupEmailDomain} />}
      </div>
    </div>
  );
}

function LoginForm() {
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
  );
}

function SignupForm({ signupEmailDomain }) {
  const { signup } = useAuth();
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
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      await signup({ name: name.trim(), email: email.trim(), password });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label>Your name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="field">
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={signupEmailDomain ? `you@${signupEmailDomain}` : ''} />
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
      <button className="btn" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      <p className="text-muted" style={{ marginTop: 12, marginBottom: 0 }}>
        New accounts start unassigned (no access yet). A Super Admin gives you an Area or Store from the Users page
        {signupEmailDomain ? <> — only @{signupEmailDomain} addresses can sign up.</> : '.'}
      </p>
    </form>
  );
}

function PendingScreen() {
  const { user, logout } = useAuth();
  return (
    <div className="app-shell" style={{ maxWidth: 420, paddingTop: 80 }}>
      <div className="card">
        <h2>Account created</h2>
        <p className="text-muted">
          Hi {user?.name} — your account is set up but hasn't been assigned an Area or Store yet.
          Ask a Super Admin to assign you from the Users page. Once they do, refresh this page or sign in again.
        </p>
        <button className="btn secondary" onClick={logout}>Log out</button>
      </div>
    </div>
  );
}
