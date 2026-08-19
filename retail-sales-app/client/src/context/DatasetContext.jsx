import { createContext, useContext, useState } from 'react';

const DatasetContext = createContext(null);

const LABELS = {
  company: 'Company Owned Stores',
  franchise: 'Franchise Stores',
};

export function DatasetProvider({ children }) {
  const [dataset, setDataset] = useState(() => localStorage.getItem('rsa.dataset') || 'company');

  function selectDataset(next) {
    setDataset(next);
    localStorage.setItem('rsa.dataset', next);
  }

  return (
    <DatasetContext.Provider value={{ dataset, setDataset: selectDataset, label: LABELS[dataset] }}>
      {children}
    </DatasetContext.Provider>
  );
}

export function useDataset() {
  const ctx = useContext(DatasetContext);
  if (!ctx) throw new Error('useDataset must be used within DatasetProvider');
  return ctx;
}
