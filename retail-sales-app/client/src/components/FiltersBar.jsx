import { useFilters } from '../context/FiltersContext.jsx';
import { useArea } from '../context/AreaContext.jsx';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function FiltersBar({ showStore = true, showYear = true, showMonth = true }) {
  const { stores, years, storeId, setStoreId, year, setYear, month, setMonth, storeLocked } = useFilters();
  const { isCompanyView } = useArea();

  return (
    <div className="filter-bar">
      {showStore && !isCompanyView && (
        <div className="field">
          <label>Store</label>
          <select value={storeId} onChange={(e) => setStoreId(e.target.value)} disabled={storeLocked}>
            <option value="all">All stores</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}
      {showYear && (
        <div className="field">
          <label>Year</label>
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="all">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      )}
      {showMonth && (
        <div className="field">
          <label>Month</label>
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="all">All months</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

export { MONTHS };
