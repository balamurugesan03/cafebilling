import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Gift, Crown, Download, Eye, Trash2 } from 'lucide-react';
import api, { toastErr } from '../api';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Modal, Spinner, Empty, Field } from '../components/ui';
import { money, dateOnly, dt, downloadCSV } from '../utils/format';

const blank = { name: '', phone: '', email: '', birthday: '', notes: '' };

const tier = (spent) => (spent >= 10000 ? ['Gold', 'bg-amber-100 text-amber-800'] : spent >= 3000 ? ['Silver', 'bg-stone-200 text-stone-700'] : ['Regular', 'bg-espresso-50 text-espresso-700']);

export default function Customers() {
  const { can } = useAuth();
  const [list, setList] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);
  const [hist, setHist] = useState(null);

  const load = () =>
    api
      .get('/customers', { params: { search } })
      .then((r) => setList(r.data))
      .catch(toastErr);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const save = async (e) => {
    e.preventDefault();
    try {
      if (form._id) await api.put(`/customers/${form._id}`, form);
      else await api.post('/customers', form);
      toast.success('Customer saved');
      setForm(null);
      load();
    } catch (err) {
      toastErr(err);
    }
  };

  const openHistory = async (c) => {
    const { data } = await api.get(`/customers/${c._id}/orders`);
    setHist({ c, orders: data });
  };

  const del = async (id) => {
    if (!confirm('Delete customer?')) return;
    await api.delete(`/customers/${id}`).catch(toastErr);
    load();
  };

  return (
    <div>
      <PageHeader title="Customers & Loyalty" subtitle="Shared across all branches — points earned anywhere can be redeemed anywhere">
        <button
          className="btn-outline"
          onClick={() =>
            downloadCSV(
              'customers.csv',
              (list || []).map((c) => ({ Name: c.name, Phone: c.phone, Email: c.email, Points: c.points, Visits: c.visits, TotalSpent: c.totalSpent, LastVisit: c.lastVisit ? dateOnly(c.lastVisit) : '' }))
            )
          }
        >
          <Download size={16} /> Export
        </button>
        <button className="btn-primary" onClick={() => setForm(blank)}>
          <Plus size={16} /> Add customer
        </button>
      </PageHeader>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-stone-100 relative">
          <Search size={16} className="absolute left-7 top-1/2 -translate-y-1/2 text-stone-400" />
          <input className="input pl-9 max-w-sm" placeholder="Search by name or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {!list ? (
          <Spinner />
        ) : !list.length ? (
          <Empty text="No customers yet. They are auto-created when you enter a phone number at billing." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Tier</th>
                  <th className="text-right">Points</th>
                  <th className="text-right">Visits</th>
                  <th className="text-right">Total spent</th>
                  <th>Last visit</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  const [t, cls] = tier(c.totalSpent);
                  return (
                    <tr key={c._id}>
                      <td>
                        <p className="font-semibold">{c.name || 'Guest'}</p>
                        <p className="text-xs text-stone-500">{c.phone}</p>
                      </td>
                      <td>
                        <span className={`badge ${cls}`}>
                          {t === 'Gold' && <Crown size={11} />} {t}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="inline-flex items-center gap-1 font-bold text-amber-700">
                          <Gift size={13} /> {c.points}
                        </span>
                      </td>
                      <td className="text-right">{c.visits}</td>
                      <td className="text-right font-semibold">{money(c.totalSpent)}</td>
                      <td className="text-stone-500 text-xs">
                        {c.lastVisit ? dateOnly(c.lastVisit) : '—'}
                        {c.lastBranch && <p>{c.lastBranch.name}</p>}
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <button className="btn-ghost btn-sm" onClick={() => openHistory(c)}>
                          <Eye size={14} />
                        </button>
                        <button className="btn-ghost btn-sm" onClick={() => setForm({ ...c, birthday: c.birthday ? c.birthday.slice(0, 10) : '' })}>
                          <Pencil size={14} />
                        </button>
                        {can('superadmin', 'manager') && (
                          <button className="btn-ghost btn-sm text-rose-600" onClick={() => del(c._id)}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?._id ? 'Edit customer' : 'New customer'} size="sm">
        {form && (
          <form onSubmit={save} className="space-y-4">
            <Field label="Name">
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Mobile">
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} required />
            </Field>
            <Field label="Email">
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Birthday">
              <input className="input" type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} />
            </Field>
            {form._id && can('superadmin', 'manager') && (
              <Field label="Loyalty points (manual adjust)">
                <input className="input" type="number" value={form.points} onChange={(e) => setForm({ ...form, points: Number(e.target.value) })} />
              </Field>
            )}
            <Field label="Notes">
              <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <button className="btn-primary w-full">Save</button>
          </form>
        )}
      </Modal>

      <Modal open={!!hist} onClose={() => setHist(null)} title={hist ? `${hist.c.name || hist.c.phone} — order history` : ''} size="md">
        {hist &&
          (hist.orders.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Branch</th>
                  <th>Date</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {hist.orders.map((o) => (
                  <tr key={o._id}>
                    <td className="font-mono text-xs">{o.invoiceNo}</td>
                    <td>{o.branch?.name}</td>
                    <td className="text-stone-500">{dt(o.createdAt)}</td>
                    <td className="text-right font-semibold">{money(o.grandTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty text="No orders yet" />
          ))}
      </Modal>
    </div>
  );
}
