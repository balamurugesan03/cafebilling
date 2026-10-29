import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import Branch from './models/Branch.js';
import User from './models/User.js';
import Category from './models/Category.js';
import Product from './models/Product.js';
import Table from './models/Table.js';
import Customer from './models/Customer.js';
import Expense from './models/Expense.js';
import Order from './models/Order.js';
import { InventoryItem, StockLog } from './models/Inventory.js';
import { computeOrder } from './services/orderService.js';

const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const MENU = [
  { cat: 'Hot Coffee', color: '#92400e', icon: '☕', items: [
    { name: 'Espresso', price: 90, recipe: { 'Coffee Beans': 18 } },
    { name: 'Cappuccino', price: 150, variants: [['Regular', 150], ['Large', 190]], recipe: { 'Coffee Beans': 18, Milk: 150 } },
    { name: 'Cafe Latte', price: 160, variants: [['Regular', 160], ['Large', 200]], recipe: { 'Coffee Beans': 18, Milk: 200 } },
    { name: 'Americano', price: 120, recipe: { 'Coffee Beans': 18 } },
    { name: 'Filter Coffee', price: 60, recipe: { 'Coffee Beans': 12, Milk: 100 } },
    { name: 'Mocha', price: 180, recipe: { 'Coffee Beans': 18, Milk: 150, 'Chocolate Syrup': 30 } },
  ] },
  { cat: 'Cold Coffee', color: '#0e7490', icon: '🧊', items: [
    { name: 'Cold Brew', price: 170, recipe: { 'Coffee Beans': 25 } },
    { name: 'Iced Latte', price: 180, recipe: { 'Coffee Beans': 18, Milk: 200 } },
    { name: 'Classic Frappe', price: 200, variants: [['Regular', 200], ['Large', 240]], recipe: { 'Coffee Beans': 18, Milk: 200, 'Ice Cream': 60 } },
    { name: 'Caramel Frappe', price: 220, recipe: { 'Coffee Beans': 18, Milk: 200, 'Caramel Syrup': 30 } },
  ] },
  { cat: 'Tea & More', color: '#15803d', icon: '🍵', items: [
    { name: 'Masala Chai', price: 50, recipe: { Milk: 120 } },
    { name: 'Green Tea', price: 80 },
    { name: 'Hot Chocolate', price: 170, recipe: { Milk: 200, 'Chocolate Syrup': 40 } },
    { name: 'Lemon Iced Tea', price: 120 },
  ] },
  { cat: 'Snacks', color: '#b45309', icon: '🥪', items: [
    { name: 'Veg Sandwich', price: 140, recipe: { Bread: 2 } },
    { name: 'Chicken Sandwich', price: 180, veg: false, recipe: { Bread: 2 } },
    { name: 'French Fries', price: 120 },
    { name: 'Paneer Puff', price: 60 },
    { name: 'Garlic Bread', price: 130, recipe: { Bread: 2 } },
  ] },
  { cat: 'Desserts', color: '#be185d', icon: '🍰', items: [
    { name: 'Chocolate Brownie', price: 120 },
    { name: 'Blueberry Muffin', price: 110 },
    { name: 'Cheesecake', price: 220 },
    { name: 'Croissant', price: 130 },
  ] },
];

const INVENTORY = [
  ['Coffee Beans', 'g', 5000, 1000, 1.2],
  ['Milk', 'ml', 20000, 5000, 0.06],
  ['Chocolate Syrup', 'ml', 2000, 500, 0.4],
  ['Caramel Syrup', 'ml', 1500, 500, 0.45],
  ['Ice Cream', 'g', 3000, 800, 0.3],
  ['Bread', 'pcs', 80, 20, 4],
  ['Paper Cups', 'pcs', 500, 100, 2],
];

