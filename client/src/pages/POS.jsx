import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Search, Plus, Minus, Trash2, User, Percent, IndianRupee, PauseCircle, ChefHat, CreditCard, Banknote, Smartphone,
  Split, Printer, CheckCircle2, StickyNote, X, Gift, RotateCcw, Armchair, ShoppingBag, Bike, ListRestart,
} from 'lucide-react';
import api, { toastErr } from '../api';
import { useAuth } from '../context/AuthContext';
import { Modal, NeedBranch, Spinner, Empty } from '../components/ui';
import { money, money2, timeOnly } from '../utils/format';
import { printOrder } from '../utils/print';

const ORDER_TYPES = [
  ['dine-in', 'Dine-in', Armchair],
  ['takeaway', 'Takeaway', ShoppingBag],
  ['delivery', 'Delivery', Bike],
];
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function useTotals(cart, branch, discountType, discountValue, pointsRedeemed, productMap) {
  return useMemo(() => {
    const s = branch?.settings || {};
    const subTotal = r2(cart.reduce((a, c) => a + c.price * c.qty, 0));
    let discount = discountType === 'percent' ? (subTotal * Math.min(Number(discountValue) || 0, 100)) / 100 : Number(discountValue) || 0;
    discount = r2(Math.min(discount, subTotal));
    const factor = subTotal ? (subTotal - discount) / subTotal : 0;
    let tax = 0;
    let taxable = 0;
    for (const c of cart) {
      const t = c.price * c.qty * factor;
      const rate = (productMap.get(c.product)?.taxRate ?? s.taxRate ?? 0) / 100;
      tax += s.taxInclusive ? t - t / (1 + rate) : t * rate;
      taxable += t;
    }
    tax = r2(tax);
    let total = s.taxInclusive ? taxable : taxable + tax;
    const pointsValue = r2(Math.min((Number(pointsRedeemed) || 0) * (s.pointValue ?? 1), total));
    total -= pointsValue;
    const grand = Math.round(total);
    return { subTotal, discount, tax, pointsValue, roundOff: r2(grand - total), grand, items: cart.reduce((a, c) => a + c.qty, 0) };
  }, [cart, branch, discountType, discountValue, pointsRedeemed, productMap]);
}

