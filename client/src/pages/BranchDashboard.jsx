import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import { IndianRupee, ShoppingBag, Receipt, Wallet, AlertTriangle, PauseCircle, ChefHat, ShoppingCart, XCircle, RefreshCw, CalendarDays } from 'lucide-react';
import api, { toastErr } from '../api';
import { useAuth } from '../context/AuthContext';
import { PageHeader, StatCard, Spinner, STATUS_BADGE, Empty } from '../components/ui';
import { money, compact, pctChange, CHART_COLORS, timeOnly } from '../utils/format';

export default function BranchDashboard() {
  const { currentBranch, branchId, isSuper, user } = useAuth();
  const [d, setD] = useState(null);

  const load = () =>
    api
      .get('/dashboard/branch')
      .then((r) => setD(r.data))
      .catch(toastErr);

  useEffect(() => {
    setD(null);
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  const name = currentBranch?.name || user.branch?.name;

  return (
    <div>
      <PageHeader title={`${name}`} subtitle={isSuper ? 'Branch dashboard (viewing as Super Admin)' : `Good to see you, ${user.name.split(' ')[0]} — here's today at a glance`}>
        <button className="btn-outline" onClick={load}>
          <RefreshCw size={16} /> Refresh
        </button>
        <Link to="/pos" className="btn-accent">
          <ShoppingCart size={16} /> New Bill
        </Link>
      </PageHeader>

      {!d ? (
        <Spinner />
      ) : (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="Today's Sales" value={money(d.today.sales)} icon={IndianRupee} change={pctChange(d.today.sales, d.yesterday.sales)} hint="vs yesterday" />
            <StatCard label="Orders Today" value={d.today.orders} icon={ShoppingBag} tone="amber" change={pctChange(d.today.orders, d.yesterday.orders)} hint={`${d.today.items} items`} />
            <StatCard label="Avg. Bill" value={money(d.today.avg)} icon={Receipt} tone="sky" />
            <StatCard label="Net Today" value={money(d.netToday)} icon={Wallet} tone="emerald" hint={`Expenses ${money(d.expensesToday)}`} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to="/pos" className="card px-5 py-4 flex items-center gap-3 hover:border-amber-300">
              <PauseCircle className="text-amber-600" size={22} />
              <div>
                <p className="text-xs text-stone-500 font-semibold uppercase">Held / Running</p>
                <p className="text-lg font-bold">{d.held}</p>
              </div>
            </Link>
            <Link to="/kitchen" className="card px-5 py-4 flex items-center gap-3 hover:border-amber-300">
              <ChefHat className="text-sky-600" size={22} />
              <div>
                <p className="text-xs text-stone-500 font-semibold uppercase">In Kitchen</p>
                <p className="text-lg font-bold">{d.kitchen}</p>
              </div>
            </Link>
            <div className="card px-5 py-4 flex items-center gap-3">
              <XCircle className="text-rose-600" size={22} />
              <div>
                <p className="text-xs text-stone-500 font-semibold uppercase">Cancelled Today</p>
                <p className="text-lg font-bold">{d.cancelled}</p>
              </div>
            </div>
            <div className="card px-5 py-4 flex items-center gap-3">
              <CalendarDays className="text-espresso-600" size={22} />
              <div>
                <p className="text-xs text-stone-500 font-semibold uppercase">This Month</p>
                <p className="text-lg font-bold">{compact(d.month.sales)}</p>
              </div>
            </div>
          </div>

          <div className="grid xl:grid-cols-3 gap-6">
            <div className="card p-5 xl:col-span-2">
              <h3 className="font-bold text-espresso-900 mb-4">Last 7 days</h3>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={d.week}>
                  <defs>
                    <linearGradient id="gw" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8f5a3a" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#8f5a3a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="day" tickFormatter={(v) => new Date(v).toLocaleDateString('en-IN', { weekday: 'short' })} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v) => compact(v)} fontSize={11} tickLine={false} axisLine={false} width={50} />
                  <Tooltip formatter={(v, n) => (n === 'sales' ? money(v) : v)} />
                  <Area type="monotone" dataKey="sales" stroke="#8f5a3a" strokeWidth={2.5} fill="url(#gw)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="card p-5">
              <h3 className="font-bold text-espresso-900 mb-4">Today by payment</h3>
              {d.payments.length ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={d.payments} dataKey="amount" nameKey="_id" innerRadius={50} outerRadius={80} paddingAngle={3}>
                        {d.payments.map((p, i) => (
                          <Cell key={p._id} fill={CHART_COLORS[i % 8]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => money(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-3">
                    {d.payments.map((p, i) => (
                      <div key={p._id} className="flex items-center gap-2 text-sm">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS[i % 8] }} />
                        <span className="uppercase text-xs font-semibold text-stone-500">{p._id}</span>
                        <span className="ml-auto font-semibold">{money(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <Empty text="No sales yet today" />
              )}
            </div>
          </div>

          <div className="grid xl:grid-cols-3 gap-6">
            <div className="card p-5 xl:col-span-2">
              <h3 className="font-bold text-espresso-900 mb-4">Hourly sales — today</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={d.hourly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="hour" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v) => compact(v)} fontSize={11} tickLine={false} axisLine={false} width={45} />
                  <Tooltip formatter={(v, n) => (n === 'sales' ? money(v) : v)} />
                  <Bar dataKey="sales" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card p-5">
              <h3 className="font-bold text-espresso-900 mb-4">Best sellers (7 days)</h3>
              <div className="space-y-3">
                {d.topItems.map((t, i) => {
                  const max = d.topItems[0]?.qty || 1;
                  return (
                    <div key={t._id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">
                          {i + 1}. {t._id}
                        </span>
                        <span className="text-stone-500">{t.qty}</span>
                      </div>
                      <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-espresso-600 to-amber-500 rounded-full" style={{ width: `${(t.qty / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
                {!d.topItems.length && <Empty text="No data" />}
              </div>
            </div>
          </div>

          <div className="grid xl:grid-cols-3 gap-6">
            <div className="card overflow-hidden xl:col-span-2">
              <div className="px-5 py-4 flex justify-between items-center">
                <h3 className="font-bold text-espresso-900">Recent orders</h3>
                <Link to="/orders" className="text-sm font-semibold text-espresso-700 hover:underline">
                  View all
                </Link>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Type</th>
                    <th>Time</th>
                    <th>Status</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recent.map((o) => (
                    <tr key={o._id}>
                      <td className="font-mono text-xs">{o.invoiceNo}</td>
                      <td className="capitalize">
                        {o.orderType}
                        {o.tableName && <span className="text-stone-400"> · {o.tableName}</span>}
                      </td>
                      <td className="text-stone-500">{timeOnly(o.createdAt)}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[o.status]}`}>{o.status}</span>
                      </td>
                      <td className="text-right font-semibold">{money(o.grandTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={18} className="text-amber-600" />
                <h3 className="font-bold text-espresso-900">Low stock alerts</h3>
              </div>
              {d.lowStock.length ? (
                <div className="space-y-2">
                  {d.lowStock.map((i) => (
                    <div key={i._id} className="flex justify-between items-center rounded-xl bg-amber-50 px-3 py-2">
                      <span className="text-sm font-medium">{i.name}</span>
                      <span className="text-xs font-bold text-amber-700">
                        {Math.round(i.stock)} / {i.minStock} {i.unit}
                      </span>
                    </div>
                  ))}
                  <Link to="/inventory" className="btn-outline btn-sm w-full mt-2">
                    Manage inventory
                  </Link>
                </div>
              ) : (
                <Empty text="All stock levels healthy" />
              )}
              <h4 className="font-bold text-espresso-900 mt-6 mb-3 text-sm">Order types today</h4>
              <div className="grid grid-cols-3 gap-2">
                {['dine-in', 'takeaway', 'delivery'].map((t) => {
                  const x = d.orderTypes.find((o) => o._id === t);
                  return (
                    <div key={t} className="rounded-xl bg-stone-50 p-3 text-center">
                      <p className="text-[11px] uppercase font-semibold text-stone-500">{t}</p>
                      <p className="font-bold">{x?.orders || 0}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
