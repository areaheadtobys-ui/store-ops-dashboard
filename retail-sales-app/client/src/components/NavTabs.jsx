import { NavLink } from 'react-router-dom';
import { useWidgets } from '../context/WidgetsContext.jsx';
import { useArea } from '../context/AreaContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function NavTabs() {
  const { isVisible } = useWidgets();
  const { isCompanyView } = useArea();
  const { user } = useAuth();

  const tabs = [
    { to: '/', label: isCompanyView ? 'Company Dashboard' : 'Dashboard', end: true },
    !isCompanyView && { to: '/upload', label: 'Import Data' },
    !isCompanyView && { to: '/trend', label: 'Sales Trend', widgetKey: 'trend' },
    !isCompanyView && { to: '/comparison', label: 'YoY Comparison', widgetKey: 'yoy_sales' },
    !isCompanyView && { to: '/drivers', label: 'Drivers Comparison', widgetKey: 'yoy_drivers' },
    { to: '/area-performance', label: 'Area Performance' },
    { to: '/rankings', label: 'Top & Bottom Performers' },
    { to: '/stores', label: 'Stores' },
    user?.role === 'super_admin' && { to: '/users', label: 'Users' },
    user?.role === 'super_admin' && { to: '/areas', label: 'Areas' },
    { to: '/settings', label: 'Settings' },
  ].filter(Boolean).filter((tab) => !tab.widgetKey || isVisible(tab.widgetKey));

  return (
    <nav className="nav-tabs">
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => (isActive ? 'active' : '')}>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
