import { NavLink } from 'react-router-dom';
import { useWidgets } from '../context/WidgetsContext.jsx';

const TABS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/upload', label: 'Import Data' },
  { to: '/trend', label: 'Sales Trend', widgetKey: 'trend' },
  { to: '/comparison', label: 'YoY Comparison', widgetKey: 'yoy_sales' },
  { to: '/drivers', label: 'Drivers Comparison', widgetKey: 'yoy_drivers' },
  { to: '/stores', label: 'Stores' },
  { to: '/settings', label: 'Settings' },
];

export default function NavTabs() {
  const { isVisible } = useWidgets();
  const visibleTabs = TABS.filter((tab) => !tab.widgetKey || isVisible(tab.widgetKey));

  return (
    <nav className="nav-tabs">
      {visibleTabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => (isActive ? 'active' : '')}>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