async function seedBranch(def, admin) {
  const branch = await Branch.create(def.branch);
  await User.create([
    { name: def.manager[0], email: def.manager[1], password: '123456', role: 'manager', branch: branch._id },
    { name: def.cashier[0], email: def.cashier[1], password: '123456', role: 'cashier', branch: branch._id },
    { name: def.kitchen[0], email: def.kitchen[1], password: '123456', role: 'kitchen', branch: branch._id },
  ]);

  const inv = {};
  for (const [name, unit, stock, minStock, costPerUnit] of INVENTORY) {
    inv[name] = await InventoryItem.create({ name, unit, stock: stock * 3, minStock, costPerUnit, branch: branch._id, supplier: 'Local Supplier' });
  }

  const products = [];
  for (const [i, c] of MENU.entries()) {
    const cat = await Category.create({ name: c.cat, color: c.color, icon: c.icon, sortOrder: i, branch: branch._id });
    for (const it of c.items) {
      products.push(
        await Product.create({
          name: it.name,
          price: Math.round(it.price * def.priceFactor),
          variants: (it.variants || []).map(([name, price]) => ({ name, price: Math.round(price * def.priceFactor) })),
          recipe: Object.entries(it.recipe || {}).map(([k, qty]) => ({ item: inv[k]._id, qty })),
          isVeg: it.veg !== false,
          costPrice: Math.round(it.price * 0.35),
          category: cat._id,
          branch: branch._id,
          sku: it.name.split(' ').map((w) => w[0]).join('').toUpperCase() + rand(10, 99),
        })
      );
    }
  }

  const tables = [];
  for (let i = 1; i <= def.tables; i++) tables.push(await Table.create({ name: `T${i}`, area: i <= 6 ? 'Indoor' : 'Outdoor', capacity: pick([2, 4, 4, 6]), branch: branch._id }));

  return { branch, products, tables, inv };
}

