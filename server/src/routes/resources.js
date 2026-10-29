import { Router } from 'express';
import { crudRouter, escapeRegex } from '../utils/crud.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Table from '../models/Table.js';
import Expense, { EXPENSE_CATEGORIES } from '../models/Expense.js';
import Customer from '../models/Customer.js';
import Order from '../models/Order.js';
import { InventoryItem, StockLog } from '../models/Inventory.js';
import { protect, allow, branchScope, requireBranch } from '../middleware/auth.js';

export const categories = crudRouter(Category, { sort: { sortOrder: 1, name: 1 } });

export const products = crudRouter(Product, {
  sort: { name: 1 },
  searchFields: ['name', 'sku'],
  populate: [{ path: 'category', select: 'name color icon' }, { path: 'recipe.item', select: 'name unit' }],
});

// Super admin: copy categories + products from another branch into the selected branch
products.post('/copy-from/:source', allow('superadmin'), requireBranch, async (req, res) => {
  const target = req.branchId;
  if (req.params.source === target) return res.status(400).json({ message: 'Source and target are the same branch' });
  const [srcCats, srcProducts, tgtCats, tgtProducts, tgtInv, srcInv] = await Promise.all([
    Category.find({ branch: req.params.source }),
    Product.find({ branch: req.params.source }),
    Category.find({ branch: target }),
    Product.find({ branch: target }, 'name'),
    InventoryItem.find({ branch: target }),
    InventoryItem.find({ branch: req.params.source }),
  ]);
  const key = (s) => s.trim().toLowerCase();
  const catMap = new Map(tgtCats.map((c) => [key(c.name), c._id]));
  const srcCatName = new Map(srcCats.map((c) => [String(c._id), c.name]));
  let cats = 0;
  for (const c of srcCats) {
    if (catMap.has(key(c.name))) continue;
    const n = await Category.create({ name: c.name, color: c.color, icon: c.icon, sortOrder: c.sortOrder, active: c.active, branch: target });
    catMap.set(key(c.name), n._id);
    cats++;
  }
  const have = new Set(tgtProducts.map((p) => key(p.name)));
  const invByName = new Map(tgtInv.map((i) => [key(i.name), i._id]));
  const srcInvName = new Map(srcInv.map((i) => [String(i._id), i.name]));
  const docs = srcProducts
    .filter((p) => !have.has(key(p.name)))
    .map((p) => ({
      name: p.name,
      sku: p.sku,
      description: p.description,
      price: p.price,
      costPrice: p.costPrice,
      taxRate: p.taxRate,
      variants: p.variants,
      isVeg: p.isVeg,
      available: p.available,
      image: p.image,
      category: catMap.get(key(srcCatName.get(String(p.category)) || '')),
      recipe: p.recipe
        .map((r) => ({ item: invByName.get(key(srcInvName.get(String(r.item)) || '')), qty: r.qty }))
        .filter((r) => r.item),
      branch: target,
    }))
    .filter((p) => p.category);
  if (docs.length) await Product.insertMany(docs);
  res.json({ message: `Copied ${cats} categories and ${docs.length} products` });
});

export const tables = crudRouter(Table, { sort: { area: 1, name: 1 } });

export const expenses = crudRouter(Expense, {
  sort: { date: -1 },
  searchFields: ['note', 'category'],
  writeRoles: ['superadmin', 'manager', 'cashier'],
  populate: { path: 'user', select: 'name' },
  beforeCreate: (req, body) => {
    body.user = req.user._id;
  },
  extraFilter: (req) => {
    const q = {};
    if (req.query.from || req.query.to) {
      q.date = {};
      if (req.query.from) q.date.$gte = new Date(`${req.query.from}T00:00:00`);
      if (req.query.to) q.date.$lte = new Date(`${req.query.to}T23:59:59.999`);
    }
    return q;
  },
});
expenses.get('/meta/categories', (req, res) => res.json(EXPENSE_CATEGORIES));

// ---------- Inventory ----------
export const inventory = crudRouter(InventoryItem, { sort: { name: 1 }, searchFields: ['name', 'supplier'] });

inventory.post('/:id/adjust', allow('superadmin', 'manager'), requireBranch, async (req, res) => {
  const { type, qty, note } = req.body;
  const n = Number(qty);
  if (!['in', 'out', 'adjust'].includes(type) || Number.isNaN(n)) return res.status(400).json({ message: 'Invalid adjustment' });
  const item = await InventoryItem.findOne({ _id: req.params.id, branch: req.branchId });
  if (!item) return res.status(404).json({ message: 'Item not found' });
  let delta = n;
  if (type === 'out') delta = -Math.abs(n);
  if (type === 'in') delta = Math.abs(n);
  if (type === 'adjust') delta = n - item.stock; // set absolute stock
  item.stock = Math.round((item.stock + delta) * 1000) / 1000;
  await item.save();
  await StockLog.create({ item: item._id, branch: item.branch, type, qty: delta, balance: item.stock, note, user: req.user._id });
  res.json(item);
});

inventory.get('/logs/all', async (req, res) => {
  const q = {};
  if (req.branchId) q.branch = req.branchId;
  if (req.query.item) q.item = req.query.item;
  res.json(await StockLog.find(q).sort({ createdAt: -1 }).limit(200).populate('item', 'name unit').populate('user', 'name'));
});

// ---------- Customers (global across branches) ----------
export const customers = Router();
customers.use(protect, branchScope);

customers.get('/', async (req, res) => {
  const q = {};
  if (req.query.search) {
    const rx = { $regex: escapeRegex(req.query.search), $options: 'i' };
    q.$or = [{ name: rx }, { phone: rx }, { email: rx }];
  }
  res.json(await Customer.find(q).sort({ lastVisit: -1, createdAt: -1 }).limit(500).populate('lastBranch', 'name'));
});

customers.get('/phone/:phone', async (req, res) => {
  const c = await Customer.findOne({ phone: req.params.phone.trim() });
  res.json(c);
});

customers.get('/:id/orders', async (req, res) => {
  res.json(
    await Order.find({ customer: req.params.id, status: 'completed' })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('invoiceNo grandTotal createdAt branch items.name items.qty')
      .populate('branch', 'name')
  );
});

customers.post('/', async (req, res) => {
  if (!req.body.phone) return res.status(400).json({ message: 'Phone is required' });
  if (await Customer.exists({ phone: req.body.phone.trim() })) return res.status(400).json({ message: 'Customer with this phone exists' });
  const { points, totalSpent, visits, ...body } = req.body;
  res.status(201).json(await Customer.create(body));
});

customers.put('/:id', async (req, res) => {
  const { totalSpent, visits, _id, ...body } = req.body;
  if (req.user.role === 'cashier' || req.user.role === 'kitchen') delete body.points;
  const c = await Customer.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
  if (!c) return res.status(404).json({ message: 'Customer not found' });
  res.json(c);
});

customers.delete('/:id', allow('superadmin', 'manager'), async (req, res) => {
  await Customer.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});
