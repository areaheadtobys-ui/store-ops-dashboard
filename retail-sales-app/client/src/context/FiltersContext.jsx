import { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useDataset } from './DatasetContext.jsx';
import { api } from '../lib/api.js';

const FiltersContext = createContext(null);

export function FiltersProvider({ children }) {
  const { dataset } = useDataset();
  const location = useLocation();
  const [stores, setStores] = useState([]);
  const [years, setYears] = useState([]);
  const [storeId, setStoreId] = useState('all');
  const [year, setYear] = useState('all');
  const [month, setMonth] = useState('all');

  // Re-fetches on every navigation (not just when the dataset changes) so a
  // store/year added via an import or the Stores page shows up in the filter
  // dropdowns without requiring a full page reload. Keeps the current
  // selection if it's still valid, only resetting it if it no longer exists.
  useEffect(() => {
    api.get(`/stores?dataset=${dataset}`).then((list) => {
      setStores(list);
      setStoreId((prev) => (prev === 'all' || list.some((s) => String(s.id) === String(prev)) ? prev : 'all'));
    }).catch(() => setStores([]));

    api.get(`/sales/years?dataset=${dataset}`).then((ys) => {
      setYears(ys);
      setYear((prev) => (prev !== 'all' && ys.includes(Number(prev)) ? prev : (ys.length > 0 ? ys[0] : 'all')));
    }).catch(() => setYears([]));
  }, [dataset, location.pathname]);

  return (
    <FiltersContext.Provider value={{ stores, years, storeId, setStoreId, year, setYear, month, setMonth }}>
      {children}
    </FiltersContext.Provider>
  );
}

export function useFilters() {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error('useFilters must be used within FiltersProvider');
  return ctx;
}

export function buildQuery(dataset, { storeId, year, month }) {
  const params = new URLSearchParams({ dataset });
  if (storeId && storeId !== 'all') params.set('storeId', storeId);
  if (year && year !== 'all') params.set('year', year);
  if (month && month !== 'all') params.set('month', month);
  return params.toString();
}
