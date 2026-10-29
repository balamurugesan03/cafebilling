import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Search, Copy, X } from 'lucide-react';
import api, { toastErr } from '../api';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Modal, NeedBranch, Spinner, Empty, Toggle, Field } from '../components/ui';
import { money } from '../utils/format';

const blankProduct = { name: '', sku: '', category: '', price: '', costPrice: '', taxRate: '', isVeg: true, available: true, description: '', variants: [], recipe: [] };
const blankCat = { name: '', color: '#92400e', icon: '☕', sortOrder: 0, active: true };
const ICONS = ['☕', '🧊', '🍵', '🥤', '🥪', '🍰', '🍪', '🥐', '🍕', '🍔', '🍟', '🧁', '🍩', '🥗', '🍦'];

export default function MenuPage() {
  const { isAllBranches, branchId, isSuper, branches, currentBranch } = useAuth();
  const [tab, setTab] = useState('products');
  const [cats, setCats] = useState(null);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [pForm, setPForm] = useState(null);
  const [cForm, setCForm] = useState(null);
  const [copyOpen, setCopyOpen] = useState(false);

  const load = async () => {
    const [c, p, i] = await Promise.all([api.get('/categories'), api.get('/products'), api.get('/inventory')]);
    setCats(c.data);
    setProducts(p.data);
    setInventory(i.data);
  };

  useEffect(() => {
    if (isAllBranches) return;
    setCats(null);
    load().catch(toastErr);
  }, [branchId, isAllBranches]);

  const list = useMemo(
    () => products.filter((p) => (!catFilter || p.category?._id === catFilter) && (!search || p.name.toLowerCase().includes(search.toLowerCase()))),
    [products, catFilter, search]
  );

  if (isAllBranches) return <NeedBranch what="the menu" />;
  if (!cats) return <Spinner />;

  const saveProduct = async (e) => {
    e.preventDefault();
    const body = {
      ...pForm,
      price: Number(pForm.price),
      costPrice: Number(pForm.costPrice) || 0,
      taxRate: pForm.taxRate === '' || pForm.taxRate === null ? null : Number(pForm.taxRate),
      variants: pForm.variants.filter((v) => v.name).map((v) => ({ name: v.name, price: Number(v.price) })),
      recipe: pForm.recipe.filter((r) => r.item).map((r) => ({ item: r.item, qty: Number(r.qty) })),
      category: pForm.category,
    };
    try {
      if (pForm._id) await api.put(`/products/${pForm._id}`, body);
      else await api.post('/products', body);
      toast.success('Product saved');
      setPForm(null);
      load();
    } catch (err) {
      toastErr(err);
    }
  };

  const saveCat = async (e) => {
    e.preventDefault();
    try {
      if (cForm._id) await api.put(`/categories/${cForm._id}`, cForm);
      else await api.post('/categories', cForm);
      toast.success('Category saved');
      setCForm(null);
      load();
    } catch (err) {
      toastErr(err);
    }
  };

  const del = async (type, id) => {
    if (!confirm('Delete this item permanently?')) return;
    try {
      await api.delete(`/${type}/${id}`);
      toast.success('Deleted');
      load();
    } catch (err) {
      toastErr(err);
    }
  };

  const toggleAvail = async (p) => {
    setProducts((l) => l.map((x) => (x._id === p._id ? { ...x, available: !p.available } : x)));
    await api.put(`/products/${p._id}`, { available: !p.available }).catch(toastErr);
  };

  const editProduct = (p) =>
    setPForm({
      ...blankProduct,
      ...p,
      category: p.category?._id || '',
      taxRate: p.taxRate ?? '',
      recipe: (p.recipe || []).map((r) => ({ item: r.item?._id || r.item, qty: r.qty })),
    });

  return (
    <div>
      <PageHeader title="Menu & Products" subtitle={`Menu for ${currentBranch?.name || 'your branch'}`}>
        {isSuper && branches.length > 1 && (
          <button className="btn-outline" onClick={() => setCopyOpen(true)}>
            <Copy size={16} /> Copy menu from branch
          </button>
        )}
        {tab === 'products' ? (
          <button className="btn-primary" onClick={() => (cats.length ? setPForm({ ...blankProduct, category: cats[0]._id }) : toast.error('Create a category first'))}>
            <Plus size={16} /> Add product
          </button>
        ) : (
          <button className="btn-primary" onClick={() => setCForm({ ...blankCat, sortOrder: cats.length })}>
            <Plus size={16} /> Add category
          </button>
        )}
      </PageHeader>

      <div className="flex gap-1 mb-4 rounded-xl bg-white border border-stone-200 p-1 w-fit">
        {[
          ['products', `Products (${products.length})`],
          ['categories', `Categories (${cats.length})`],
        ].map(([k, l]) => (
          <button key={k} className={`btn btn-sm ${tab === k ? 'bg-espresso-800 text-white' : 'text-stone-600'}`} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'products' ? (
        <div className="card overflow-hidden">
          <div className="p-4 flex flex-wrap gap-3 border-b border-stone-100">
            <div className="relative flex-1 min-w-48">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input className="input pl-9" placeholder="Search products" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="input w-56" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              <option value="">All categories</option>
              {cats.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>
          {list.length ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Cost</th>
                    <th>Variants</th>
                    <th>Recipe</th>
                    <th>Available</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => (
                    <tr key={p._id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${p.isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                          <div>
                            <p className="font-semibold">{p.name}</p>
                            <p className="text-[11px] text-stone-400">{p.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{ background: `${p.category?.color}18`, color: p.category?.color }}>
                          {p.category?.icon} {p.category?.name}
                        </span>
                      </td>
                      <td className="text-right font-semibold">{money(p.price)}</td>
                      <td className="text-right text-stone-500">{money(p.costPrice)}</td>
                      <td className="text-xs text-stone-600">{p.variants.map((v) => `${v.name} ${money(v.price)}`).join(', ') || '—'}</td>
                      <td className="text-xs text-stone-600">{p.recipe.length ? `${p.recipe.length} ingredients` : '—'}</td>
                      <td>
                        <Toggle checked={p.available} onChange={() => toggleAvail(p)} />
                      </td>
                      <td className="whitespace-nowrap text-right">
                        <button className="btn-ghost btn-sm" onClick={() => editProduct(p)}>
                          <Pencil size={14} />
                        </button>
                        <button className="btn-ghost btn-sm text-rose-600" onClick={() => del('products', p._id)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty text="No products" />
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {cats.map((c) => (
            <div key={c._id} className="card p-5 relative overflow-hidden">
              <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: c.color }} />
              <div className="flex items-center gap-3">
                <span className="text-3xl">{c.icon}</span>
                <div className="flex-1">
                  <p className="font-bold text-espresso-900">{c.name}</p>
                  <p className="text-xs text-stone-500">{products.filter((p) => p.category?._id === c._id).length} products</p>
                </div>
                {!c.active && <span className="badge bg-stone-100 text-stone-500">hidden</span>}
              </div>
              <div className="flex gap-2 mt-4">
                <button className="btn-outline btn-sm flex-1" onClick={() => setCForm(c)}>
                  <Pencil size={14} /> Edit
                </button>
                <button className="btn-outline btn-sm text-rose-600" onClick={() => del('categories', c._id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {!cats.length && <Empty text="No categories yet" />}
        </div>
      )}

      {/* Product form */}
      <Modal open={!!pForm} onClose={() => setPForm(null)} title={pForm?._id ? 'Edit product' : 'New product'} size="lg">
        {pForm && (
          <form onSubmit={saveProduct} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Name">
                <input className="input" value={pForm.name} onChange={(e) => setPForm({ ...pForm, name: e.target.value })} required />
              </Field>
              <Field label="Category">
                <select className="input" value={pForm.category} onChange={(e) => setPForm({ ...pForm, category: e.target.value })} required>
                  {cats.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Selling price">
                <input className="input" type="number" min="0" step="0.01" value={pForm.price} onChange={(e) => setPForm({ ...pForm, price: e.target.value })} required />
              </Field>
              <Field label="Cost price">
                <input className="input" type="number" min="0" step="0.01" value={pForm.costPrice} onChange={(e) => setPForm({ ...pForm, costPrice: e.target.value })} />
              </Field>
              <Field label="SKU / short code">
                <input className="input" value={pForm.sku} onChange={(e) => setPForm({ ...pForm, sku: e.target.value })} />
              </Field>
              <Field label="Tax % (blank = branch default)">
                <input className="input" type="number" min="0" step="0.01" value={pForm.taxRate} onChange={(e) => setPForm({ ...pForm, taxRate: e.target.value })} />
              </Field>
            </div>
            <div className="flex gap-6">
              <Toggle checked={pForm.isVeg} onChange={(v) => setPForm({ ...pForm, isVeg: v })} label="Vegetarian" />
              <Toggle checked={pForm.available} onChange={(v) => setPForm({ ...pForm, available: v })} label="Available for sale" />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="label mb-0">Variants / sizes</p>
                <button type="button" className="btn-outline btn-sm" onClick={() => setPForm({ ...pForm, variants: [...pForm.variants, { name: '', price: '' }] })}>
                  <Plus size={14} /> Add
                </button>
              </div>
              {pForm.variants.map((v, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input className="input" placeholder="e.g. Large" value={v.name} onChange={(e) => setPForm({ ...pForm, variants: pForm.variants.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                  <input className="input w-36" type="number" placeholder="Price" value={v.price} onChange={(e) => setPForm({ ...pForm, variants: pForm.variants.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)) })} />
                  <button type="button" className="btn-ghost text-rose-600" onClick={() => setPForm({ ...pForm, variants: pForm.variants.filter((_, j) => j !== i) })}>
                    <X size={16} />
                  </button>
                </div>
              ))}
              {!pForm.variants.length && <p className="text-xs text-stone-400">No variants — the base price is used.</p>}
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="label mb-0">Recipe (auto stock deduction per unit sold)</p>
                <button type="button" className="btn-outline btn-sm" onClick={() => setPForm({ ...pForm, recipe: [...pForm.recipe, { item: inventory[0]?._id || '', qty: '' }] })} disabled={!inventory.length}>
                  <Plus size={14} /> Add ingredient
                </button>
              </div>
              {pForm.recipe.map((r, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <select className="input" value={r.item} onChange={(e) => setPForm({ ...pForm, recipe: pForm.recipe.map((x, j) => (j === i ? { ...x, item: e.target.value } : x)) })}>
                    {inventory.map((it) => (
                      <option key={it._id} value={it._id}>
                        {it.name} ({it.unit})
                      </option>
                    ))}
                  </select>
                  <input className="input w-36" type="number" step="0.01" placeholder="Qty" value={r.qty} onChange={(e) => setPForm({ ...pForm, recipe: pForm.recipe.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)) })} />
                  <button type="button" className="btn-ghost text-rose-600" onClick={() => setPForm({ ...pForm, recipe: pForm.recipe.filter((_, j) => j !== i) })}>
                    <X size={16} />
                  </button>
                </div>
              ))}
              {!inventory.length && <p className="text-xs text-stone-400">Add inventory items first to link a recipe.</p>}
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setPForm(null)}>
                Cancel
              </button>
              <button className="btn-primary">Save product</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Category form */}
      <Modal open={!!cForm} onClose={() => setCForm(null)} title={cForm?._id ? 'Edit category' : 'New category'} size="sm">
        {cForm && (
          <form onSubmit={saveCat} className="space-y-4">
            <Field label="Name">
              <input className="input" value={cForm.name} onChange={(e) => setCForm({ ...cForm, name: e.target.value })} required />
            </Field>
            <Field label="Icon">
              <div className="flex flex-wrap gap-1">
                {ICONS.map((i) => (
                  <button type="button" key={i} onClick={() => setCForm({ ...cForm, icon: i })} className={`w-9 h-9 rounded-lg text-xl ${cForm.icon === i ? 'bg-amber-200' : 'hover:bg-stone-100'}`}>
                    {i}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Colour">
                <input type="color" className="input h-10 p-1" value={cForm.color} onChange={(e) => setCForm({ ...cForm, color: e.target.value })} />
              </Field>
              <Field label="Sort order">
                <input type="number" className="input" value={cForm.sortOrder} onChange={(e) => setCForm({ ...cForm, sortOrder: Number(e.target.value) })} />
              </Field>
            </div>
            <Toggle checked={cForm.active} onChange={(v) => setCForm({ ...cForm, active: v })} label="Show in POS" />
            <button className="btn-primary w-full">Save category</button>
          </form>
        )}
      </Modal>

      <CopyMenuModal open={copyOpen} onClose={() => setCopyOpen(false)} onDone={load} />
    </div>
  );
}

function CopyMenuModal({ open, onClose, onDone }) {
  const { branches, branchId, currentBranch } = useAuth();
  const [src, setSrc] = useState('');
  const [busy, setBusy] = useState(false);
  const others = branches.filter((b) => b._id !== branchId);
  const run = async () => {
    if (!src) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/products/copy-from/${src}`);
      toast.success(data.message);
      onClose();
      onDone();
    } catch (e) {
      toastErr(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Copy menu from another branch" size="sm">
      <p className="text-sm text-stone-600 mb-4">
        Categories and products missing in <b>{currentBranch?.name}</b> will be copied (matched by name). Recipes are linked to inventory items with the same name. Existing items are not changed.
      </p>
      <select className="input mb-4" value={src} onChange={(e) => setSrc(e.target.value)}>
        <option value="">Select source branch</option>
        {others.map((b) => (
          <option key={b._id} value={b._id}>
            {b.name}
          </option>
        ))}
      </select>
      <button className="btn-primary w-full" disabled={!src || busy} onClick={run}>
        <Copy size={16} /> Copy menu
      </button>
    </Modal>
  );
}
