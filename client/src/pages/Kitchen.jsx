import { useEffect, useRef, useState } from 'react';
import { ChefHat, Clock, Flame, CheckCircle2, BellRing, Volume2, VolumeX, Maximize } from 'lucide-react';
import api, { toastErr } from '../api';
import { useAuth } from '../context/AuthContext';
import { NeedBranch, Spinner, Empty } from '../components/ui';

const COLS = [
  { key: 'new', title: 'New', icon: BellRing, tone: 'border-sky-400 bg-sky-50', next: 'preparing', action: 'Start' },
  { key: 'preparing', title: 'Preparing', icon: Flame, tone: 'border-amber-400 bg-amber-50', next: 'ready', action: 'Mark ready' },
  { key: 'ready', title: 'Ready to serve', icon: CheckCircle2, tone: 'border-emerald-400 bg-emerald-50', next: 'served', action: 'Served' },
];

const mins = (d) => Math.floor((Date.now() - new Date(d)) / 60000);

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    o.frequency.value = 880;
    o.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.25);
  } catch {
    /* audio blocked */
  }
}

export default function Kitchen() {
  const { isAllBranches, branchId } = useAuth();
  const [orders, setOrders] = useState(null);
  const [sound, setSound] = useState(true);
  const [, tick] = useState(0);
  const seen = useRef(new Set());

  const load = () =>
    api
      .get('/orders/kitchen')
      .then(({ data }) => {
        const fresh = data.filter((o) => o.kotStatus === 'new' && !seen.current.has(o._id));
        if (seen.current.size && fresh.length && sound) beep();
        data.forEach((o) => seen.current.add(o._id));
        setOrders(data);
      })
      .catch(toastErr);

  useEffect(() => {
    if (isAllBranches) return;
    seen.current = new Set();
    setOrders(null);
    load();
    const t = setInterval(() => {
      load();
      tick((x) => x + 1);
    }, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, isAllBranches, sound]);

  const move = async (o, kotStatus) => {
    setOrders((list) => list.map((x) => (x._id === o._id ? { ...x, kotStatus } : x)).filter((x) => x.kotStatus !== 'served'));
    try {
      await api.patch(`/orders/${o._id}/kot`, { kotStatus });
    } catch (e) {
      toastErr(e);
      load();
    }
  };

  if (isAllBranches) return <NeedBranch what="the kitchen display" />;
  if (!orders) return <Spinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-espresso-900 text-amber-400">
            <ChefHat size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-espresso-900">Kitchen Display</h1>
            <p className="text-sm text-stone-500">Auto-refreshes every 8 seconds</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-outline" onClick={() => setSound(!sound)}>
            {sound ? <Volume2 size={16} /> : <VolumeX size={16} />} Sound
          </button>
          <button className="btn-outline" onClick={() => document.documentElement.requestFullscreen?.()}>
            <Maximize size={16} /> Fullscreen
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {COLS.map((c) => {
          const list = orders.filter((o) => o.kotStatus === c.key);
          return (
            <div key={c.key} className="rounded-2xl bg-stone-100/70 p-3 min-h-[60vh]">
              <div className="flex items-center gap-2 px-2 py-1 mb-3">
                <c.icon size={18} className="text-espresso-700" />
                <h2 className="font-bold text-espresso-900">{c.title}</h2>
                <span className="badge bg-white text-stone-700 ml-auto">{list.length}</span>
              </div>
              <div className="space-y-3">
                {list.map((o) => {
                  const m = mins(o.createdAt);
                  return (
                    <div key={o._id} className={`rounded-2xl border-l-4 bg-white shadow-sm p-4 ${c.tone.split(' ')[0]}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-2xl font-extrabold text-espresso-950">#{o.tokenNo}</p>
                          <p className="text-xs uppercase font-semibold text-stone-500">
                            {o.orderType}
                            {o.tableName && ` · ${o.tableName}`}
                          </p>
                        </div>
                        <span className={`badge ${m >= 15 ? 'bg-rose-100 text-rose-700' : m >= 8 ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-600'}`}>
                          <Clock size={12} /> {m}m
                        </span>
                      </div>
                      <ul className="mt-3 space-y-1.5">
                        {o.items.map((i, k) => (
                          <li key={k} className="text-sm">
                            <span className="font-extrabold text-espresso-800 mr-1">{i.qty}×</span>
                            <span className="font-medium">{i.name}</span>
                            {i.variant && <span className="text-stone-500"> ({i.variant})</span>}
                            {i.notes && <p className="text-xs text-amber-700 italic pl-6">» {i.notes}</p>}
                          </li>
                        ))}
                      </ul>
                      {o.note && <p className="mt-2 text-xs rounded-lg bg-amber-50 text-amber-800 px-2 py-1">Note: {o.note}</p>}
                      <button className={`btn w-full mt-3 ${c.key === 'ready' ? 'btn-success' : 'btn-primary'}`} onClick={() => move(o, c.next)}>
                        {c.action}
                      </button>
                    </div>
                  );
                })}
                {!list.length && <Empty text="No tickets" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
