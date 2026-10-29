import { Router } from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Branch from '../models/Branch.js';
import Table from '../models/Table.js';
import { protect, allow, branchScope, requireBranch } from '../middleware/auth.js';
import { escapeRegex } from '../utils/crud.js';
import { addDays } from '../utils/dates.js';
import {
  computeOrder,
  computePayments,
  nextInvoice,
  nextToken,
  resolveCustomer,
  onOrderCompleted,
  onOrderCancelled,
} from '../services/orderService.js';

const r = Router();
r.use(protect, branchScope);

const SELLERS = ['superadmin', 'manager', 'cashier'];

async function setTable(order, previousTableId) {
  if (previousTableId && (!order.table || !order.table.equals(previousTableId)))
    await Table.findByIdAndUpdate(previousTableId, { status: 'free', currentOrder: null });
  if (!order.table) return;
  if (order.status === 'held') await Table.findByIdAndUpdate(order.table, { status: 'occupied', currentOrder: order._id });
  else await Table.findByIdAndUpdate(order.table, { status: 'free', currentOrder: null });
}

async function applyBody(order, body, branch) {
  const customer = await resolveCustomer(body);
  const computed = await computeOrder(branch, body, customer?.points || 0);
  Object.assign(order, computed);
  order.orderType = ['dine-in', 'takeaway', 'delivery'].includes(body.orderType) ? body.orderType : 'takeaway';
  order.customer = customer?._id || null;
  order.customerName = customer?.name || body.customerName || '';
  order.customerPhone = customer?.phone || '';
  order.note = body.note || '';
  order.table = null;
  order.tableName = '';
  if (order.orderType === 'dine-in' && body.table && mongoose.isValidObjectId(body.table)) {
    const t = await Table.findOne({ _id: body.table, branch: branch._id });
    if (t) {
      order.table = t._id;
      order.tableName = t.name;
    }
  }
  const status = body.status === 'held' ? 'held' : 'completed';
  if (status === 'completed') {
    Object.assign(order, computePayments(body.payments, order.grandTotal));
    order.completedAt = new Date();
  } else {
    order.payments = [];
    order.paidAmount = 0;
    order.changeDue = 0;
  }
  order.status = status;
}

// Create order (completed sale or held / KOT order)
r.post('/', allow(...SELLERS), requireBranch, async (req, res) => {
  const branch = await Branch.findById(req.branchId);
  if (!branch?.active) return res.status(400).json({ message: 'Branch is inactive' });
  const order = new Order({ branch: branch._id, cashier: req.user._id, cashierName: req.user.name });
  await applyBody(order, req.body, branch);
  order.invoiceNo = await nextInvoice(branch._id);
  order.tokenNo = await nextToken(branch._id);
  if (order.status === 'completed') await onOrderCompleted(order, req.user._id);
  await order.save();
  await setTable(order);
  res.status(201).json(order);
});

// Update a held order (add items / settle payment)
r.put('/:id', allow(...SELLERS), async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, ...(req.branchId && { branch: req.branchId }) });
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.status !== 'held') return res.status(400).json({ message: 'Only held orders can be edited' });
  const branch = await Branch.findById(order.branch);
  const prevTable = order.table;
  await applyBody(order, req.body, branch);
  order.cashier = req.user._id;
  order.cashierName = req.user.name;
  if (order.status === 'completed') await onOrderCompleted(order, req.user._id);
  await order.save();
  await setTable(order, prevTable);
  res.json(order);
});

r.patch('/:id/cancel', allow('superadmin', 'manager'), async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, ...(req.branchId && { branch: req.branchId }) });
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.status === 'cancelled') return res.status(400).json({ message: 'Already cancelled' });
  await onOrderCancelled(order, req.user._id);
  order.status = 'cancelled';
  order.cancelReason = req.body.reason || '';
  await order.save();
  if (order.table) await Table.findByIdAndUpdate(order.table, { status: 'free', currentOrder: null });
  res.json(order);
});

// Kitchen display status
r.patch('/:id/kot', async (req, res) => {
  const { kotStatus } = req.body;
  if (!['new', 'preparing', 'ready', 'served'].includes(kotStatus)) return res.status(400).json({ message: 'Invalid status' });
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, ...(req.branchId && { branch: req.branchId }) },
    { kotStatus },
    { new: true }
  );
  if (!order) return res.status(404).json({ message: 'Order not found' });
  res.json(order);
});

r.get('/kitchen', requireBranch, async (req, res) => {
  res.json(
    await Order.find({
      branch: req.branchId,
      status: { $ne: 'cancelled' },
      kotStatus: { $in: ['new', 'preparing', 'ready'] },
      createdAt: { $gte: addDays(new Date(), -1) },
    }).sort({ createdAt: 1 })
  );
});

r.get('/held', requireBranch, async (req, res) => {
  res.json(await Order.find({ branch: req.branchId, status: 'held' }).sort({ createdAt: -1 }));
});

r.get('/', async (req, res) => {
  const q = {};
  if (req.branchId) q.branch = req.branchId;
  if (req.query.status) q.status = req.query.status;
  if (req.query.orderType) q.orderType = req.query.orderType;
  if (req.query.payment) q['payments.method'] = req.query.payment;
  if (req.query.from || req.query.to) {
    q.createdAt = {};
    if (req.query.from) q.createdAt.$gte = new Date(`${req.query.from}T00:00:00`);
    if (req.query.to) q.createdAt.$lte = new Date(`${req.query.to}T23:59:59.999`);
  }
  if (req.query.search) {
    const rx = { $regex: escapeRegex(req.query.search), $options: 'i' };
    q.$or = [{ invoiceNo: rx }, { customerName: rx }, { customerPhone: rx }];
  }
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, parseInt(req.query.limit, 10) || 25);
  const [data, total, sum] = await Promise.all([
    Order.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('branch', 'name code'),
    Order.countDocuments(q),
    Order.aggregate([{ $match: { ...q, status: 'completed', ...(q.branch && { branch: new mongoose.Types.ObjectId(q.branch) }) } }, { $group: { _id: null, total: { $sum: '$grandTotal' } } }]),
  ]);
  res.json({ data, total, page, pages: Math.ceil(total / limit), sum: sum[0]?.total || 0 });
});

r.get('/:id', async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, ...(req.branchId && { branch: req.branchId }) }).populate('branch');
  if (!order) return res.status(404).json({ message: 'Order not found' });
  res.json(order);
});

export default r;
