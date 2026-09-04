import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = useState(null); // { hasUsers, authenticated, user }
  const [loading, setLoading] = useState(true);

  function refresh() {
    return api.get('/auth/status').then(setStatus).finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function setupSuperAdmin({ name, email, password }) {
    await api.post('/auth/setup', { name, email, password });
    await refresh();
  }

  async function login({ email, password }) {
    await api.post('/auth/login', { email, password });
    await refresh();
  }

  async function logout() {
    await api.post('/auth/logout', {});
    await refresh();
  }

  return (
    <AuthContext.Provider value={{ status, user: status?.user || null, loading, setupSuperAdmin, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  area_supervisor: 'Area Supervisor',
  store_supervisor: 'Store Supervisor',
};
