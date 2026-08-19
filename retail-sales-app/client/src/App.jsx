import { Routes, Route } from 'react-router-dom';
import DatasetToggle from './components/DatasetToggle.jsx';
import NavTabs from './components/NavTabs.jsx';
import { useDataset } from './context/DatasetContext.jsx';
import { FiltersProvider } from './context/FiltersContext.jsx';
import UploadPage from './pages/UploadPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import TrendPage from './pages/TrendPage.jsx';
import ComparisonPage from './pages/ComparisonPage.jsx';
import DriversComparisonPage from './pages/DriversComparisonPage.jsx';
import StoresPage from './pages/StoresPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

export default function App() {
  const { label } = useDataset();

  return (
    <div className="app-shell">
      <div className="top-bar">
        <div className="brand">Retail Sales Analysis</div>
        <DatasetToggle />
      </div>
      <NavTabs />
      <p style={{ marginTop: -12, marginBottom: 20 }}>Viewing: <strong>{label}</strong></p>
      <FiltersProvider>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/trend" element={<TrendPage />} />
          <Route path="/comparison" element={<ComparisonPage />} />
          <Route path="/drivers" element={<DriversComparisonPage />} />
          <Route path="/stores" element={<StoresPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </FiltersProvider>
    </div>
  );
}
