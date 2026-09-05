import { Routes, Route } from 'react-router-dom';
import AreaSwitcher from './components/AreaSwitcher.jsx';
import NavTabs from './components/NavTabs.jsx';
import { useArea } from './context/AreaContext.jsx';
import { useAuth, ROLE_LABELS } from './context/AuthContext.jsx';
import { FiltersProvider } from './context/FiltersContext.jsx';
import { WidgetsProvider } from './context/WidgetsContext.jsx';
import UploadPage from './pages/UploadPage.jsx';
import DailyEntryPage from './pages/DailyEntryPage.jsx';
import DashboardHome from './pages/DashboardHome.jsx';
import TrendPage from './pages/TrendPage.jsx';
import ComparisonPage from './pages/ComparisonPage.jsx';
import DriversComparisonPage from './pages/DriversComparisonPage.jsx';
import AreaPerformancePage from './pages/AreaPerformancePage.jsx';
import RankingsPage from './pages/RankingsPage.jsx';
import StoresPage from './pages/StoresPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import AreasPage from './pages/AreasPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

export default function App() {
  const { label } = useArea();
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <div className="top-bar">
        <div className="brand">Store Ops Dashboard</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <AreaSwitcher />
          <span className="text-muted" style={{ fontSize: 13 }}>
            {user?.name} &middot; {ROLE_LABELS[user?.role]}
          </span>
          <button className="btn secondary" onClick={logout}>Log out</button>
        </div>
      </div>
      <WidgetsProvider>
        <NavTabs />
        <p style={{ marginTop: -12, marginBottom: 20 }}>Viewing: <strong>{label}</strong></p>
        <FiltersProvider>
          <Routes>
            <Route path="/" element={<DashboardHome />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/daily-entry" element={<DailyEntryPage />} />
            <Route path="/trend" element={<TrendPage />} />
            <Route path="/comparison" element={<ComparisonPage />} />
            <Route path="/drivers" element={<DriversComparisonPage />} />
            <Route path="/area-performance" element={<AreaPerformancePage />} />
            <Route path="/rankings" element={<RankingsPage />} />
            <Route path="/stores" element={<StoresPage />} />
            {user?.role === 'super_admin' && <Route path="/users" element={<UsersPage />} />}
            {user?.role === 'super_admin' && <Route path="/areas" element={<AreasPage />} />}
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </FiltersProvider>
      </WidgetsProvider>
    </div>
  );
}
