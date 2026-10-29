import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Search, Eye, Printer, ChefHat, XCircle, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import api, { toastErr } from '../api';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Modal, Spinner, Empty, STATUS_BADGE } from '../components/ui';
import { money, money2, dt, ymd, daysAgo, downloadCSV } from '../utils/format';
import { printOrder } from '../utils/print';

export default function Orders() {
  const { branchId, isAllBranches, can } = useAuth();
  const [f, setF] = useState({ from: daysAgo(0), to: ymd(), status: '', orderType: '', payment: '', search: '' });
  const [page, setPage] = useState(1);
  const [res, setRes] = useState(null);
  const [view, setView] = useState(null);

  const load = () => {
    setRes(null);
    api
      .get('/orders', { params: { ...f, page, limit: 25 } })
      .then((r) => setRes(r.data))
      .catch(toastErr);
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, page, branchId]);

  const open = async (id) => {
    try {
      const { data } = await api.get(`/orders/${id}`);
      setView(data);
    } catch (e) {
      toastErr(e);
    }
  };

  const cancel = async () => {
    const reason = prompt('Reason for cancellation?');
    if (reason === null) return;
    try {
      const { data } = await api.patch(`/orders/${view._id}/cancel`, { reason });
      toast.success('Order cancelled');
      setView({ ...view, ...data });
      load();
    } catch (e) {
      toastErr(e);
    }
  };

  const exportCSV = async () => {
    const { data } = await api.get('/orders', { params: { ...f, page: 1, limit: 200 } });
    downloadCSV(
      `orders_${f.from}_${f.to}.csv`,
      data.data.map((o) => ({
        Invoice: o.invoiceNo,
        Branch: o.branch?.name,
        Date: new Date(o.createdAt).toLocaleString('en-IN'),
        Type: o.orderType,
        Table: o.tableName,
        Customer: o.customerName,
        Phone: o.customerPhone,
        Items: o.items.reduce((a, i) => a + i.qty, 0),
        SubTotal: o.subTotal,
        Discount: o.discountAmount,
        Tax: o.taxAmount,
        Total: o.grandTotal,
        Payment: o.payments.map((p) => `${p.method}:${p.amount}`).join(' | '),
        Status: o.status,
        Cashier: o.cashierName,
      }))
    );
  };

  const set = (k) => (e) => {
    setPage(1);
    setF({ ...f, [k]: e.target.value });
  };

  return (
    <div>
      <PageHeader title="Orders" subtitle={isAllBranches ? 'All branches' : 'Bills, KOTs and cancellations'}>
        <button className="btn-outline" onClick={exportCSV}>
          <Download size={16} /> Export CSV
        </button>
      </PageHeader>

      <div className="card p-4 mb-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="relative col-span-2 md:col-span-3 xl:col-span-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input className="input pl-9" placeholder="Invoice, customer, phone…" value={f.search} onChange={set('search')} />
        </div>
        <input type="date" className="input" value={f.from} onChange={set('from')} />
        <input type="date" className="input" value={f.to} onChange={set('to')} />
        <select className="input" value={f.status} onChange={set('status')}>
          <option value="">All status</option>
          <option value="completed">Completed</option>
          <option value="held">Held / Running</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select className="input" value={f.payment} onChange={set('payment')}>
          <option value="">All payments</option>
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
          <option value="card">Card</option>
          <option value="wallet">Wallet</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {!res ? (
          <Spinner />
        ) : !res.data.length ? (
          <Empty text="No orders for these filters" />
        ) : (
          <>
            <div className="px-4 py-3 flex justify-between text-sm bg-stone-50 border-b border-stone-200">
              <span>
                <b>{res.total}</b> orders
              </span>
              <span>
                Completed sales: <b className="text-espresso-900">{money(res.sum)}</b>
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    {isAllBranches && <th>Branch</th>}
                    <th>Date</th>
                    <th>Type</th>
                    <th>Customer</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th className="text-right">Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {res.data.map((o) => (
                    <tr key={o._id}>
                      <td>
                        <p className="font-mono text-xs font-semibold">{o.invoiceNo}</p>
                        <p className="text-[11px] text-stone-400">Token #{o.tokenNo}</p>
                      </td>
                      {isAllBranches && <td>{o.branch?.name}</td>}
                      <td className="text-stone-500 whitespace-nowrap">{dt(o.createdAt)}</td>
                      <td className="capitalize">
                        {o.orderType}
                        {o.tableName && <span className="text-stone-400"> · {o.tableName}</span>}
                      </td>
                      <td>
                        {o.customerName || '—'}
                        {o.customerPhone && <p className="text-[11px] text-stone-400">{o.customerPhone}</p>}
                      </td>
                      <td className="uppercase text-xs font-semibold text-stone-600">{o.payments.map((p) => p.method).join(' + ') || '—'}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[o.status]}`}>{o.status}</span>
                      </td>
                      <td className="text-right font-bold">{money(o.grandTotal)}</td>
                      <td>
                        <button className="btn-ghost btn-sm" onClick={() => open(o._id)}>
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-end gap-2 p-3">
              <span className="text-sm text-stone-500">
                Page {res.page} of {res.pages || 1}
              </span>
              <button className="btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft size={14} />
              </button>
              <button className="btn-outline btn-sm" disabled={page >= res.pages} onClick={() => setPage(page + 1)}>
                <ChevronRight size={14} />
              </button>
            </div>
          </>
        )}
      </div>

      <Modal
        open={!!view}
        onClose={() => setView(null)}
        title={view ? `Order ${view.invoiceNo}` : ''}
        size="md"
        footer={
          view && (
            <>
              {can('superadmin', 'manager') && view.status !== 'cancelled' && (
                <button className="btn-danger mr-auto" onClick={cancel}>
                  <XCircle size={16} /> Cancel order
                </button>
              )}
              <button className="btn-outline" onClick={() => printOrder(view, view.branch, 'kot')}>
                <ChefHat size={16} /> KOT
              </button>
              <button className="btn-primary" onClick={() => printOrder(view, view.branch, 'bill')}>
                <Printer size={16} /> Reprint bill
              </button>
            </>
          )
        }
      >
        {view && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Branch', view.branch?.name],
                ['Date', new Date(view.createdAt).toLocaleString('en-IN')],
                ['Type', `${view.orderType}${view.tableName ? ' · ' + view.tableName : ''}`],
                ['Cashier', view.cashierName],
                ['Customer', `${view.customerName || '—'} ${view.customerPhone || ''}`],
                ['Status', view.status + (view.cancelReason ? ` (${view.cancelReason})` : '')],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="label">{k}</p>
                  <p className="capitalize">{v}</p>
                </div>
              ))}
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Rate</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {view.items.map((i, k) => (
                  <tr key={k}>
                    <td>
                      {i.name} {i.variant && <span className="text-stone-500">({i.variant})</span>}
                      {i.notes && <p className="text-xs italic text-amber-700">{i.notes}</p>}
                    </td>
                    <td className="text-right">{i.qty}</td>
                    <td className="text-right">{money2(i.price)}</td>
                    <td className="text-right">{money2(i.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ml-auto max-w-xs space-y-1">
              {[
                ['Subtotal', view.subTotal],
                view.discountAmount ? ['Discount', -view.discountAmount] : null,
                ['Tax', view.taxAmount],
                view.pointsValue ? ['Points', -view.pointsValue] : null,
                ['Round off', view.roundOff],
              ]
                .filter(Boolean)
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between text-stone-600">
                    <span>{k}</span>
                    <span>{money2(v)}</span>
                  </div>
                ))}
              <div className="flex justify-between text-lg font-extrabold pt-2 border-t">
                <span>Total</span>
                <span>{money(view.grandTotal)}</span>
              </div>
              {view.payments.map((p, i) => (
                <div key={i} className="flex justify-between text-xs text-stone-500 uppercase">
                  <span>
                    {p.method} {p.ref && `(${p.ref})`}
                  </span>
                  <span>{money2(p.amount)}</span>
                </div>
              ))}
              {view.changeDue > 0 && (
                <div className="flex justify-between text-xs text-stone-500">
                  <span>CHANGE</span>
                  <span>{money2(view.changeDue)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
