import { Router } from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Expense from '../models/Expense.js';
import Branch from '../models/Branch.js';
import User from '../models/User.js';
import Customer from '../models/Customer.js';
import { InventoryItem } from '../models/Inventory.js';
import { protect, allow, branchScope, requireBranch } from '../middleware/auth.js';
import { startOfDay, endOfDay, addDays, parseRange, TZ, round2 } from '../utils/dates.js';

const r = Router();
r.use(protect, branchScope, allow('superadmin', 'manager', 'cashier'));

const oid = (id) => new mongoose.Types.ObjectId(id);

async function salesSummary(match) {
  const [s] = await Order.aggregate([
    { $match: { ...match, status: 'completed' } },
    {
      $group: {
        _id: null,
        sales: { $sum: '$grandTotal' },
        orders: { $sum: 1 },
        tax: { $sum: '$taxAmount' },
        discount: { $sum: '$discountAmount' },
        items: { $sum: { $sum: '$items.qty' } },
      },
    },
  ]);
  const sales = round2(s?.sales || 0);
  const orders = s?.orders || 0;
  return { sales, orders, avg: orders ? round2(sales / orders) : 0, tax: round2(s?.tax || 0), discount: round2(s?.discount || 0), items: s?.items || 0 };
}

const dailyTrend = (match, groupBranch = false) =>
  Order.aggregate([
    { $match: { ...match, status: 'completed' } },
    {
      $group: {
        _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ() } }, ...(groupBranch && { branch: '$branch' }) },
        sales: { $sum: '$grandTotal' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { '_id.day': 1 } },
  ]);

const topItems = (match, limit = 5) =>
  Order.aggregate([
    { $match: { ...match, status: 'completed' } },
    { $unwind: '$items' },
    { $group: { _id: '$items.name', qty: { $sum: '$items.qty' }, revenue: { $sum: '$items.total' } } },
    { $sort: { qty: -1 } },
    { $limit: limit },
  ]);

const paymentSplit = (match) =>
  Order.aggregate([
    { $match: { ...match, status: 'completed' } },
    { $unwind: '$payments' },
    { $group: { _id: '$payments.method', amount: { $sum: { $subtract: ['$payments.amount', { $cond: [{ $eq: ['$payments.method', 'cash'] }, '$changeDue', 0] }] } } } },
    { $sort: { amount: -1 } },
  ]);

const typeSplit = (match) =>
  Order.aggregate([
    { $match: { ...match, status: 'completed' } },
    { $group: { _id: '$orderType', orders: { $sum: 1 }, amount: { $sum: '$grandTotal' } } },
  ]);

const expenseTotal = async (match) => {
  const [e] = await Expense.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
  return round2(e?.total || 0);
};

function fillDays(rows, from, days) {
  const map = new Map(rows.map((x) => [x._id.day, x]));
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(from, i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const row = map.get(key);
    return { day: key, sales: round2(row?.sales || 0), orders: row?.orders || 0 };
  });
}

