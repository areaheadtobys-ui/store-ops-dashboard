import { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useArea } from './AreaContext.jsx';
import { useAuth } from './AuthContext.jsx';
import { api } from '../lib/api.js';

const FiltersContext = createContext(null);

// Cascading filter state used throughout the app: Year -> Month -> Area (via
// AreaContext, selected once at the top of the app) -> Store. Re-fetches the
// store/year options whenever the selected Area changes.
export function FiltersProvider({ children }) {
  const { areaId } = useArea();
  const { user } = useAuth();
  const location = useLocation();
  const [stores, setStores] = useState([]);
  const [years, setYears] = useState([]);
  const [storeId, setStoreIdState] = useState('all');
  const [year, setYear] = useState('all');
  const [month, setMonth] = useState('all');

  const lockedStoreId = user?.role === 'store_supervisor' ? String(user.store_id) : null;

  function setStoreId(next) {
    if (lockedStoreId) return; // Store Supervisors can't broaden their own scope
    setStoreIdState(next);
  }

  // Re-fetches on every navigation (not just when the area changes) so a
  // store/year added via an import or the Stores page shows up in the filter
  // dropdowns without requiring a full page reload. Keeps the current
  // selection if it's still valid, only resetting it if it no longer exists.
  useEffect(() => {
    if (!areaId) return;
    api.get(`/stores?areaId=${areaId}`).then((list) => {
      setStores(list);
      if (lockedStoreId) {
        setStoreIdState(lockedStoreId);
      } else {
        setStoreIdState((prev) => (prev === 'all' || list.some((s) => String(s.id) === String(prev)) ? prev : 'all'));
      }
    }).catch(() => setStores([]));

    api.get(`/sales/years?areaId=${areaId}`).then((ys) => {
      setYears(ys);
      setYear((prev) => (prev !== 'all' && ys.includes(Number(prev)) ? prev : (ys.length > 0 ? ys[0] : 'all')));
    }).catch(() => setYears([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaId, lockedStoreId, location.pathname]);

  return (
    <FiltersContext.Provider value={{ stores, years, storeId, setStoreId, year, setYear, month, setMonth, storeLocked: !!lockedStoreId }}>
      {children}
    </FiltersContext.Provider>
  );
}

export function useFilters() {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error('useFilters must be used within FiltersProvider');
  return ctx;
}

export function buildQuery(areaId, { storeId, year, month }) {
  const params = new URLSearchParams({ areaId: String(areaId) });
  if (storeId && storeId !== 'all') params.set('storeId', storeId);
  if (year && year !== 'all') params.set('year', year);
  if (month && month !== 'all') params.set('month', month);
  return params.toString();
}
