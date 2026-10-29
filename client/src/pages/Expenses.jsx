import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Download, Wallet } from 'lucide-react';
import api, { toastErr } from '../api';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Modal, Spinner, Empty, Field, StatCard } from '../components/ui';
import { money, dateOnly, ymd, daysAgo, downloadCSV } from '../utils/format';

const blank = () => ({ category: 'Supplies', amount: '', note: '', paymentMethod: 'cash', date: ymd() });

export default function Expenses() {
  const { branchId, isAllBranches, can } = useAuth();
  const [list, setList] = useState(null);
  const [cats, setCats] = useState([]);
  const [range, setRange] = useState({ from: daysAgo(29), to: ymd() });
  const [form, setForm] = useState(null);

  const load = () =>
    api
      .get('/expenses', { params: range })
      .then((r) => setList(r.data))
      .catch(toastErr);

  useEffect(() => {
    api.get('/expenses/meta/categories').then((r) => setCats(r.data));
  }, []);
  useEffect(() => {
    setList(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, range]);

  const save = async (e) => {
    e.preventDefault();
    try {
      const body = { ...form, amount: Number(form.amount), date: new Date(`${form.date}T12:00:00`) };
      if (form._id) await api.put(`/expenses/${form._id}`, body);
      else await api.post('/expenses', body);
      toast.success('Expense saved');
      setForm(null);
      load();
    } catch (err) {
      toastErr(err);
    }
  };

  const del = async (id) => {
    if (!confirm('Delete expense?')) return;
    await api.delete(`/expenses/${id}`).catch(toastErr);
    load();
  };

  const total = (list || []).reduce((a, e) => a + e.amount, 0);
  const byCat = Object.entries((list || []).reduce((m, e) => ({ ...m, [e.category]: (m[e.category] || 0) + e.amount }), {})).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <PageHeader title="Expenses" subtitle={isAllBranches ? 'All branches' : 'Track daily spending'}>
        <input type="date" className="input w-40" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        <input type="date" className="input w-40" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        <button
          className="btn-outline"
          onClick={() =>
            downloadCSV(
              'expenses.csv',
              (list || []).map((e) => ({ Date: dateOnly(e.date), Branch: e.branch?.name, Category: e.category, Amount: e.amount, Method: e.paymentMethod, Note: e.note, By: e.user?.name }))
            )
          }
        >
          <Download size={16} />
        </button>
        {!isAllBranches && (
          <button className="btn-primary" onClick={() => setForm(blank())}>
            <Plus size={16} /> Add expense
          </button>
        )}
      </PageHeader>

      <div className="grid lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total in period" value={money(total)} icon={Wallet} tone="rose" />
        <div className="card p-5 lg:col-span-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3">By category</p>
          <div className="flex flex-wrap gap-2">
            {byCat.map(([c, v]) => (
              <span key={c} className="badge bg-stone-100 text-stone-700 text-xs px-3 py-1">
                {c}: <b>{money(v)}</b>
              </span>
            ))}
            {!byCat.length && <span className="text-sm text-stone-400">No expenses</span>}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {!list ? (
          <Spinner />
        ) : !list.length ? (
          <Empty text="No expenses in this period" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                {isAllBranches && <th>Branch</th>}
                <th>Category</th>
                <th>Note</th>
                <th>Method</th>
                <th>Added by</th>
                <th className="text-right">Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e._id}>
                  <td className="whitespace-nowrap">{dateOnly(e.date)}</td>
                  {isAllBranches && <td>{e.branch?.name}</td>}
                  <td>
                    <span className="badge bg-espresso-50 text-espresso-800">{e.category}</span>
                  </td>
                  <td className="text-stone-600">{e.note}</td>
                  <td className="uppercase text-xs">{e.paymentMethod}</td>
                  <td>{e.user?.name}</td>
                  <td className="text-right font-bold text-rose-600">{money(e.amount)}</td>
                  <td className="text-right whitespace-nowrap">
                    {can('superadmin', 'manager') && (
                      <>
                        <button className="btn-ghost btn-sm" onClick={() => setForm({ ...e, date: ymd(e.date) })}>
                          <Pencil size={14} />
                        </button>
                        <button className="btn-ghost btn-sm text-rose-600" onClick={() => del(e._id)}>
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?._id ? 'Edit expense' : 'New expense'} size="sm">
        {form && (
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {cats.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Amount">
                <input className="input" type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required autoFocus />
              </Field>
              <Field label="Date">
                <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </Field>
              <Field label="Paid via">
                <select className="input" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="bank">Bank</option>
                </select>
              </Field>
            </div>
            <Field label="Note">
              <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>
            <button className="btn-primary w-full">Save</button>
          </form>
        )}
      </Modal>
    </div>
  );
}
