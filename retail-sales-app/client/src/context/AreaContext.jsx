import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { api } from '../lib/api.js';

const AreaContext = createContext(null);

// Top-of-app Area selection — CENTRAL / NORTH / SOUTH (and any more added
// later) plus, for a Super Admin only, an "ALL" company-wide view. Locked to
// a single area for Area and Store Supervisors, per their assignment, so
// they never need to manually pick it (spec section 13).
export function AreaProvider({ children }) {
  const { user } = useAuth();
  const [areas, setAreas] = useState([]);
  const [areaId, setAreaIdState] = useState('all');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      setAreas([]);
      setLoaded(false);
      return;
    }
    api.get('/areas').then((list) => {
      setAreas(list);
      setLoaded(true);
      if (user.role === 'super_admin') {
        const saved = localStorage.getItem(`rsa.areaId.${user.id}`);
        const stillValid = saved === 'all' || list.some((a) => String(a.id) === saved);
        setAreaIdState(stillValid ? saved : 'all');
      } else {
        setAreaIdState(String(user.area_id));
      }
    }).catch(() => setLoaded(true));
  }, [user?.id, user?.role, user?.area_id]);

  function setAreaId(next) {
    if (user?.role !== 'super_admin') return; // locked for supervisors
    setAreaIdState(next);
    localStorage.setItem(`rsa.areaId.${user.id}`, next);
  }

  const selectedArea = useMemo(
    () => (areaId === 'all' ? null : areas.find((a) => String(a.id) === String(areaId)) || null),
    [areas, areaId],
  );

  const value = {
    areas,
    loaded,
    areaId, // 'all' | string(number)
    setAreaId,
    selectedArea, // full area row, or null when areaId === 'all'
    isCompanyView: areaId === 'all',
    canSwitchArea: user?.role === 'super_admin',
    label: areaId === 'all' ? 'Company (All Areas)' : (selectedArea?.area_name || '…'),
  };

  return <AreaContext.Provider value={value}>{children}</AreaContext.Provider>;
}

export function useArea() {
  const ctx = useContext(AreaContext);
  if (!ctx) throw new Error('useArea must be used within AreaProvider');
  return ctx;
}
