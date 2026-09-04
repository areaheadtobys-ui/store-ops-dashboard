import { useArea } from '../context/AreaContext.jsx';
import CompanyDashboardPage from './CompanyDashboardPage.jsx';
import DashboardPage from './DashboardPage.jsx';

// Role/Area-aware landing page (spec section 13): a Super Admin viewing "All
// Areas" gets the Company Sales Dashboard; selecting one Area (or being an
// Area/Store Supervisor, whose selection is locked) switches this same route
// to that Area's dashboard automatically.
export default function DashboardHome() {
  const { isCompanyView } = useArea();
  return isCompanyView ? <CompanyDashboardPage /> : <DashboardPage />;
}