async function run() {
  await connectDB();
  console.log('Clearing database...');
  await mongoose.connection.dropDatabase();

  const admin = await User.create({ name: 'Super Admin', email: 'admin@brewbill.com', password: 'admin123', role: 'superadmin' });

  const defs = [
    {
      branch: { name: 'BrewBill Anna Nagar', code: 'ANN', address: '2nd Avenue, Anna Nagar', city: 'Chennai', phone: '9876500001', gstin: '33ABCDE1234F1Z5', settings: { invoicePrefix: 'BB', receiptHeader: 'Fresh coffee, happy you!' } },
      manager: ['Karthik (Manager)', 'manager.ann@brewbill.com'],
      cashier: ['Priya (Cashier)', 'cashier.ann@brewbill.com'],
      kitchen: ['Ravi (Kitchen)', 'kitchen.ann@brewbill.com'],
      tables: 10, priceFactor: 1, volume: [25, 45],
    },
    {
      branch: { name: 'BrewBill T Nagar', code: 'TNR', address: 'Usman Road, T Nagar', city: 'Chennai', phone: '9876500002', gstin: '33ABCDE1234F2Z4', settings: { invoicePrefix: 'BB' } },
      manager: ['Divya (Manager)', 'manager.tnr@brewbill.com'],
      cashier: ['Arun (Cashier)', 'cashier.tnr@brewbill.com'],
      kitchen: ['Mani (Kitchen)', 'kitchen.tnr@brewbill.com'],
      tables: 8, priceFactor: 1, volume: [18, 35],
    },
    {
      branch: { name: 'BrewBill Coimbatore RS Puram', code: 'CBE', address: 'DB Road, RS Puram', city: 'Coimbatore', phone: '9876500003', settings: { invoicePrefix: 'BB', taxInclusive: true } },
      manager: ['Suresh (Manager)', 'manager.cbe@brewbill.com'],
      cashier: ['Meena (Cashier)', 'cashier.cbe@brewbill.com'],
      kitchen: ['Babu (Kitchen)', 'kitchen.cbe@brewbill.com'],
      tables: 6, priceFactor: 0.9, volume: [12, 25],
    },
  ];

  const customers = await Customer.insertMany(
    ['Anand', 'Lakshmi', 'Vignesh', 'Sneha', 'Rahul', 'Kavya', 'Harish', 'Deepa', 'Sanjay', 'Nithya', 'Gokul', 'Janani'].map((name, i) => ({
      name,
      phone: `98400${String(10000 + i * 137).slice(0, 5)}`,
    }))
  );

  const DAYS = 30;
  for (const def of defs) {
    console.log(`Seeding ${def.branch.name}...`);
    const { branch, products, tables } = await seedBranch(def, admin);
    const cashier = await User.findOne({ branch: branch._id, role: 'cashier' });
    const orders = [];
    let seq = 0;

    for (let d = DAYS - 1; d >= 0; d--) {
      const count = rand(...def.volume);
      for (let k = 0; k < count; k++) {
        const date = new Date();
        date.setDate(date.getDate() - d);
        date.setHours(rand(7, 22), rand(0, 59), rand(0, 59), 0);
        if (date > new Date()) continue;

        const items = Array.from({ length: rand(1, 4) }, () => {
          const p = pick(products);
          return { product: p._id, qty: rand(1, 3), variant: p.variants.length ? pick(p.variants).name : '' };
        });
        const cust = Math.random() < 0.35 ? pick(customers) : null;
        const discount = Math.random() < 0.15 ? { discountType: 'percent', discountValue: pick([5, 10]) } : {};
        const computed = await computeOrder(branch, { items, ...discount });
        const orderType = pick(['dine-in', 'dine-in', 'takeaway', 'takeaway', 'delivery']);
        const table = orderType === 'dine-in' ? pick(tables) : null;
        const method = pick(['cash', 'upi', 'upi', 'card']);
        const cancelled = Math.random() < 0.02;
        seq++;
        orders.push({
          ...computed,
          branch: branch._id,
          invoiceNo: `BB-${branch.code}-${String(seq).padStart(5, '0')}`,
          tokenNo: k + 1,
          orderType,
          table: table?._id || null,
          tableName: table?.name || '',
          customer: cust?._id || null,
          customerName: cust?.name || '',
          customerPhone: cust?.phone || '',
          payments: [{ method, amount: computed.grandTotal }],
          paidAmount: computed.grandTotal,
          status: cancelled ? 'cancelled' : 'completed',
          cancelReason: cancelled ? 'Customer cancelled' : '',
          kotStatus: 'served',
          cashier: cashier._id,
          cashierName: cashier.name,
          createdAt: date,
          updatedAt: date,
          completedAt: date,
          stockDeducted: false,
        });
      }

      // daily expenses
      if (d % 3 === 0) {
        const dt = new Date();
        dt.setDate(dt.getDate() - d);
        await Expense.create({ branch: branch._id, category: pick(['Supplies', 'Electricity', 'Transport', 'Maintenance', 'Other']), amount: rand(300, 2500), note: 'Daily expense', date: dt, user: cashier._id });
      }
      if (d === DAYS - 1) {
        const dt = new Date();
        dt.setDate(dt.getDate() - d);
        await Expense.create({ branch: branch._id, category: 'Rent', amount: 45000, note: 'Monthly rent', date: dt, user: cashier._id });
        await Expense.create({ branch: branch._id, category: 'Salary', amount: 60000, note: 'Staff salary', date: dt, user: cashier._id });
      }
    }
    await Order.insertMany(orders);
    await Branch.findByIdAndUpdate(branch._id, { invoiceSeq: seq });
    console.log(`  ${orders.length} orders created`);
  }

  // customer stats from orders
  const stats = await Order.aggregate([
    { $match: { status: 'completed', customer: { $ne: null } } },
    { $group: { _id: '$customer', total: { $sum: '$grandTotal' }, visits: { $sum: 1 }, last: { $max: '$createdAt' }, branch: { $last: '$branch' }, points: { $sum: '$pointsEarned' } } },
  ]);
  for (const s of stats) await Customer.findByIdAndUpdate(s._id, { totalSpent: s.total, visits: s.visits, lastVisit: s.last, lastBranch: s.branch, points: s.points });

  // make a couple of items low on stock for the demo
  await InventoryItem.updateMany({ name: { $in: ['Caramel Syrup', 'Bread'] } }, [{ $set: { stock: { $multiply: ['$minStock', 0.6] } } }]);
  await StockLog.deleteMany({});

  console.log('\n✅ Seed complete. Logins:');
  console.log('  Super Admin : admin@brewbill.com / admin123');
  console.log('  Manager     : manager.ann@brewbill.com / 123456  (also .tnr / .cbe)');
  console.log('  Cashier     : cashier.ann@brewbill.com / 123456');
  console.log('  Kitchen     : kitchen.ann@brewbill.com / 123456');
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
