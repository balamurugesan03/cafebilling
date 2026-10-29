import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import api, { toastErr } from '../api';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Modal, Spinner, Empty, Field, Toggle } from '../components/ui';
import { dt } from '../utils/format';

const ROLE_STYLE = {
  superadmin: 'bg-violet-50 text-violet-700',
  manager: 'bg-sky-50 text-sky-700',
  cashier: 'bg-emerald-50 text-emerald-700',
  kitchen: 'bg-amber-50 text-amber-700',
};

export default function Staff() {
  const { isSuper, branches, branchId, currentBranch, user } = useAuth();
  const [list, setList] = useState(null);
  const [form, setForm] = useState(null);
  const roles = isSuper ? ['superadmin', 'manager', 'cashier', 'kitchen'] : ['cashier', 'kitchen'];

  const load = () =>
    api
      .get('/users')
      .then((r) => setList(r.data))
      .catch(toastErr);

  useEffect(() => {
    setList(null);
    load();
  }, [branchId]);

  const save = async (e) => {
    e.preventDefault();
    const body = { ...form };
    if (!body.password) delete body.password;
    try {
      if (form._id) await api.put(`/users/${form._id}`, body);
      else await api.post('/users', body);
      toast.success('Staff saved');
      setForm(null);
      load();
    } catch (err) {
      toastErr(err);
    }
  };

  const del = async (id) => {
    if (!confirm('Delete this user?')) return;
    try {
      await api.delete(`/users/${id}`);
      load();
    } catch (e) {
      toastErr(e);
    }
  };

  const newUser = () =>
    setForm({ name: '', email: '', phone: '', password: '', role: 'cashier', branch: currentBranch?._id || (isSuper ? branches[0]?._id : undefined), active: true });

  return (
    <div>
      <PageHeader title="Staff & Access" subtitle="Role-based access: Super Admin · Manager · Cashier · Kitchen">
        <button className="btn-primary" onClick={newUser}>
          <Plus size={16} /> Add staff
        </button>
      </PageHeader>

      <div className="grid md:grid-cols-4 gap-3 mb-6 text-sm">
        {[
          ['Super Admin', 'All branches, settings, reports & head-office dashboard'],
          ['Manager', 'Own branch: menu, inventory, staff, reports, settings'],
          ['Cashier', 'POS billing, orders, customers, expenses'],
          ['Kitchen', 'Kitchen display (KOT) only'],
        ].map(([r, d]) => (
          <div key={r} className="card p-4">
            <p className="font-bold flex items-center gap-2 text-espresso-900">
              <ShieldCheck size={16} /> {r}
            </p>
            <p className="text-stone-500 text-xs mt-1">{d}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        {!list ? (
          <Spinner />
        ) : !list.length ? (
          <Empty />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Branch</th>
                <th>Phone</th>
                <th>Last login</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u._id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-espresso-100 text-espresso-800 font-bold flex items-center justify-center">{u.name[0]}</div>
                      <div>
                        <p className="font-semibold">{u.name}</p>
                        <p className="text-xs text-stone-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${ROLE_STYLE[u.role]} capitalize`}>{u.role}</span>
                  </td>
                  <td>{u.branch?.name || <span className="text-stone-400">All branches</span>}</td>
                  <td>{u.phone || '—'}</td>
                  <td className="text-stone-500 text-xs">{u.lastLogin ? dt(u.lastLogin) : 'Never'}</td>
                  <td>
                    <span className={`badge ${u.active ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>{u.active ? 'Active' : 'Disabled'}</span>
                  </td>
                  <td className="text-right whitespace-nowrap">
                    {(isSuper || ['cashier', 'kitchen'].includes(u.role)) && (
                      <>
                        <button className="btn-ghost btn-sm" onClick={() => setForm({ ...u, branch: u.branch?._id, password: '' })}>
                          <Pencil size={14} />
                        </button>
                        {u._id !== user._id && (
                          <button className="btn-ghost btn-sm text-rose-600" onClick={() => del(u._id)}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?._id ? 'Edit staff' : 'New staff'} size="sm">
        {form && (
          <form onSubmit={save} className="space-y-4">
            <Field label="Full name">
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field label="Email (login)">
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </Field>
            <Field label="Phone">
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label={form._id ? 'New password (leave blank to keep)' : 'Password'}>
              <input className="input" type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!form._id} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Role">
                <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </Field>
              {isSuper && form.role !== 'superadmin' && (
                <Field label="Branch">
                  <select className="input" value={form.branch || ''} onChange={(e) => setForm({ ...form, branch: e.target.value })} required>
                    <option value="">Select…</option>
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
            <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Account active" />
            <button className="btn-primary w-full">Save</button>
          </form>
        )}
      </Modal>
    </div>
  );
}
