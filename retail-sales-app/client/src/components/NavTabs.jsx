import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/upload', label: 'Import Data' },
  { to: '/trend', label: 'Sales Trend' },
  { to: '/comparison', label: 'YoY Comparison' },
  { to: '/drivers', label: 'Drivers Comparison' },
  { to: '/stores', label: 'Stores' },
  { to: '/settings', label: 'Settings' },
];

export default function NavTabs() {
  return (
    <nav className="nav-tabs">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => (isActive ? 'active' : '')}>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