// ---------------- Branch dashboard ----------------
r.get('/branch', requireBranch, async (req, res) => {
  const branch = oid(req.branchId);
  const today = { branch, createdAt: { $gte: startOfDay(), $lte: endOfDay() } };
  const yest = { branch, createdAt: { $gte: startOfDay(addDays(new Date(), -1)), $lte: endOfDay(addDays(new Date(), -1)) } };
  const weekFrom = startOfDay(addDays(new Date(), -6));
  const month = { branch, createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } };

  const [todayS, yestS, monthS, hourly, week, top, payments, types, expensesToday, lowStock, recent, held, cancelled, kitchen] = await Promise.all([
    salesSummary(today),
    salesSummary(yest),
    salesSummary(month),
    Order.aggregate([
      { $match: { ...today, status: 'completed' } },
      { $group: { _id: { $hour: { date: '$createdAt', timezone: TZ() } }, sales: { $sum: '$grandTotal' }, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    dailyTrend({ branch, createdAt: { $gte: weekFrom } }),
    topItems({ branch, createdAt: { $gte: startOfDay(addDays(new Date(), -6)) } }, 6),
    paymentSplit(today),
    typeSplit(today),
    expenseTotal({ branch, date: { $gte: startOfDay(), $lte: endOfDay() } }),
    InventoryItem.find({ branch, $expr: { $lte: ['$stock', '$minStock'] } }).limit(10),
    Order.find({ branch }).sort({ createdAt: -1 }).limit(8).select('invoiceNo grandTotal status orderType createdAt customerName tableName payments'),
    Order.countDocuments({ branch, status: 'held' }),
    Order.countDocuments({ ...today, status: 'cancelled' }),
    Order.countDocuments({ branch, status: { $ne: 'cancelled' }, kotStatus: { $in: ['new', 'preparing'] }, createdAt: { $gte: addDays(new Date(), -1) } }),
  ]);

  const hours = Array.from({ length: 24 }, (_, h) => {
    const x = hourly.find((y) => y._id === h);
    return { hour: `${h}:00`, sales: round2(x?.sales || 0), orders: x?.orders || 0 };
  }).filter((_, h) => h >= 6 && h <= 23);

  res.json({
    today: todayS,
    yesterday: yestS,
    month: monthS,
    expensesToday,
    netToday: round2(todayS.sales - expensesToday),
    hourly: hours,
    week: fillDays(week, weekFrom, 7),
    topItems: top,
    payments,
    orderTypes: types,
    lowStock,
    recent,
    held,
    cancelled,
    kitchen,
  });
});

// ---------------- Super admin: all branches overview ----------------
r.get('/overview', allow('superadmin'), async (req, res) => {
  const { from, to } = parseRange(req.query);
  const days = Math.max(1, Math.round((startOfDay(to) - startOfDay(from)) / 86400000) + 1);
  const range = { createdAt: { $gte: from, $lte: to } };

  const prevFrom = addDays(from, -days);
  const prevTo = addDays(to, -days);

  const [branches, total, prev, perBranch, trendRows, top, payments, types, expByBranch, staff, customers, lowStock, recent] = await Promise.all([
    Branch.find().sort({ createdAt: 1 }),
    salesSummary(range),
    salesSummary({ createdAt: { $gte: prevFrom, $lte: prevTo } }),
    Order.aggregate([
      { $match: { ...range, status: { $in: ['completed', 'cancelled'] } } },
      {
        $group: {
          _id: '$branch',
          sales: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$grandTotal', 0] } },
          orders: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          discount: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$discountAmount', 0] } },
          tax: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$taxAmount', 0] } },
        },
      },
    ]),
    dailyTrend({ createdAt: { $gte: startOfDay(from), $lte: to } }, true),
    topItems(range, 8),
    paymentSplit(range),
    typeSplit(range),
    Expense.aggregate([{ $match: { date: { $gte: from, $lte: to } } }, { $group: { _id: '$branch', total: { $sum: '$amount' } } }]),
    User.aggregate([{ $match: { role: { $ne: 'superadmin' }, active: true } }, { $group: { _id: '$branch', count: { $sum: 1 } } }]),
    Customer.countDocuments(),
    InventoryItem.aggregate([{ $match: { $expr: { $lte: ['$stock', '$minStock'] } } }, { $group: { _id: '$branch', count: { $sum: 1 } } }]),
    Order.find({ status: { $ne: 'held' } }).sort({ createdAt: -1 }).limit(10).select('invoiceNo grandTotal status orderType createdAt branch customerName').populate('branch', 'name code'),
  ]);

  const find = (arr, id) => arr.find((x) => String(x._id) === String(id));
  const branchStats = branches.map((b) => {
    const s = find(perBranch, b._id) || {};
    const exp = round2(find(expByBranch, b._id)?.total || 0);
    const sales = round2(s.sales || 0);
    return {
      _id: b._id,
      name: b.name,
      code: b.code,
      city: b.city,
      active: b.active,
      sales,
      orders: s.orders || 0,
      avg: s.orders ? round2(sales / s.orders) : 0,
      cancelled: s.cancelled || 0,
      discount: round2(s.discount || 0),
      tax: round2(s.tax || 0),
      expenses: exp,
      net: round2(sales - exp),
      staff: find(staff, b._id)?.count || 0,
      lowStock: find(lowStock, b._id)?.count || 0,
      share: total.sales ? round2((sales / total.sales) * 100) : 0,
    };
  });

  // trend: [{ day, total, [branchCode]: sales }]
  const trend = Array.from({ length: Math.min(days, 92) }, (_, i) => {
    const d = addDays(startOfDay(from), i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const row = { day: key, total: 0 };
    for (const b of branches) {
      const x = trendRows.find((t) => t._id.day === key && String(t._id.branch) === String(b._id));
      row[b.code] = round2(x?.sales || 0);
      row.total = round2(row.total + row[b.code]);
    }
    return row;
  });

  const expenses = round2(branchStats.reduce((s, b) => s + b.expenses, 0));
  res.json({
    range: { from, to, days },
    total: { ...total, expenses, net: round2(total.sales - expenses) },
    previous: prev,
    branches: branchStats.sort((a, b) => b.sales - a.sales),
    branchCodes: branches.map((b) => ({ code: b.code, name: b.name })),
    trend,
    topItems: top,
    payments,
    orderTypes: types,
    counts: {
      branches: branches.length,
      activeBranches: branches.filter((b) => b.active).length,
      staff: staff.reduce((s, x) => s + x.count, 0),
      customers,
    },
    recent,
  });
});

export default r;
