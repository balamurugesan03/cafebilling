import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coffee, Loader2, Lock, Mail, BarChart3, Printer, Store } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toastErr } from '../api';

const DEMO = [
  ['Super Admin', 'admin@brewbill.com', 'admin123'],
  ['Manager', 'manager.ann@brewbill.com', '123456'],
  ['Cashier', 'cashier.ann@brewbill.com', '123456'],
  ['Kitchen', 'kitchen.ann@brewbill.com', '123456'],
];

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await login(f.email, f.password);
      nav(u.role === 'kitchen' ? '/kitchen' : u.role === 'cashier' ? '/pos' : '/');
    } catch (err) {
      toastErr(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex relative overflow-hidden bg-espresso-950 text-white p-12 flex-col justify-between">
        <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-amber-500/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-20 w-[30rem] h-[30rem] rounded-full bg-espresso-600/30 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-espresso-950">
            <Coffee size={24} strokeWidth={2.5} />
          </div>
          <span className="text-2xl font-extrabold tracking-tight">BrewBill</span>
        </div>
        <div className="relative">
          <h1 className="text-5xl font-extrabold leading-tight tracking-tight">
            Billing that moves
            <br />
            <span className="text-amber-400">as fast as your baristas.</span>
          </h1>
          <p className="mt-5 text-espresso-200 max-w-md">Multi-branch café POS with live dashboards, kitchen display, inventory, loyalty and thermal printing.</p>
          <div className="mt-10 grid grid-cols-3 gap-4 max-w-lg">
            {[
              [Store, 'Multi-branch'],
              [BarChart3, 'Live analytics'],
              [Printer, 'Thermal print'],
            ].map(([Icon, t]) => (
              <div key={t} className="rounded-2xl bg-white/5 border border-white/10 p-4">
                <Icon className="text-amber-400" size={22} />
                <p className="mt-2 text-sm font-semibold">{t}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-espresso-400">© {new Date().getFullYear()} BrewBill POS</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Coffee className="text-espresso-700" /> <span className="text-xl font-extrabold">BrewBill</span>
          </div>
          <h2 className="text-3xl font-extrabold text-espresso-950 tracking-tight">Welcome back</h2>
          <p className="text-stone-500 mt-1 mb-8">Sign in to your branch or head-office account.</p>
          <form onSubmit={submit} className="space-y-4">
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input className="input pl-10 py-3" type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required autoFocus />
            </div>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input className="input pl-10 py-3" type="password" placeholder="Password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
            </div>
            <button className="btn-primary w-full py-3 text-base" disabled={busy}>
              {busy && <Loader2 className="animate-spin" size={18} />} Sign in
            </button>
          </form>

          <div className="mt-8">
            <p className="label">Demo accounts (after running seed)</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO.map(([r, e, p]) => (
                <button key={r} type="button" onClick={() => setF({ email: e, password: p })} className="btn-outline btn-sm justify-start">
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
