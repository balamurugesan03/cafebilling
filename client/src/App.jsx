import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import SuperDashboard from './pages/SuperDashboard';
import BranchDashboard from './pages/BranchDashboard';
import POS from './pages/POS';
import Orders from './pages/Orders';
import Kitchen from './pages/Kitchen';
import MenuPage from './pages/Menu';
import Inventory from './pages/Inventory';
import Tables from './pages/Tables';
import Customers from './pages/Customers';
import Expenses from './pages/Expenses';
import Reports from './pages/Reports';
import Staff from './pages/Staff';
import Branches from './pages/Branches';
import SettingsPage from './pages/Settings';

function Guard({ roles, children }) {
  const { user } = useAuth();
  if (!roles.includes(user.role)) return <Navigate to={user.role === 'kitchen' ? '/kitchen' : '/'} replace />;
  return children;
}

function Home() {
  const { user, isAllBranches } = useAuth();
  if (user.role === 'kitchen') return <Navigate to="/kitchen" replace />;
  return isAllBranches ? <SuperDashboard /> : <BranchDashboard />;
}

const ALL = ['superadmin', 'manager', 'cashier'];
const MGR = ['superadmin', 'manager'];

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner className="h-screen" />;
  if (!user)
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="pos" element={<Guard roles={ALL}><POS /></Guard>} />
        <Route path="orders" element={<Guard roles={ALL}><Orders /></Guard>} />
        <Route path="kitchen" element={<Guard roles={[...ALL, 'kitchen']}><Kitchen /></Guard>} />
        <Route path="menu" element={<Guard roles={MGR}><MenuPage /></Guard>} />
        <Route path="inventory" element={<Guard roles={MGR}><Inventory /></Guard>} />
        <Route path="tables" element={<Guard roles={ALL}><Tables /></Guard>} />
        <Route path="customers" element={<Guard roles={ALL}><Customers /></Guard>} />
        <Route path="expenses" element={<Guard roles={ALL}><Expenses /></Guard>} />
        <Route path="reports" element={<Guard roles={MGR}><Reports /></Guard>} />
        <Route path="staff" element={<Guard roles={MGR}><Staff /></Guard>} />
        <Route path="branches" element={<Guard roles={['superadmin']}><Branches /></Guard>} />
        <Route path="settings" element={<Guard roles={MGR}><SettingsPage /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
