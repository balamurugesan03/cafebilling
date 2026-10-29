import { useEffect } from 'react';
import { X, Store, TrendingUp, TrendingDown, Loader2, Inbox } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Modal({ open, onClose, title, children, size = 'md', footer }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  const w = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/50 backdrop-blur-sm" onMouseDown={onClose}>
      <div className={`card w-full ${w} max-h-[92vh] flex flex-col animate-pop`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h3 className="text-lg font-bold text-espresso-900">{title}</h3>
          <button className="btn-ghost p-1.5 rounded-lg" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-stone-100 flex justify-end gap-2 bg-stone-50/60 rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-extrabold text-espresso-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-stone-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, tone = 'espresso', change, hint }) {
  const tones = {
    espresso: 'bg-espresso-100 text-espresso-700',
    amber: 'bg-amber-100 text-amber-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    sky: 'bg-sky-100 text-sky-700',
    rose: 'bg-rose-100 text-rose-700',
    violet: 'bg-violet-100 text-violet-700',
  };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">{label}</p>
          <p className="text-2xl font-extrabold text-espresso-950 mt-1.5 truncate">{value}</p>
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl ${tones[tone]}`}>
            <Icon size={20} />
          </div>
        )}
      </div>
      {(change !== undefined || hint) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {change !== undefined && (
            <span className={`badge ${change >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(change).toFixed(1)}%
            </span>
          )}
          {hint && <span className="text-stone-500">{hint}</span>}
        </div>
      )}
    </div>
  );
}

export function NeedBranch({ what = 'this page' }) {
  const { branches, setBranchId } = useAuth();
  return (
    <div className="card p-10 text-center max-w-2xl mx-auto mt-10">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-4">
        <Store size={26} />
      </div>
      <h2 className="text-xl font-bold text-espresso-900">Select a branch</h2>
      <p className="text-stone-500 mt-1 mb-6">Choose which branch you want to open {what} for.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {branches.map((b) => (
          <button key={b._id} onClick={() => setBranchId(b._id)} className="btn-outline justify-start py-3">
            <Store size={16} /> {b.name}
            <span className="ml-auto badge bg-stone-100 text-stone-600">{b.code}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export const Spinner = ({ className = '' }) => (
  <div className={`flex items-center justify-center py-16 text-espresso-600 ${className}`}>
    <Loader2 className="animate-spin" size={28} />
  </div>
);

export const Empty = ({ text = 'Nothing here yet', icon: Icon = Inbox }) => (
  <div className="flex flex-col items-center justify-center py-14 text-stone-400">
    <Icon size={36} strokeWidth={1.5} />
    <p className="mt-2 text-sm">{text}</p>
  </div>
);

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-3 cursor-pointer select-none">
      <span className={`relative w-10 h-6 rounded-full transition ${checked ? 'bg-emerald-500' : 'bg-stone-300'}`} onClick={() => onChange(!checked)}>
        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition ${checked ? 'translate-x-4' : ''}`} />
      </span>
      {label && <span className="text-sm text-stone-700">{label}</span>}
    </label>
  );
}

export function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

export const STATUS_BADGE = {
  completed: 'bg-emerald-50 text-emerald-700',
  held: 'bg-amber-50 text-amber-700',
  cancelled: 'bg-rose-50 text-rose-700',
  new: 'bg-sky-50 text-sky-700',
  preparing: 'bg-amber-50 text-amber-700',
  ready: 'bg-emerald-50 text-emerald-700',
  served: 'bg-stone-100 text-stone-600',
};
