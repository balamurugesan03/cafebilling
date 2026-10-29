import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal, AlertTriangle, Search, History, Boxes } from 'lucide-react';
import api, { toastErr } from '../api';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Modal, NeedBranch, Spinner, Empty, Field, StatCard } from '../components/ui';
import { money, dt } from '../utils/format';

const blank = { name: '', unit: 'g', stock: 0, minStock: 0, costPerUnit: 0, supplier: '' };
const UNITS = ['g', 'kg', 'ml', 'l', 'pcs', 'pack', 'box'];

export default function Inventory() {
  const { isAllBranches, branchId } = useAuth();
  const [items, setItems] = useState(null);
  const [logs, setLogs] = useState([]);
  const [tab, setTab] = useState('stock');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);
  const [adj, setAdj] = useState(null);

  const load = () =>
    Promise.all([api.get('/inventory'), api.get('/inventory/logs/all')])
      .then(([i, l]) => {
        setItems(i.data);
        setLogs(l.data);
      })
      .catch(toastErr);

  useEffect(() => {
    if (isAllBranches) return;
    setItems(null);
    load();
  }, [branchId, isAllBranches]);

  if (isAllBranches) return <NeedBranch what="inventory" />;
  if (!items) return <Spinner />;

  const low = items.filter((i) => i.stock <= i.minStock);
  const value = items.reduce((a, i) => a + Math.max(0, i.stock) * i.costPerUnit, 0);
  const shown = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  const save = async (e) => {
    e.preventDefault();
    try {
      const body = { ...form, stock: Number(form.stock), minStock: Number(form.minStock), costPerUnit: Number(form.costPerUnit) };
      if (form._id) await api.put(`/inventory/${form._id}`, body);
      else await api.post('/inventory', body);
      toast.success('Saved');
      setForm(null);
      load();
    } catch (err) {
      toastErr(err);
    }
  };

  const doAdjust = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/inventory/${adj.item._id}/adjust`, { type: adj.type, qty: Number(adj.qty), note: adj.note });
      toast.success('Stock updated');
      setAdj(null);
      load();
    } catch (err) {
      toastErr(err);
    }
  };

  const del = async (id) => {
    if (!confirm('Delete this inventory item?')) return;
    await api.delete(`/inventory/${id}`).catch(toastErr);
    load();
  };

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Raw materials, stock movement and low-stock alerts">
        <button className="btn-primary" onClick={() => setForm(blank)}>
          <Plus size={16} /> Add item
        </button>
      </PageHeader>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Items tracked" value={items.length} icon={Boxes} />
        <StatCard label="Low stock" value={low.length} icon={AlertTriangle} tone={low.length ? 'rose' : 'emerald'} />
        <StatCard label="Stock value" value={money(value)} icon={ArrowDownToLine} tone="amber" />
      </div>

      <div className="flex gap-1 mb-4 rounded-xl bg-white border border-stone-200 p-1 w-fit">
        {[
          ['stock', 'Stock'],
          ['logs', 'Movement log'],
        ].map(([k, l]) => (
          <button key={k} className={`btn btn-sm ${tab === k ? 'bg-espresso-800 text-white' : 'text-stone-600'}`} onClick={() => setTab(k)}>
            {k === 'logs' && <History size={14} />} {l}
          </button>
        ))}
      </div>

      {tab === 'stock' ? (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-stone-100 relative">
            <Search size={16} className="absolute left-7 top-1/2 -translate-y-1/2 text-stone-400" />
            <input className="input pl-9 max-w-sm" placeholder="Search items" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {shown.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Stock level</th>
                  <th className="text-right">Min</th>
                  <th className="text-right">Cost / unit</th>
                  <th>Supplier</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((i) => {
                  const pct = Math.min(100, (i.stock / Math.max(i.minStock * 3, 1)) * 100);
                  const isLow = i.stock <= i.minStock;
                  return (
                    <tr key={i._id}>
                      <td className="font-semibold">
                        {i.name} {isLow && <span className="badge bg-rose-50 text-rose-600 ml-1">LOW</span>}
                      </td>
                      <td className="w-64">
                        <div className="flex items-center gap-3">
                          <div className="h-2 flex-1 rounded-full bg-stone-100 overflow-hidden">
                            <div className={`h-full rounded-full ${isLow ? 'bg-rose-500' : pct < 60 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.max(pct, 2)}%` }} />
                          </div>
                          <span className="text-sm font-semibold whitespace-nowrap">
                            {Math.round(i.stock * 100) / 100} {i.unit}
                          </span>
                        </div>
                      </td>
                      <td className="text-right text-stone-500">
                        {i.minStock} {i.unit}
                      </td>
                      <td className="text-right">{money(i.costPerUnit)}</td>
                      <td className="text-stone-500">{i.supplier || '—'}</td>
                      <td className="text-right whitespace-nowrap">
                        <button className="btn-ghost btn-sm text-emerald-700" title="Stock in" onClick={() => setAdj({ item: i, type: 'in', qty: '', note: '' })}>
                          <ArrowDownToLine size={14} /> In
                        </button>
                        <button className="btn-ghost btn-sm text-rose-600" title="Stock out / wastage" onClick={() => setAdj({ item: i, type: 'out', qty: '', note: '' })}>
                          <ArrowUpFromLine size={14} /> Out
                        </button>
                        <button className="btn-ghost btn-sm" title="Set exact stock (audit)" onClick={() => setAdj({ item: i, type: 'adjust', qty: i.stock, note: 'Stock audit' })}>
                          <SlidersHorizontal size={14} />
                        </button>
                        <button className="btn-ghost btn-sm" onClick={() => setForm(i)}>
                          <Pencil size={14} />
                        </button>
                        <button className="btn-ghost btn-sm text-rose-600" onClick={() => del(i._id)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <Empty text="No inventory items" />
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          {logs.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Item</th>
                  <th>Type</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Balance</th>
                  <th>Note</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l._id}>
                    <td className="text-stone-500 whitespace-nowrap">{dt(l.createdAt)}</td>
                    <td className="font-medium">{l.item?.name}</td>
                    <td>
                      <span className={`badge ${l.qty >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>{l.type}</span>
                    </td>
                    <td className={`text-right font-semibold ${l.qty >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {l.qty > 0 ? '+' : ''}
                      {Math.round(l.qty * 100) / 100} {l.item?.unit}
                    </td>
                    <td className="text-right">{Math.round((l.balance || 0) * 100) / 100}</td>
                    <td className="text-stone-500">{l.note}</td>
                    <td>{l.user?.name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty text="No stock movement yet. Sales with recipes deduct stock automatically." />
          )}
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?._id ? 'Edit item' : 'New inventory item'} size="sm">
        {form && (
          <form onSubmit={save} className="space-y-4">
            <Field label="Name">
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Unit">
                <select className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                  {UNITS.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </Field>
              {!form._id && (
                <Field label="Opening stock">
                  <input className="input" type="number" step="0.01" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                </Field>
              )}
              <Field label="Min stock alert">
                <input className="input" type="number" step="0.01" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
              </Field>
              <Field label="Cost per unit">
                <input className="input" type="number" step="0.0001" value={form.costPerUnit} onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })} />
              </Field>
            </div>
            <Field label="Supplier">
              <input className="input" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
            </Field>
            <button className="btn-primary w-full">Save</button>
          </form>
        )}
      </Modal>

      <Modal open={!!adj} onClose={() => setAdj(null)} title={adj ? `${{ in: 'Stock in', out: 'Stock out / wastage', adjust: 'Set exact stock' }[adj.type]} — ${adj.item.name}` : ''} size="sm">
        {adj && (
          <form onSubmit={doAdjust} className="space-y-4">
            <p className="text-sm text-stone-500">
              Current: <b>{Math.round(adj.item.stock * 100) / 100} {adj.item.unit}</b>
            </p>
            <Field label={adj.type === 'adjust' ? `New stock (${adj.item.unit})` : `Quantity (${adj.item.unit})`}>
              <input autoFocus className="input" type="number" step="0.01" value={adj.qty} onChange={(e) => setAdj({ ...adj, qty: e.target.value })} required />
            </Field>
            <Field label="Note">
              <input className="input" placeholder={adj.type === 'in' ? 'Purchase bill no.' : 'Reason'} value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} />
            </Field>
            <button className="btn-primary w-full">Update stock</button>
          </form>
        )}
      </Modal>
    </div>
  );
}
