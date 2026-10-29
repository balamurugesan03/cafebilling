import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Users, Armchair } from 'lucide-react';
import api, { toastErr } from '../api';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Modal, NeedBranch, Spinner, Empty, Field } from '../components/ui';

const blank = { name: '', area: 'Indoor', capacity: 4, status: 'free' };
const TONE = {
  free: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  occupied: 'border-amber-400 bg-amber-50 text-amber-800',
  reserved: 'border-sky-300 bg-sky-50 text-sky-800',
};

export default function Tables() {
  const { isAllBranches, branchId, can } = useAuth();
  const [tables, setTables] = useState(null);
  const [form, setForm] = useState(null);
  const nav = useNavigate();
  const isMgr = can('superadmin', 'manager');

  const load = () =>
    api
      .get('/tables')
      .then((r) => setTables(r.data))
      .catch(toastErr);

  useEffect(() => {
    if (isAllBranches) return;
    setTables(null);
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [branchId, isAllBranches]);

  if (isAllBranches) return <NeedBranch what="tables" />;
  if (!tables) return <Spinner />;

  const save = async (e) => {
    e.preventDefault();
    try {
      if (form._id) await api.put(`/tables/${form._id}`, form);
      else await api.post('/tables', form);
      toast.success('Saved');
      setForm(null);
      load();
    } catch (err) {
      toastErr(err);
    }
  };

  const del = async (id) => {
    if (!confirm('Delete table?')) return;
    await api.delete(`/tables/${id}`).catch(toastErr);
    load();
  };

  const areas = [...new Set(tables.map((t) => t.area))];
  const counts = { free: 0, occupied: 0, reserved: 0 };
  tables.forEach((t) => counts[t.status]++);

  return (
    <div>
      <PageHeader title="Tables" subtitle="Live floor view">
        <div className="flex gap-2 text-xs">
          {Object.entries(counts).map(([k, v]) => (
            <span key={k} className={`badge border ${TONE[k]} capitalize`}>
              {k}: {v}
            </span>
          ))}
        </div>
        {isMgr && (
          <button className="btn-primary" onClick={() => setForm(blank)}>
            <Plus size={16} /> Add table
          </button>
        )}
      </PageHeader>

      {!tables.length && <Empty text="No tables configured" icon={Armchair} />}
      {areas.map((a) => (
        <div key={a} className="mb-8">
          <h3 className="font-bold text-espresso-900 mb-3">{a}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            {tables
              .filter((t) => t.area === a)
              .map((t) => (
                <div key={t._id} className={`rounded-2xl border-2 p-4 text-center ${TONE[t.status]}`}>
                  <Armchair className="mx-auto" size={26} />
                  <p className="text-xl font-extrabold mt-1">{t.name}</p>
                  <p className="text-xs flex items-center justify-center gap-1">
                    <Users size={12} /> {t.capacity} seats
                  </p>
                  <p className="text-[11px] uppercase font-bold mt-1">{t.status}</p>
                  <div className="flex justify-center gap-1 mt-2">
                    {t.status === 'occupied' ? (
                      <button className="btn-sm btn bg-white/70" onClick={() => nav('/pos')}>
                        Open POS
                      </button>
                    ) : isMgr && (
                      <select
                        className="text-xs rounded-lg bg-white/70 px-1 py-1"
                        value={t.status}
                        onChange={async (e) => {
                          await api.put(`/tables/${t._id}`, { status: e.target.value }).catch(toastErr);
                          load();
                        }}
                      >
                        <option value="free">Free</option>
                        <option value="reserved">Reserved</option>
                      </select>
                    )}
                  </div>
                  {isMgr && (
                    <div className="flex justify-center gap-1 mt-1">
                      <button className="p-1 hover:bg-white/60 rounded" onClick={() => setForm(t)}>
                        <Pencil size={13} />
                      </button>
                      <button className="p-1 hover:bg-white/60 rounded" onClick={() => del(t._id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?._id ? 'Edit table' : 'New table'} size="sm">
        {form && (
          <form onSubmit={save} className="space-y-4">
            <Field label="Table name / number">
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Area">
                <input className="input" list="areas" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
                <datalist id="areas">
                  {areas.map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              </Field>
              <Field label="Capacity">
                <input className="input" type="number" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
              </Field>
            </div>
            <button className="btn-primary w-full">Save</button>
          </form>
        )}
      </Modal>
    </div>
  );
}
