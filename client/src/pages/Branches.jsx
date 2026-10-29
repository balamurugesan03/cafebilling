import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, MapPin, Phone, Building2, ArrowRight } from 'lucide-react';
import api, { toastErr } from '../api';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Modal, Field, Toggle, Empty } from '../components/ui';

const blank = { name: '', code: '', address: '', city: '', phone: '', email: '', gstin: '', active: true };

export default function Branches() {
  const { branches, loadBranches, setBranchId } = useAuth();
  const [form, setForm] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    try {
      if (form._id) await api.put(`/branches/${form._id}`, form);
      else await api.post('/branches', form);
      toast.success('Branch saved');
      setForm(null);
      loadBranches();
    } catch (err) {
      toastErr(err);
    }
  };

  const del = async (b) => {
    if (!confirm(`Delete ${b.name}?`)) return;
    try {
      await api.delete(`/branches/${b._id}`);
      toast.success('Deleted');
      loadBranches();
    } catch (err) {
      toastErr(err);
    }
  };

  return (
    <div>
      <PageHeader title="Branches" subtitle={`${branches.length} outlets`}>
        <button className="btn-primary" onClick={() => setForm(blank)}>
          <Plus size={16} /> New branch
        </button>
      </PageHeader>

      {!branches.length && <Empty text="Create your first branch" icon={Building2} />}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {branches.map((b) => (
          <div key={b._id} className="card p-6 relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-amber-100/60" />
            <div className="relative">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-2xl bg-espresso-900 text-amber-400 flex items-center justify-center font-extrabold">{b.code}</div>
                <span className={`badge ${b.active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>{b.active ? 'Active' : 'Inactive'}</span>
              </div>
              <h3 className="font-extrabold text-lg text-espresso-950 mt-4">{b.name}</h3>
              <p className="text-sm text-stone-500 flex items-center gap-1.5 mt-1">
                <MapPin size={14} /> {[b.address, b.city].filter(Boolean).join(', ') || '—'}
              </p>
              <p className="text-sm text-stone-500 flex items-center gap-1.5 mt-1">
                <Phone size={14} /> {b.phone || '—'}
              </p>
              <div className="flex flex-wrap gap-2 mt-3 text-xs">
                <span className="badge bg-stone-100 text-stone-600">
                  {b.settings?.taxLabel} {b.settings?.taxRate}% {b.settings?.taxInclusive ? 'incl.' : 'excl.'}
                </span>
                <span className="badge bg-stone-100 text-stone-600">Printer: {b.settings?.printer?.mode}</span>
                <span className="badge bg-stone-100 text-stone-600">{b.invoiceSeq} invoices</span>
              </div>
              <div className="flex gap-2 mt-5">
                <button className="btn-primary btn-sm flex-1" onClick={() => setBranchId(b._id)}>
                  Open dashboard <ArrowRight size={14} />
                </button>
                <button className="btn-outline btn-sm" onClick={() => setForm(b)}>
                  <Pencil size={14} />
                </button>
                <button className="btn-outline btn-sm text-rose-600" onClick={() => del(b)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?._id ? 'Edit branch' : 'New branch'}>
        {form && (
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Branch name" className="col-span-2">
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </Field>
              <Field label="Code">
                <input className="input uppercase" maxLength={5} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required />
              </Field>
            </div>
            <Field label="Address">
              <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City">
                <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </Field>
              <Field label="Phone">
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="Email">
                <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field label="GSTIN">
                <input className="input uppercase" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} />
              </Field>
            </div>
            <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Branch active (inactive branches cannot bill or log in)" />
            <p className="text-xs text-stone-500">Tax, receipt and printer options are configured in Settings after selecting the branch.</p>
            <button className="btn-primary w-full">Save branch</button>
          </form>
        )}
      </Modal>
    </div>
  );
}
