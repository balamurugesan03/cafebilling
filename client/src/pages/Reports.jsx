import { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from 'recharts';
import { Download, Printer, IndianRupee, ShoppingBag, Percent, Receipt, TrendingUp, XCircle, Wallet, PiggyBank } from 'lucide-react';
import api, { toastErr } from '../api';
import { useAuth } from '../context/AuthContext';
import { PageHeader, StatCard, Spinner, Empty } from '../components/ui';
import { money, compact, ymd, daysAgo, downloadCSV, dateOnly } from '../utils/format';
import { printHTML } from '../utils/print';

const PRESETS = [
  ['Today', 0, 0],
  ['Yesterday', 1, 1],
  ['Last 7 days', 6, 0],
  ['Last 30 days', 29, 0],
];

const TABS = [
  ['items', 'Item-wise'],
  ['categories', 'Category-wise'],
  ['daily', 'Day-wise'],
  ['payments', 'Payment-wise'],
  ['cashiers', 'Cashier-wise'],
  ['hourly', 'Hourly'],
  ['branches', 'Branch-wise'],
  ['expenses', 'Expenses'],
];

const COLS = {
  items: [['name', 'Item'], ['variant', 'Variant'], ['category', 'Category'], ['qty', 'Qty', 'n'], ['revenue', 'Revenue', 'm']],
  categories: [['name', 'Category'], ['qty', 'Qty', 'n'], ['revenue', 'Revenue', 'm']],
  daily: [['day', 'Date'], ['orders', 'Orders', 'n'], ['gross', 'Gross', 'm'], ['discount', 'Discount', 'm'], ['tax', 'Tax', 'm'], ['net', 'Net', 'm']],
  payments: [['method', 'Method'], ['count', 'Transactions', 'n'], ['amount', 'Amount', 'm']],
  cashiers: [['name', 'Cashier'], ['orders', 'Orders', 'n'], ['amount', 'Amount', 'm']],
  hourly: [['hour', 'Hour'], ['orders', 'Orders', 'n'], ['amount', 'Amount', 'm']],
  branches: [['name', 'Branch'], ['orders', 'Orders', 'n'], ['amount', 'Amount', 'm']],
  expenses: [['category', 'Category'], ['amount', 'Amount', 'm']],
};

export default function Reports() {
  const { branchId, currentBranch, isAllBranches } = useAuth();
  const [range, setRange] = useState({ from: daysAgo(6), to: ymd() });
  const [tab, setTab] = useState('items');
  const [d, setD] = useState(null);

  useEffect(() => {
    setD(null);
    api
      .get('/reports/sales', { params: range })
      .then((r) => setD(r.data))
      .catch(toastErr);
  }, [range, branchId]);

  const rows = d?.[tab] || [];
  const cols = COLS[tab];
  const scope = isAllBranches ? 'All branches' : currentBranch?.name || '';

  const printReport = () => {
    const s = d.summary;
    const line = (l, v) => `<div class="row"><span>${l}</span><span>${v}</span></div>`;
    printHTML(`<!doctype html><html><head><meta charset="utf-8"><style>
      @page{size:80mm auto;margin:0} body{font-family:'Courier New',monospace;font-size:12px;width:80mm;padding:3mm;margin:0}
      .c{text-align:center}.row{display:flex;justify-content:space-between}hr{border:0;border-top:1px dashed #000}.b{font-weight:700}
      </style></head><body>
      <div class="c b" style="font-size:16px">SALES SUMMARY</div><div class="c">${scope}</div>
      <div class="c">${range.from} to ${range.to}</div><hr/>
      ${line('Orders', s.orders)}${line('Items sold', s.items)}${line('Gross sales', s.gross.toFixed(2))}
      ${line('Discount', '-' + s.discount.toFixed(2))}${line('Tax collected', s.tax.toFixed(2))}${line('Points redeemed', '-' + s.points.toFixed(2))}
      <hr/>${line('<b>NET SALES</b>', '<b>' + s.net.toFixed(2) + '</b>')}<hr/>
      ${d.payments.map((p) => line(p.method.toUpperCase(), p.amount.toFixed(2))).join('')}<hr/>
      ${line('Cancelled', `${s.cancelledCount} (${s.cancelledAmount.toFixed(2)})`)}${line('Expenses', s.expenses.toFixed(2))}
      <hr/><div class="b">Top items</div>${d.items.slice(0, 10).map((i) => line(`${i.qty} x ${i.name}`, i.revenue.toFixed(2))).join('')}
      <hr/><div class="c">Printed ${new Date().toLocaleString('en-IN')}</div></body></html>`);
  };

  return (
    <div>
      <PageHeader title="Reports" subtitle={`${scope} · ${dateOnly(range.from)} – ${dateOnly(range.to)}`}>
        {PRESETS.map(([l, a, b]) => (
          <button key={l} className="btn-outline btn-sm" onClick={() => setRange({ from: daysAgo(a), to: daysAgo(b) })}>
            {l}
          </button>
        ))}
        <input type="date" className="input w-38" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        <input type="date" className="input w-38" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        <button className="btn-primary" onClick={printReport} disabled={!d}>
          <Printer size={16} /> Print Z-report
        </button>
      </PageHeader>

      {!d ? (
        <Spinner />
      ) : (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="Net sales" value={money(d.summary.net)} icon={IndianRupee} />
            <StatCard label="Orders" value={d.summary.orders} icon={ShoppingBag} tone="amber" hint={`${d.summary.items} items · avg ${money(d.summary.avg)}`} />
            <StatCard label="Tax collected" value={money(d.summary.tax)} icon={Receipt} tone="sky" />
            <StatCard label="Discounts" value={money(d.summary.discount)} icon={Percent} tone="violet" hint={`Points ${money(d.summary.points)}`} />
            <StatCard label="Gross sales" value={money(d.summary.gross)} icon={TrendingUp} tone="emerald" />
            <StatCard label="Cancelled" value={d.summary.cancelledCount} icon={XCircle} tone="rose" hint={money(d.summary.cancelledAmount)} />
            <StatCard label="Expenses" value={money(d.summary.expenses)} icon={Wallet} tone="rose" />
            <StatCard label="Profit (net − tax − exp.)" value={money(d.summary.profit)} icon={PiggyBank} tone={d.summary.profit >= 0 ? 'emerald' : 'rose'} />
          </div>

          <div className="card p-5">
            <h3 className="font-bold text-espresso-900 mb-4">Daily net sales</h3>
            {d.daily.length ? (
              <ResponsiveContainer width="100%" height={240}>
                {d.daily.length > 1 ? (
                  <LineChart data={d.daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                    <XAxis dataKey="day" tickFormatter={(v) => v.slice(5)} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(v) => compact(v)} fontSize={11} tickLine={false} axisLine={false} width={50} />
                    <Tooltip formatter={(v) => money(v)} />
                    <Line type="monotone" dataKey="net" stroke="#8f5a3a" strokeWidth={2.5} dot={false} />
                  </LineChart>
                ) : (
                  <BarChart data={d.hourly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                    <XAxis dataKey="hour" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(v) => compact(v)} fontSize={11} tickLine={false} axisLine={false} width={50} />
                    <Tooltip formatter={(v) => money(v)} />
                    <Bar dataKey="amount" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            ) : (
              <Empty text="No sales in this period" />
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center gap-1 p-3 border-b border-stone-100">
              {TABS.filter(([k]) => k !== 'branches' || isAllBranches).map(([k, l]) => (
                <button key={k} className={`btn btn-sm ${tab === k ? 'bg-espresso-800 text-white' : 'text-stone-600 hover:bg-stone-100'}`} onClick={() => setTab(k)}>
                  {l}
                </button>
              ))}
              <button
                className="btn-outline btn-sm ml-auto"
                disabled={!rows.length}
                onClick={() => downloadCSV(`${tab}_${range.from}_${range.to}.csv`, rows.map((r) => Object.fromEntries(cols.map(([k, l]) => [l, r[k]]))))}
              >
                <Download size={14} /> CSV
              </button>
            </div>
            {rows.length ? (
              <div className="overflow-x-auto max-h-[500px]">
                <table className="table">
                  <thead className="sticky top-0">
                    <tr>
                      <th>#</th>
                      {cols.map(([k, l, t]) => (
                        <th key={k} className={t ? 'text-right' : ''}>
                          {l}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td className="text-stone-400">{i + 1}</td>
                        {cols.map(([k, , t]) => (
                          <td key={k} className={`${t ? 'text-right' : ''} ${t === 'm' ? 'font-semibold' : ''} ${k === 'method' ? 'uppercase' : ''}`}>
                            {t === 'm' ? money(r[k]) : r[k] || (t ? 0 : '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty text="No data" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
