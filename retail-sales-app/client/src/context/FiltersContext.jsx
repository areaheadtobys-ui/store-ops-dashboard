import { createContext, useContext, useEffect, useState } from 'react';
import { useDataset } from './DatasetContext.jsx';
import { api } from '../lib/api.js';

const FiltersContext = createContext(null);

export function FiltersProvider({ children }) {
  const { dataset } = useDataset();
  const [stores, setStores] = useState([]);
  const [years, setYears] = useState([]);
  const [storeId, setStoreId] = useState('all');
  const [year, setYear] = useState('all');
  const [month, setMonth] = useState('all');

  useEffect(() => {
    setStoreId('all');
    setMonth('all');
    api.get(`/stores?dataset=${dataset}`).then(setStores).catch(() => setStores([]));
    api.get(`/sales/years?dataset=${dataset}`).then((ys) => {
      setYears(ys);
      setYear(ys.length > 0 ? ys[0] : 'all');
    }).catch(() => setYears([]));
  }, [dataset]);

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
