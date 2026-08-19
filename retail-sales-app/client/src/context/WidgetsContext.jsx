import { createContext, useContext, useEffect, useState } from 'react';
import { useDataset } from './DatasetContext.jsx';
import { api } from '../lib/api.js';

const WidgetsContext = createContext(null);

export const WIDGET_LABELS = {
  totals: 'Totals summary',
  by_store: 'Sales by store',
  by_month: 'Sales by month',
  trend: 'Sales Trend tab',
  yoy_sales: 'YoY Comparison tab',
  yoy_drivers: 'Drivers Comparison tab',
  performance: 'Performance & Remarks',
};

export function WidgetsProvider({ children }) {
  const { dataset } = useDataset();
  const [widgets, setWidgets] = useState([]);
  const [loaded, setLoaded] = useState(false);

  function reload() {
    api.get(`/widgets?dataset=${dataset}`).then((rows) => {
      setWidgets(rows);
      setLoaded(true);
    });
  }

  useEffect(() => {
    setLoaded(false);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset]);

  function isVisible(key) {
    if (!loaded) return true;
    const w = widgets.find((x) => x.widget_key === key);
    return w ? !!w.visible : true;
  }

  async function setVisible(key, visible) {
    await api.patch(`/widgets/${key}`, { dataset, visible });
    setWidgets((prev) => prev.map((w) => (w.widget_key === key ? { ...w, visible: visible ? 1 : 0 } : w)));
  }

  return (
    <WidgetsContext.Provider value={{ widgets, loaded, isVisible, setVisible }}>
      {children}
    </WidgetsContext.Provider>
  );
}

export function useWidgets() {
  const ctx = useContext(WidgetsContext);
  if (!ctx) throw new Error('useWidgets must be used within WidgetsProvider');
  return ctx;
}
