import { Router } from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Expense from '../models/Expense.js';
import { protect, allow, branchScope } from '../middleware/auth.js';
import { parseRange, TZ, round2 } from '../utils/dates.js';

const r = Router();
r.use(protect, branchScope, allow('superadmin', 'manager'));

r.get('/sales', async (req, res) => {
  const { from, to } = parseRange(req.query);
  const base = { createdAt: { $gte: from, $lte: to } };
  if (req.branchId) base.branch = new mongoose.Types.ObjectId(req.branchId);
  const done = { ...base, status: 'completed' };
  const expMatch = { date: { $gte: from, $lte: to }, ...(base.branch && { branch: base.branch }) };

  const [summary, cancelled, daily, items, categories, payments, cashiers, types, hourly, branches, expenses] = await Promise.all([
    Order.aggregate([
      { $match: done },
      {
        $group: {
          _id: null,
          gross: { $sum: '$subTotal' },
          discount: { $sum: '$discountAmount' },
          tax: { $sum: '$taxAmount' },
          points: { $sum: '$pointsValue' },
          roundOff: { $sum: '$roundOff' },
          net: { $sum: '$grandTotal' },
          orders: { $sum: 1 },
          items: { $sum: { $sum: '$items.qty' } },
        },
      },
    ]),
    Order.aggregate([{ $match: { ...base, status: 'cancelled' } }, { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$grandTotal' } } }]),
    Order.aggregate([
      { $match: done },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ() } },
          orders: { $sum: 1 },
          gross: { $sum: '$subTotal' },
          discount: { $sum: '$discountAmount' },
          tax: { $sum: '$taxAmount' },
          net: { $sum: '$grandTotal' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: done },
      { $unwind: '$items' },
      {
        $group: {
          _id: { name: '$items.name', variant: '$items.variant' },
          category: { $first: '$items.category' },
          qty: { $sum: '$items.qty' },
          revenue: { $sum: '$items.total' },
        },
      },
      { $sort: { revenue: -1 } },
    ]),
    Order.aggregate([
      { $match: done },
      { $unwind: '$items' },
      { $group: { _id: '$items.category', qty: { $sum: '$items.qty' }, revenue: { $sum: '$items.total' } } },
      { $sort: { revenue: -1 } },
    ]),
    Order.aggregate([
      { $match: done },
      { $unwind: '$payments' },
      {
        $group: {
          _id: '$payments.method',
          count: { $sum: 1 },
          amount: { $sum: { $subtract: ['$payments.amount', { $cond: [{ $eq: ['$payments.method', 'cash'] }, '$changeDue', 0] }] } },
        },
      },
      { $sort: { amount: -1 } },
    ]),
    Order.aggregate([
      { $match: done },
      { $group: { _id: '$cashierName', orders: { $sum: 1 }, amount: { $sum: '$grandTotal' } } },
      { $sort: { amount: -1 } },
    ]),
    Order.aggregate([{ $match: done }, { $group: { _id: '$orderType', orders: { $sum: 1 }, amount: { $sum: '$grandTotal' } } }]),
    Order.aggregate([
      { $match: done },
      { $group: { _id: { $hour: { date: '$createdAt', timezone: TZ() } }, orders: { $sum: 1 }, amount: { $sum: '$grandTotal' } } },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: done },
      { $group: { _id: '$branch', orders: { $sum: 1 }, amount: { $sum: '$grandTotal' } } },
      { $lookup: { from: 'branches', localField: '_id', foreignField: '_id', as: 'b' } },
      { $project: { orders: 1, amount: 1, name: { $first: '$b.name' } } },
      { $sort: { amount: -1 } },
    ]),
    Expense.aggregate([{ $match: expMatch }, { $group: { _id: '$category', amount: { $sum: '$amount' } } }, { $sort: { amount: -1 } }]),
  ]);

  const s = summary[0] || {};
  const expenseTotal = round2(expenses.reduce((a, e) => a + e.amount, 0));
  const net = round2(s.net || 0);
  res.json({
    range: { from, to },
    summary: {
      gross: round2(s.gross || 0),
      discount: round2(s.discount || 0),
      tax: round2(s.tax || 0),
      points: round2(s.points || 0),
      roundOff: round2(s.roundOff || 0),
      net,
      orders: s.orders || 0,
      items: s.items || 0,
      avg: s.orders ? round2(net / s.orders) : 0,
      cancelledCount: cancelled[0]?.count || 0,
      cancelledAmount: round2(cancelled[0]?.amount || 0),
      expenses: expenseTotal,
      profit: round2(net - (s.tax || 0) - expenseTotal),
    },
    daily: daily.map((d) => ({ day: d._id, orders: d.orders, gross: round2(d.gross), discount: round2(d.discount), tax: round2(d.tax), net: round2(d.net) })),
    items: items.map((i) => ({ name: i._id.name, variant: i._id.variant, category: i.category, qty: i.qty, revenue: round2(i.revenue) })),
    categories: categories.map((c) => ({ name: c._id || 'Uncategorised', qty: c.qty, revenue: round2(c.revenue) })),
    payments: payments.map((p) => ({ method: p._id, count: p.count, amount: round2(p.amount) })),
    cashiers: cashiers.map((c) => ({ name: c._id || '-', orders: c.orders, amount: round2(c.amount) })),
    orderTypes: types.map((t) => ({ type: t._id, orders: t.orders, amount: round2(t.amount) })),
    hourly: hourly.map((h) => ({ hour: `${h._id}:00`, orders: h.orders, amount: round2(h.amount) })),
    branches: branches.map((b) => ({ name: b.name, orders: b.orders, amount: round2(b.amount) })),
    expenses: expenses.map((e) => ({ category: e._id, amount: round2(e.amount) })),
  });
});

export default r;
