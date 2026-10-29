import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { IndianRupee, ShoppingBag, Receipt, Wallet, Building2, Users, UserCog, ArrowRight, AlertTriangle, Trophy } from 'lucide-react';
import api, { toastErr } from '../api';
import { useAuth } from '../context/AuthContext';
import { PageHeader, StatCard, Spinner, STATUS_BADGE } from '../components/ui';
import { money, compact, daysAgo, ymd, pctChange, CHART_COLORS, dt } from '../utils/format';

const RANGES = [
  ['Today', 0],
  ['7 Days', 6],
  ['30 Days', 29],
  ['90 Days', 89],
];

export default function SuperDashboard() {
  const { setBranchId } = useAuth();
  const [range, setRange] = useState(6);
  const [d, setD] = useState(null);

  useEffect(() => {
    setD(null);
    api
      .get('/dashboard/overview', { params: { from: daysAgo(range), to: ymd() }, headers: { 'x-branch-id': 'all' } })
      .then((r) => setD(r.data))
      .catch(toastErr);
  }, [range]);

  return (
    <div>
      <PageHeader title="Head Office Dashboard" subtitle="Consolidated performance across every branch">
        <div className="flex rounded-xl bg-white border border-stone-200 p-1">
          {RANGES.map(([l, v]) => (
            <button key={v} onClick={() => setRange(v)} className={`btn btn-sm ${range === v ? 'bg-espresso-800 text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
              {l}
            </button>
          ))}
        </div>
      </PageHeader>

      {!d ? (
        <Spinner />
      ) : (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="Total Sales" value={money(d.total.sales)} icon={IndianRupee} change={pctChange(d.total.sales, d.previous.sales)} hint="vs previous period" />
            <StatCard label="Orders" value={d.total.orders.toLocaleString('en-IN')} icon={ShoppingBag} tone="amber" change={pctChange(d.total.orders, d.previous.orders)} hint={`${d.total.items} items sold`} />
            <StatCard label="Avg. Bill Value" value={money(d.total.avg)} icon={Receipt} tone="sky" change={pctChange(d.total.avg, d.previous.avg)} />
            <StatCard label="Net (after expenses)" value={money(d.total.net)} icon={Wallet} tone={d.total.net >= 0 ? 'emerald' : 'rose'} hint={`Expenses ${money(d.total.expenses)}`} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              [Building2, 'Branches', `${d.counts.activeBranches}/${d.counts.branches} active`],
              [UserCog, 'Staff', d.counts.staff],
              [Users, 'Customers', d.counts.customers],
            ].map(([Icon, l, v]) => (
              <div key={l} className="card px-5 py-4 flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-espresso-100 text-espresso-700">
                  <Icon size={18} />
                </div>
                <div>
                  <p className="text-xs text-stone-500 font-semibold uppercase">{l}</p>
                  <p className="font-bold text-lg text-espresso-950">{v}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid xl:grid-cols-3 gap-6">
            <div className="card p-5 xl:col-span-2">
              <h3 className="font-bold text-espresso-900 mb-4">Sales trend by branch</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={d.trend}>
                  <defs>
                    {d.branchCodes.map((b, i) => (
                      <linearGradient key={b.code} id={`g${b.code}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS[i % 8]} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={CHART_COLORS[i % 8]} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="day" tickFormatter={(v) => v.slice(5)} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v) => compact(v)} fontSize={11} tickLine={false} axisLine={false} width={55} />
                  <Tooltip formatter={(v) => money(v)} />
                  <Legend />
                  {d.branchCodes.map((b, i) => (
                    <Area key={b.code} type="monotone" dataKey={b.code} name={b.name} stroke={CHART_COLORS[i % 8]} fill={`url(#g${b.code})`} strokeWidth={2} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="card p-5">
              <h3 className="font-bold text-espresso-900 mb-4">Revenue share</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={d.branches.filter((b) => b.sales > 0)} dataKey="sales" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={3}>
                    {d.branches.map((b, i) => (
                      <Cell key={b._id} fill={CHART_COLORS[i % 8]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => money(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-espresso-900">Branch performance</h3>
              <span className="text-xs text-stone-500">Click a branch to open its dashboard</span>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Branch</th>
                    <th className="text-right">Sales</th>
                    <th className="text-right">Orders</th>
                    <th className="text-right">Avg Bill</th>
                    <th className="text-right">Expenses</th>
                    <th className="text-right">Net</th>
                    <th>Share</th>
                    <th className="text-center">Alerts</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {d.branches.map((b, i) => (
                    <tr key={b._id} className="cursor-pointer" onClick={() => setBranchId(b._id)}>
                      <td>{i === 0 && b.sales > 0 ? <Trophy size={16} className="text-amber-500" /> : i + 1}</td>
                      <td>
                        <p className="font-semibold text-espresso-900">{b.name}</p>
                        <p className="text-xs text-stone-500">
                          {b.code} · {b.city || '—'} · {b.staff} staff {!b.active && <span className="badge bg-rose-50 text-rose-600 ml-1">inactive</span>}
                        </p>
                      </td>
                      <td className="text-right font-bold">{money(b.sales)}</td>
                      <td className="text-right">{b.orders}</td>
                      <td className="text-right">{money(b.avg)}</td>
                      <td className="text-right text-rose-600">{money(b.expenses)}</td>
                      <td className={`text-right font-semibold ${b.net >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{money(b.net)}</td>
                      <td className="w-40">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-stone-100 overflow-hidden">
                            <div className="h-full rounded-full bg-amber-500" style={{ width: `${b.share}%` }} />
                          </div>
                          <span className="text-xs w-10 text-right">{b.share}%</span>
                        </div>
                      </td>
                      <td className="text-center">
                        {b.lowStock > 0 && (
                          <span className="badge bg-amber-50 text-amber-700" title="Low stock items">
                            <AlertTriangle size={12} /> {b.lowStock}
                          </span>
                        )}
                        {b.cancelled > 0 && <span className="badge bg-rose-50 text-rose-600 ml-1">{b.cancelled} cxl</span>}
                      </td>
                      <td>
                        <ArrowRight size={16} className="text-stone-400" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid xl:grid-cols-3 gap-6">
            <div className="card p-5">
              <h3 className="font-bold text-espresso-900 mb-4">Branch comparison</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={d.branches}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="code" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v) => compact(v)} fontSize={11} tickLine={false} axisLine={false} width={50} />
                  <Tooltip formatter={(v) => money(v)} />
                  <Bar dataKey="sales" name="Sales" fill="#8f5a3a" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card p-5">
              <h3 className="font-bold text-espresso-900 mb-4">Top selling items (all branches)</h3>
              <div className="space-y-3">
                {d.topItems.map((t, i) => (
                  <div key={t._id} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-espresso-100 text-espresso-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    <span className="flex-1 text-sm font-medium truncate">{t._id}</span>
                    <span className="text-xs text-stone-500">{t.qty} sold</span>
                    <span className="text-sm font-semibold w-20 text-right">{compact(t.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="font-bold text-espresso-900 mb-4">Payment methods</h3>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={d.payments} dataKey="amount" nameKey="_id" outerRadius={75} innerRadius={45}>
                    {d.payments.map((p, i) => (
                      <Cell key={p._id} fill={CHART_COLORS[i % 8]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => money(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {d.payments.map((p, i) => (
                  <div key={p._id} className="flex items-center gap-2 text-sm">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS[i % 8] }} />
                    <span className="uppercase text-xs font-semibold text-stone-500">{p._id}</span>
                    <span className="ml-auto font-semibold">{compact(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <h3 className="font-bold text-espresso-900 px-5 py-4">Live feed — latest bills across branches</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Branch</th>
                  <th>Type</th>
                  <th>Customer</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {d.recent.map((o) => (
                  <tr key={o._id}>
                    <td className="font-mono text-xs">{o.invoiceNo}</td>
                    <td>{o.branch?.name}</td>
                    <td className="capitalize">{o.orderType}</td>
                    <td>{o.customerName || '—'}</td>
                    <td className="text-stone-500">{dt(o.createdAt)}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[o.status]}`}>{o.status}</span>
                    </td>
                    <td className="text-right font-semibold">{money(o.grandTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