// ---------------- Payment modal ----------------
function PaymentModal({ open, onClose, total, onPay, busy, cur }) {
  const [mode, setMode] = useState('cash');
  const [tendered, setTendered] = useState('');
  const [ref, setRef] = useState('');
  const [split, setSplit] = useState([]);

  useEffect(() => {
    if (open) {
      setMode('cash');
      setTendered('');
      setRef('');
      setSplit([
        { method: 'cash', amount: '' },
        { method: 'upi', amount: '' },
      ]);
    }
  }, [open]);

  const splitPaid = split.reduce((a, s) => a + (Number(s.amount) || 0), 0);
  const cashGiven = Number(tendered) || total;
  const change = mode === 'cash' ? Math.max(0, cashGiven - total) : 0;
  const quick = [...new Set([total, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, 2000])].filter((v) => v >= total).slice(0, 5);

  const submit = () => {
    if (mode === 'split') {
      if (splitPaid + 0.001 < total) return toast.error(`Remaining ${money(total - splitPaid, cur)}`);
      return onPay(split.filter((s) => Number(s.amount) > 0).map((s) => ({ method: s.method, amount: Number(s.amount) })));
    }
    if (mode === 'cash') {
      if (cashGiven < total) return toast.error('Tendered amount is less than total');
      return onPay([{ method: 'cash', amount: cashGiven }]);
    }
    onPay([{ method: mode, amount: total, ref }]);
  };

  const methods = [
    ['cash', 'Cash', Banknote],
    ['upi', 'UPI', Smartphone],
    ['card', 'Card', CreditCard],
    ['split', 'Split', Split],
  ];

  return (
    <Modal open={open} onClose={onClose} title="Collect payment" size="md">
      <div className="rounded-2xl bg-espresso-950 text-white p-5 text-center mb-5">
        <p className="text-xs uppercase tracking-widest text-espresso-300">Amount payable</p>
        <p className="text-4xl font-extrabold mt-1">{money(total, cur)}</p>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-5">
        {methods.map(([k, l, Icon]) => (
          <button key={k} onClick={() => setMode(k)} className={`btn flex-col py-3 border ${mode === k ? 'border-espresso-700 bg-espresso-50 text-espresso-900' : 'border-stone-200 text-stone-600'}`}>
            <Icon size={20} /> {l}
          </button>
        ))}
      </div>

      {mode === 'cash' && (
        <div className="space-y-3">
          <label className="label">Cash received</label>
          <input autoFocus className="input text-xl font-bold py-3" type="number" placeholder={String(total)} value={tendered} onChange={(e) => setTendered(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          <div className="flex flex-wrap gap-2">
            {quick.map((q) => (
              <button key={q} className="btn-outline btn-sm" onClick={() => setTendered(String(q))}>
                {money(q, cur)}
              </button>
            ))}
          </div>
          <div className="flex justify-between rounded-xl bg-emerald-50 px-4 py-3 text-emerald-800">
            <span className="font-semibold">Change to return</span>
            <span className="text-xl font-extrabold">{money(change, cur)}</span>
          </div>
        </div>
      )}
      {(mode === 'upi' || mode === 'card') && (
        <div>
          <label className="label">{mode === 'upi' ? 'UPI transaction ref (optional)' : 'Card last 4 / approval code (optional)'}</label>
          <input autoFocus className="input" value={ref} onChange={(e) => setRef(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        </div>
      )}
      {mode === 'split' && (
        <div className="space-y-2">
          {split.map((s, i) => (
            <div key={i} className="flex gap-2">
              <select className="input w-32" value={s.method} onChange={(e) => setSplit(split.map((x, j) => (j === i ? { ...x, method: e.target.value } : x)))}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="wallet">Wallet</option>
              </select>
              <input className="input" type="number" placeholder="Amount" value={s.amount} onChange={(e) => setSplit(split.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
              <button
                className="btn-ghost btn-sm"
                onClick={() => setSplit(split.map((x, j) => (j === i ? { ...x, amount: String(r2(Math.max(0, total - splitPaid + (Number(x.amount) || 0)))) } : x)))}
              >
                Rest
              </button>
              {split.length > 1 && (
                <button className="btn-ghost btn-sm text-rose-600" onClick={() => setSplit(split.filter((_, j) => j !== i))}>
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          <button className="btn-outline btn-sm" onClick={() => setSplit([...split, { method: 'card', amount: '' }])}>
            <Plus size={14} /> Add payment
          </button>
          <div className={`flex justify-between rounded-xl px-4 py-3 ${splitPaid >= total ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
            <span className="font-semibold">{splitPaid >= total ? 'Fully paid' : 'Remaining'}</span>
            <span className="font-extrabold">{money(Math.abs(total - splitPaid), cur)}</span>
          </div>
        </div>
      )}

      <button className="btn-success w-full py-3.5 text-base mt-6" disabled={busy} onClick={submit}>
        <CheckCircle2 size={20} /> Complete sale
      </button>
    </Modal>
  );
}

// ---------------- POS ----------------
export default function POS() {
  const { isAllBranches, currentBranch, branches, branchId, user } = useAuth();
  const branch = currentBranch || branches.find((b) => b._id === (user.branch?._id || user.branch));
  const cur = branch?.settings?.currency || '₹';

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [tables, setTables] = useState([]);
  const [held, setHeld] = useState([]);
  const [cat, setCat] = useState('all');
  const [search, setSearch] = useState('');

  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState('takeaway');
  const [table, setTable] = useState('');
  const [phone, setPhone] = useState('');
  const [custName, setCustName] = useState('');
  const [customer, setCustomer] = useState(null);
  const [discountType, setDiscountType] = useState('flat');
  const [discountValue, setDiscountValue] = useState('');
  const [points, setPoints] = useState('');
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(null); // held order being edited

  const [variantFor, setVariantFor] = useState(null);
  const [noteFor, setNoteFor] = useState(null);
  const [payOpen, setPayOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);
  const searchRef = useRef();

  const productMap = useMemo(() => new Map(products.map((p) => [p._id, p])), [products]);
  const totals = useTotals(cart, branch, discountType, discountValue, points, productMap);

  const loadAll = useCallback(async () => {
    const [c, p, t, h] = await Promise.all([api.get('/categories'), api.get('/products'), api.get('/tables'), api.get('/orders/held')]);
    setCategories(c.data.filter((x) => x.active));
    setProducts(p.data);
    setTables(t.data);
    setHeld(h.data);
  }, []);

  useEffect(() => {
    if (isAllBranches) return;
    setLoading(true);
    resetCart();
    loadAll()
      .catch(toastErr)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, isAllBranches]);

  // Customer lookup
  useEffect(() => {
    if (phone.length < 10) return setCustomer(null);
    const t = setTimeout(() => {
      api.get(`/customers/phone/${phone}`).then(({ data }) => {
        setCustomer(data);
        if (data?.name) setCustName(data.name);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [phone]);

  // Shortcuts
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'F9' && cart.length) {
        e.preventDefault();
        setPayOpen(true);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [cart.length]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) => (cat === 'all' || p.category?._id === cat) && (!q || p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q))
    );
  }, [products, cat, search]);

  function resetCart() {
    setCart([]);
    setOrderType('takeaway');
    setTable('');
    setPhone('');
    setCustName('');
    setCustomer(null);
    setDiscountType('flat');
    setDiscountValue('');
    setPoints('');
    setNote('');
    setEditing(null);
  }

  const addToCart = (p, variant) => {
    if (!p.available) return toast.error(`${p.name} is unavailable`);
    if (p.variants?.length && !variant) return setVariantFor(p);
    const vName = variant?.name || '';
    const price = variant?.price ?? p.price;
    const key = `${p._id}|${vName}`;
    setCart((c) => {
      const ex = c.find((x) => x.key === key && !x.notes);
      if (ex) return c.map((x) => (x === ex ? { ...x, qty: x.qty + 1 } : x));
      return [...c, { key: key + '|' + Date.now(), product: p._id, name: p.name, variant: vName, price, qty: 1, notes: '', isVeg: p.isVeg }];
    });
    setVariantFor(null);
  };

  const setQty = (key, qty) => setCart((c) => (qty <= 0 ? c.filter((x) => x.key !== key) : c.map((x) => (x.key === key ? { ...x, qty } : x))));

  const payload = (status, payments) => ({
    items: cart.map((c) => ({ product: c.product, variant: c.variant, qty: c.qty, notes: c.notes })),
    orderType,
    table: orderType === 'dine-in' ? table : null,
    customerPhone: phone,
    customerName: custName,
    discountType,
    discountValue: Number(discountValue) || 0,
    pointsRedeemed: Number(points) || 0,
    note,
    status,
    payments,
  });

  const save = async (status, payments) => {
    if (!cart.length) return toast.error('Cart is empty');
    if (orderType === 'dine-in' && !table && status === 'held') return toast.error('Select a table for dine-in');
    setBusy(true);
    try {
      const body = payload(status, payments);
      const { data } = editing ? await api.put(`/orders/${editing._id}`, body) : await api.post('/orders', body);
      return data;
    } catch (e) {
      toastErr(e);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const hold = async (withKOT) => {
    const o = await save('held');
    if (!o) return;
    toast.success(`${withKOT ? 'KOT sent' : 'Order held'} — Token #${o.tokenNo}`);
    if (withKOT) printOrder(o, branch, 'kot');
    resetCart();
    loadAll();
  };

  const pay = async (payments) => {
    const o = await save('completed', payments);
    if (!o) return;
    setPayOpen(false);
    setDone(o);
    resetCart();
    loadAll();
    const p = branch?.settings?.printer || {};
    if (p.autoPrintBill) await printOrder(o, branch, 'bill');
    if (p.autoPrintKOT && !editing) await printOrder(o, branch, 'kot');
  };

  const loadHeld = (o) => {
    setCart(
      o.items.map((i, idx) => ({
        key: `${i.product}|${i.variant}|${idx}`,
        product: i.product,
        name: i.name,
        variant: i.variant,
        price: i.price,
        qty: i.qty,
        notes: i.notes,
        isVeg: productMap.get(i.product)?.isVeg ?? true,
      }))
    );
    setOrderType(o.orderType);
    setTable(o.table || '');
    setPhone(o.customerPhone || '');
    setCustName(o.customerName || '');
    setDiscountType(o.discountType);
    setDiscountValue(o.discountValue || '');
    setPoints(o.pointsRedeemed || '');
    setNote(o.note || '');
    setEditing(o);
    setHeldOpen(false);
  };

  if (isAllBranches) return <NeedBranch what="POS billing" />;
  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col xl:flex-row gap-5 xl:h-[calc(100vh-8rem)]">
      {/* ---------- Products ---------- */}
      <section className="flex-1 min-w-0 flex flex-col">
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input ref={searchRef} className="input pl-10 py-3" placeholder="Search menu or SKU…  (F2)" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn-outline relative" onClick={() => setHeldOpen(true)}>
            <ListRestart size={18} /> Running
            {held.length > 0 && <span className="absolute -top-2 -right-2 badge bg-amber-500 text-white">{held.length}</span>}
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1">
          <button onClick={() => setCat('all')} className={`btn whitespace-nowrap ${cat === 'all' ? 'bg-espresso-800 text-white' : 'bg-white border border-stone-200 text-stone-700'}`}>
            All items
          </button>
          {categories.map((c) => (
            <button
              key={c._id}
              onClick={() => setCat(c._id)}
              className={`btn whitespace-nowrap border ${cat === c._id ? 'text-white border-transparent' : 'bg-white border-stone-200 text-stone-700'}`}
              style={cat === c._id ? { background: c.color } : {}}
            >
              <span>{c.icon}</span> {c.name}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {visible.length ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3">
              {visible.map((p) => (
                <button
                  key={p._id}
                  onClick={() => addToCart(p)}
                  className={`card text-left p-4 relative overflow-hidden group transition hover:-translate-y-0.5 hover:shadow-md ${!p.available ? 'opacity-40 grayscale' : ''}`}
                >
                  <span className="absolute inset-x-0 top-0 h-1" style={{ background: p.category?.color }} />
                  <div className="flex items-start justify-between">
                    <span className="text-2xl">{p.category?.icon || '☕'}</span>
                    <span className={`w-3.5 h-3.5 border-2 flex items-center justify-center ${p.isVeg ? 'border-emerald-600' : 'border-rose-600'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${p.isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                    </span>
                  </div>
                  <p className="font-semibold text-espresso-950 mt-2 leading-tight line-clamp-2 min-h-[2.5rem]">{p.name}</p>
                  <p className="text-sm font-bold text-espresso-700 mt-1">
                    {p.variants?.length ? <span className="text-xs font-medium text-stone-500">from </span> : null}
                    {money(p.variants?.length ? Math.min(...p.variants.map((v) => v.price)) : p.price, cur)}
                  </p>
                  {!p.available && <span className="badge bg-rose-100 text-rose-700 absolute bottom-3 right-3">Sold out</span>}
                  <span className="absolute bottom-3 right-3 w-7 h-7 rounded-full bg-amber-500 text-espresso-950 items-center justify-center hidden group-hover:flex">
                    <Plus size={16} />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <Empty text="No products found. Add products from Menu & Products." />
          )}
        </div>
      </section>

      {/* ---------- Cart ---------- */}
      <aside className="w-full xl:w-[420px] shrink-0 card flex flex-col overflow-hidden">
        <div className="p-4 border-b border-stone-100 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-espresso-950 text-lg">{editing ? `Editing #${editing.tokenNo}` : 'Current order'}</h2>
            {(cart.length > 0 || editing) && (
              <button className="btn-ghost btn-sm text-rose-600" onClick={resetCart}>
                <RotateCcw size={14} /> {editing ? 'Close' : 'Clear'}
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1">
            {ORDER_TYPES.map(([k, l, Icon]) => (
              <button key={k} onClick={() => setOrderType(k)} className={`btn btn-sm ${orderType === k ? 'bg-white shadow text-espresso-900' : 'text-stone-500'}`}>
                <Icon size={14} /> {l}
              </button>
            ))}
          </div>
          {orderType === 'dine-in' && (
            <select className="input" value={table} onChange={(e) => setTable(e.target.value)}>
              <option value="">Select table…</option>
              {tables.map((t) => (
                <option key={t._id} value={t._id} disabled={t.status === 'occupied' && t._id !== editing?.table}>
                  {t.name} · {t.area} ({t.capacity} seats){t.status === 'occupied' && t._id !== editing?.table ? ' — occupied' : ''}
                </option>
              ))}
            </select>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input className="input pl-8" placeholder="Mobile no." value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} />
            </div>
            <input className="input" placeholder="Customer name" value={custName} onChange={(e) => setCustName(e.target.value)} />
          </div>
          {customer && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <Gift size={14} />
              <span>
                <b>{customer.points}</b> points · {customer.visits} visits
              </span>
              {customer.points > 0 && (
                <button className="ml-auto font-bold underline" onClick={() => setPoints(String(customer.points))}>
                  Redeem
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 min-h-[200px]">
          {cart.length === 0 ? (
            <Empty text="Tap a product to start billing" icon={ShoppingBag} />
          ) : (
            cart.map((c) => (
              <div key={c.key} className="py-3 border-b border-dashed border-stone-200 last:border-0">
                <div className="flex items-start gap-2">
                  <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${c.isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-tight">
                      {c.name} {c.variant && <span className="text-stone-500 font-normal">({c.variant})</span>}
                    </p>
                    <p className="text-xs text-stone-500">{money(c.price, cur)} each</p>
                    {c.notes && <p className="text-xs text-amber-700 italic mt-0.5">» {c.notes}</p>}
                  </div>
                  <p className="font-bold text-sm">{money(c.price * c.qty, cur)}</p>
                </div>
                <div className="flex items-center gap-2 mt-2 pl-4">
                  <div className="flex items-center rounded-lg border border-stone-200">
                    <button className="p-1.5 hover:bg-stone-100 rounded-l-lg" onClick={() => setQty(c.key, c.qty - 1)}>
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-sm font-bold">{c.qty}</span>
                    <button className="p-1.5 hover:bg-stone-100 rounded-r-lg" onClick={() => setQty(c.key, c.qty + 1)}>
                      <Plus size={14} />
                    </button>
                  </div>
                  <button className="btn-ghost btn-sm" onClick={() => setNoteFor(c)}>
                    <StickyNote size={14} /> Note
                  </button>
                  <button className="btn-ghost btn-sm text-rose-600 ml-auto" onClick={() => setQty(c.key, 0)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-stone-100 p-4 space-y-3 bg-stone-50/60">
          <div className="flex gap-2">
            <div className="flex rounded-xl border border-stone-300 bg-white overflow-hidden">
              <button className={`px-2.5 ${discountType === 'flat' ? 'bg-espresso-800 text-white' : 'text-stone-500'}`} onClick={() => setDiscountType('flat')} title="Flat">
                <IndianRupee size={14} />
              </button>
              <button className={`px-2.5 ${discountType === 'percent' ? 'bg-espresso-800 text-white' : 'text-stone-500'}`} onClick={() => setDiscountType('percent')} title="Percent">
                <Percent size={14} />
              </button>
            </div>
            <input className="input" type="number" min="0" placeholder="Discount" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
            <input className="input" placeholder="Order note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {customer?.points > 0 && (
            <div className="flex items-center gap-2">
              <Gift size={14} className="text-amber-600" />
              <input className="input py-1.5" type="number" min="0" max={customer.points} placeholder={`Redeem points (max ${customer.points})`} value={points} onChange={(e) => setPoints(String(Math.min(customer.points, Number(e.target.value) || 0) || ''))} />
            </div>
          )}

          <div className="text-sm space-y-1">
            <div className="flex justify-between text-stone-600">
              <span>Subtotal ({totals.items} items)</span>
              <span>{money2(totals.subTotal)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Discount</span>
                <span>-{money2(totals.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-stone-600">
              <span>
                {branch?.settings?.taxLabel || 'Tax'} {branch?.settings?.taxInclusive ? '(incl.)' : `@${branch?.settings?.taxRate}%`}
              </span>
              <span>{money2(totals.tax)}</span>
            </div>
            {totals.pointsValue > 0 && (
              <div className="flex justify-between text-amber-700">
                <span>Points</span>
                <span>-{money2(totals.pointsValue)}</span>
              </div>
            )}
            {totals.roundOff !== 0 && (
              <div className="flex justify-between text-stone-400 text-xs">
                <span>Round off</span>
                <span>{money2(totals.roundOff)}</span>
              </div>
            )}
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-dashed border-stone-300">
            <span className="font-bold text-espresso-900">Total</span>
            <span className="text-3xl font-extrabold text-espresso-950">{money(totals.grand, cur)}</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button className="btn-outline" disabled={!cart.length || busy} onClick={() => hold(false)}>
              <PauseCircle size={16} /> Hold
            </button>
            <button className="btn-outline" disabled={!cart.length || busy} onClick={() => hold(true)}>
              <ChefHat size={16} /> KOT
            </button>
            <button className="btn-accent" disabled={!cart.length || busy} onClick={() => setPayOpen(true)}>
              Pay <span className="text-[10px] opacity-60">F9</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Variant chooser */}
      <Modal open={!!variantFor} onClose={() => setVariantFor(null)} title={variantFor?.name} size="sm">
        <div className="grid grid-cols-2 gap-3">
          {variantFor?.variants.map((v) => (
            <button key={v.name} onClick={() => addToCart(variantFor, v)} className="card p-4 text-left hover:border-amber-400">
              <p className="font-semibold">{v.name}</p>
              <p className="text-espresso-700 font-bold">{money(v.price, cur)}</p>
            </button>
          ))}
        </div>
      </Modal>

      {/* Item note */}
      <Modal open={!!noteFor} onClose={() => setNoteFor(null)} title={`Note for ${noteFor?.name}`} size="sm">
        <NoteEditor
          initial={noteFor?.notes}
          onSave={(n) => {
            setCart((c) => c.map((x) => (x.key === noteFor.key ? { ...x, notes: n } : x)));
            setNoteFor(null);
          }}
        />
      </Modal>

      <PaymentModal open={payOpen} onClose={() => setPayOpen(false)} total={totals.grand} onPay={pay} busy={busy} cur={cur} />

      {/* Running / held orders */}
      <Modal open={heldOpen} onClose={() => setHeldOpen(false)} title="Running & held orders" size="lg">
        {held.length ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {held.map((o) => (
              <div key={o._id} className="card p-4">
                <div className="flex justify-between">
                  <div>
                    <p className="font-bold text-espresso-900">
                      Token #{o.tokenNo} {o.tableName && <span className="badge bg-espresso-100 text-espresso-800 ml-1">{o.tableName}</span>}
                    </p>
                    <p className="text-xs text-stone-500">
                      {o.invoiceNo} · {timeOnly(o.createdAt)} · <span className="capitalize">{o.orderType}</span>
                    </p>
                  </div>
                  <p className="font-extrabold">{money(o.grandTotal, cur)}</p>
                </div>
                <p className="text-xs text-stone-600 mt-2 line-clamp-2">{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</p>
                <div className="flex gap-2 mt-3">
                  <button className="btn-primary btn-sm flex-1" onClick={() => loadHeld(o)}>
                    Open / Settle
                  </button>
                  <button className="btn-outline btn-sm" onClick={() => printOrder(o, branch, 'kot')}>
                    <ChefHat size={14} />
                  </button>
                  <button className="btn-outline btn-sm" onClick={() => printOrder(o, branch, 'bill')} title="Print pro-forma bill">
                    <Printer size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty text="No running orders" />
        )}
      </Modal>

      {/* Success */}
      <Modal open={!!done} onClose={() => setDone(null)} title="Payment successful" size="sm">
        {done && (
          <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={36} />
            </div>
            <p className="text-3xl font-extrabold mt-3">{money(done.grandTotal, cur)}</p>
            <p className="text-sm text-stone-500">
              {done.invoiceNo} · Token #{done.tokenNo}
            </p>
            {done.changeDue > 0 && <p className="mt-3 rounded-xl bg-amber-50 text-amber-800 py-2 font-bold">Return change: {money(done.changeDue, cur)}</p>}
            {done.pointsEarned > 0 && <p className="text-xs text-emerald-700 mt-2">Customer earned {done.pointsEarned} points</p>}
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button className="btn-outline" onClick={() => printOrder(done, branch, 'bill')}>
                <Printer size={16} /> Print bill
              </button>
              <button className="btn-outline" onClick={() => printOrder(done, branch, 'kot')}>
                <ChefHat size={16} /> Print KOT
              </button>
            </div>
            <button className="btn-primary w-full mt-2" onClick={() => setDone(null)} autoFocus>
              New order
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function NoteEditor({ initial = '', onSave }) {
  const [v, setV] = useState(initial);
  const presets = ['Less sugar', 'No sugar', 'Extra hot', 'Less ice', 'Oat milk', 'Extra shot', 'Parcel'];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button key={p} className="btn-outline btn-sm" onClick={() => setV(v ? `${v}, ${p}` : p)}>
            {p}
          </button>
        ))}
      </div>
      <textarea className="input" rows={3} value={v} onChange={(e) => setV(e.target.value)} autoFocus />
      <button className="btn-primary w-full" onClick={() => onSave(v)}>
        Save note
      </button>
    </div>
  );
}
