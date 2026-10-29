import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, ReceiptText, ChefHat, Coffee, Boxes, Armchair, Users, Wallet,
  BarChart3, UserCog, Building2, Settings, LogOut, Menu, Store, ChevronDown, KeyRound, Globe2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Modal } from './ui';
import api, { toastErr } from '../api';

export const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['superadmin', 'manager', 'cashier'] },
  { to: '/pos', label: 'POS Billing', icon: ShoppingCart, roles: ['superadmin', 'manager', 'cashier'] },
  { to: '/orders', label: 'Orders', icon: ReceiptText, roles: ['superadmin', 'manager', 'cashier'] },
  { to: '/kitchen', label: 'Kitchen (KDS)', icon: ChefHat, roles: ['superadmin', 'manager', 'cashier', 'kitchen'] },
  { to: '/menu', label: 'Menu & Products', icon: Coffee, roles: ['superadmin', 'manager'] },
  { to: '/inventory', label: 'Inventory', icon: Boxes, roles: ['superadmin', 'manager'] },
  { to: '/tables', label: 'Tables', icon: Armchair, roles: ['superadmin', 'manager', 'cashier'] },
  { to: '/customers', label: 'Customers', icon: Users, roles: ['superadmin', 'manager', 'cashier'] },
  { to: '/expenses', label: 'Expenses', icon: Wallet, roles: ['superadmin', 'manager', 'cashier'] },
  { to: '/reports', label: 'Reports', icon: BarChart3, roles: ['superadmin', 'manager'] },
  { to: '/staff', label: 'Staff', icon: UserCog, roles: ['superadmin', 'manager'] },
  { to: '/branches', label: 'Branches', icon: Building2, roles: ['superadmin'] },
  { to: '/settings', label: 'Settings & Printer', icon: Settings, roles: ['superadmin', 'manager'] },
];

const ROLE_LABEL = { superadmin: 'Super Admin', manager: 'Branch Manager', cashier: 'Cashier', kitchen: 'Kitchen' };

function BranchSwitcher() {
  const { isSuper, branches, branchId, setBranchId, currentBranch, user } = useAuth();
  if (!isSuper)
    return (
      <div className="flex items-center gap-2 rounded-xl bg-espresso-100 text-espresso-800 px-3 py-2 text-sm font-semibold">
        <Store size={16} /> {user.branch?.name}
      </div>
    );
  return (
    <div className="relative">
      <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-espresso-700">
        {currentBranch ? <Store size={16} /> : <Globe2 size={16} />}
      </div>
      <select
        value={branchId}
        onChange={(e) => setBranchId(e.target.value)}
        className="appearance-none rounded-xl bg-espresso-100 text-espresso-900 font-semibold text-sm pl-9 pr-9 py-2 outline-none focus:ring-4 focus:ring-espresso-200 cursor-pointer"
      >
        <option value="all">All Branches (Head Office)</option>
        {branches.map((b) => (
          <option key={b._id} value={b._id}>
            {b.name} {b.active ? '' : '(inactive)'}
          </option>
        ))}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-espresso-700" />
    </div>
  );
}

function PasswordModal({ open, onClose }) {
  const [f, setF] = useState({ currentPassword: '', newPassword: '' });
  const save = async (e) => {
    e.preventDefault();
    try {
      await api.put('/auth/password', f);
      toast.success('Password changed');
      setF({ currentPassword: '', newPassword: '' });
      onClose();
    } catch (err) {
      toastErr(err);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Change password" size="sm">
      <form onSubmit={save} className="space-y-4">
        <input className="input" type="password" placeholder="Current password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} required />
        <input className="input" type="password" placeholder="New password (min 6)" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} required minLength={6} />
        <button className="btn-primary w-full">Update password</button>
      </form>
    </Modal>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState(false);
  const nav = useNavigate();
  const items = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 z-40 h-screen w-64 shrink-0 bg-espresso-950 text-espresso-100 flex flex-col transition-transform ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center gap-3 px-5 h-16 border-b border-white/5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-espresso-950">
            <Coffee size={20} strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-extrabold text-white leading-none tracking-tight">BrewBill</p>
            <p className="text-[10px] uppercase tracking-[.2em] text-espresso-300 mt-1">Café POS Suite</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-amber-500 text-espresso-950 shadow-lg shadow-amber-500/20' : 'text-espresso-200 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-espresso-700 flex items-center justify-center font-bold text-white">{user.name[0]}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">{user.name}</p>
              <p className="text-[11px] text-espresso-300">{ROLE_LABEL[user.role]}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button onClick={() => setPw(true)} className="btn btn-sm bg-white/5 text-espresso-100 hover:bg-white/10">
              <KeyRound size={14} /> Password
            </button>
            <button
              onClick={() => {
                logout();
                nav('/login');
              }}
              className="btn btn-sm bg-white/5 text-espresso-100 hover:bg-rose-600"
            >
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 h-16 bg-white/80 backdrop-blur border-b border-stone-200 flex items-center gap-3 px-4 lg:px-8">
          <button className="lg:hidden btn-ghost p-2" onClick={() => setOpen(true)}>
            <Menu size={20} />
          </button>
          <BranchSwitcher />
          <div className="ml-auto text-sm text-stone-500 hidden md:block">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
      <PasswordModal open={pw} onClose={() => setPw(false)} />
    </div>
  );
}
