import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = useState(null); // { passwordSet, authenticated }
  const [loading, setLoading] = useState(true);

  function refresh() {
    return api.get('/auth/status').then(setStatus).finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function setupPassword(password) {
    await api.post('/auth/setup', { password });
    await refresh();
  }

  async function login(password) {
    await api.post('/auth/login', { password });
    await refresh();
  }

  async function logout() {
    await api.post('/auth/logout', {});
    await refresh();
  }

  return (
    <AuthContext.Provider value={{ status, loading, setupPassword, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
