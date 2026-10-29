import Product from '../models/Product.js';
import Branch from '../models/Branch.js';
import Customer from '../models/Customer.js';
import Order from '../models/Order.js';
import { InventoryItem, StockLog } from '../models/Inventory.js';
import { round2, startOfDay } from '../utils/dates.js';

const httpError = (status, message) => Object.assign(new Error(message), { status });

/**
 * Builds all money fields of an order on the server from product ids.
 * Client-sent prices are never trusted.
 */
export async function computeOrder(branch, body, existingCustomerPoints = 0) {
  const settings = branch.settings || {};
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (!rawItems.length) throw httpError(400, 'Cart is empty');

  const ids = rawItems.map((i) => i.product);
  const products = await Product.find({ _id: { $in: ids }, branch: branch._id }).populate('category', 'name');
  const map = new Map(products.map((p) => [p._id.toString(), p]));

  const lines = rawItems.map((i) => {
    const p = map.get(String(i.product));
    if (!p) throw httpError(400, 'A product in the cart no longer exists');
    const qty = Math.max(1, parseInt(i.qty, 10) || 1);
    let price = p.price;
    if (i.variant) {
      const v = p.variants.find((x) => x.name === i.variant);
      if (!v) throw httpError(400, `Variant "${i.variant}" not found for ${p.name}`);
      price = v.price;
    }
    return {
      product: p._id,
      name: p.name,
      category: p.category?.name || '',
      variant: i.variant || '',
      qty,
      price,
      taxRate: p.taxRate ?? settings.taxRate ?? 0,
      total: round2(price * qty),
      notes: i.notes || '',
    };
  });

  const subTotal = round2(lines.reduce((s, l) => s + l.total, 0));

  const discountType = body.discountType === 'percent' ? 'percent' : 'flat';
  const discountValue = Math.max(0, Number(body.discountValue) || 0);
  let discountAmount = discountType === 'percent' ? (subTotal * Math.min(discountValue, 100)) / 100 : discountValue;
  discountAmount = round2(Math.min(discountAmount, subTotal));

  // Spread discount proportionally across lines for correct tax per rate
  const factor = subTotal > 0 ? (subTotal - discountAmount) / subTotal : 0;
  let taxAmount = 0;
  let taxableTotal = 0;
  for (const l of lines) {
    const taxable = l.total * factor;
    const r = (l.taxRate || 0) / 100;
    const t = settings.taxInclusive ? taxable - taxable / (1 + r) : taxable * r;
    l.taxAmount = round2(t);
    taxAmount += t;
    taxableTotal += taxable;
  }
  taxAmount = round2(taxAmount);
  let total = settings.taxInclusive ? taxableTotal : taxableTotal + taxAmount;

  // Loyalty points redemption
  let pointsRedeemed = Math.max(0, parseInt(body.pointsRedeemed, 10) || 0);
  pointsRedeemed = Math.min(pointsRedeemed, existingCustomerPoints);
  const pointValue = settings.pointValue ?? 1;
  let pointsValue = round2(Math.min(pointsRedeemed * pointValue, total));
  if (pointValue > 0) pointsRedeemed = Math.ceil(pointsValue / pointValue);
  total -= pointsValue;

  const grandTotal = Math.round(total);
  const roundOff = round2(grandTotal - total);
  const pointsEarned = Math.floor((grandTotal * (settings.loyaltyEarnPercent || 0)) / 100);

  return {
    items: lines,
    subTotal,
    discountType,
    discountValue,
    discountAmount,
    taxAmount,
    taxInclusive: !!settings.taxInclusive,
    pointsRedeemed,
    pointsValue,
    pointsEarned,
    roundOff,
    grandTotal,
  };
}

export function computePayments(payments, grandTotal) {
  let list = (Array.isArray(payments) ? payments : [])
    .map((p) => ({ method: p.method, amount: round2(Number(p.amount) || 0), ref: p.ref || '' }))
    .filter((p) => p.amount > 0);
  if (!list.length) list = [{ method: 'cash', amount: grandTotal, ref: '' }];
  const paidAmount = round2(list.reduce((s, p) => s + p.amount, 0));
  if (paidAmount + 0.001 < grandTotal) throw httpError(400, `Payment short by ${round2(grandTotal - paidAmount)}`);
  const changeDue = round2(paidAmount - grandTotal);
  const cash = list.filter((p) => p.method === 'cash').reduce((s, p) => s + p.amount, 0);
  if (changeDue > cash + 0.001) throw httpError(400, 'Card/UPI payments cannot exceed the bill amount');
  return { payments: list, paidAmount, changeDue };
}

export async function nextInvoice(branchId) {
  const b = await Branch.findByIdAndUpdate(branchId, { $inc: { invoiceSeq: 1 } }, { new: true });
  const prefix = b.settings?.invoicePrefix || 'INV';
  return `${prefix}-${b.code}-${String(b.invoiceSeq).padStart(5, '0')}`;
}

export async function nextToken(branchId) {
  const count = await Order.countDocuments({ branch: branchId, createdAt: { $gte: startOfDay() } });
  return count + 1;
}

export async function resolveCustomer(body) {
  const phone = (body.customerPhone || '').trim();
  if (!phone) return null;
  let c = await Customer.findOne({ phone });
  if (!c) c = await Customer.create({ phone, name: body.customerName || '' });
  else if (body.customerName && !c.name) {
    c.name = body.customerName;
    await c.save();
  }
  return c;
}

/** Side effects when an order becomes completed: stock deduction + loyalty. */
export async function onOrderCompleted(order, userId) {
  if (!order.stockDeducted) {
    const products = await Product.find({ _id: { $in: order.items.map((i) => i.product) } }, 'recipe');
    const need = new Map();
    for (const it of order.items) {
      const p = products.find((x) => x._id.equals(it.product));
      for (const r of p?.recipe || []) {
        const k = r.item.toString();
        need.set(k, (need.get(k) || 0) + r.qty * it.qty);
      }
    }
    for (const [itemId, qty] of need) {
      const inv = await InventoryItem.findOneAndUpdate({ _id: itemId, branch: order.branch }, { $inc: { stock: -qty } }, { new: true });
      if (inv)
        await StockLog.create({ item: inv._id, branch: order.branch, type: 'consume', qty: -qty, balance: inv.stock, order: order._id, user: userId, note: order.invoiceNo });
    }
    order.stockDeducted = true;
  }

  if (order.customer) {
    await Customer.findByIdAndUpdate(order.customer, {
      $inc: { points: order.pointsEarned - order.pointsRedeemed, totalSpent: order.grandTotal, visits: 1 },
      $set: { lastVisit: new Date(), lastBranch: order.branch },
    });
  }
}

/** Reverse side effects when a completed order is cancelled. */
export async function onOrderCancelled(order, userId) {
  if (order.stockDeducted) {
    const logs = await StockLog.find({ order: order._id, type: 'consume' });
    for (const l of logs) {
      const inv = await InventoryItem.findByIdAndUpdate(l.item, { $inc: { stock: -l.qty } }, { new: true });
      if (inv) await StockLog.create({ item: inv._id, branch: order.branch, type: 'return', qty: -l.qty, balance: inv.stock, order: order._id, user: userId, note: `Cancelled ${order.invoiceNo}` });
    }
    order.stockDeducted = false;
  }
  if (order.customer && order.status === 'completed') {
    await Customer.findByIdAndUpdate(order.customer, {
      $inc: { points: order.pointsRedeemed - order.pointsEarned, totalSpent: -order.grandTotal, visits: -1 },
    });
  }
}
