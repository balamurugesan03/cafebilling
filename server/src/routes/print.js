import { Router } from 'express';
import Order from '../models/Order.js';
import Branch from '../models/Branch.js';
import { protect, branchScope, requireBranch } from '../middleware/auth.js';
import { buildBill, buildKOT, buildTest, sendToPrinter } from '../utils/escpos.js';

const r = Router();
r.use(protect, branchScope);

// Network (LAN/WiFi) ESC/POS printing
r.post('/order/:id', async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, ...(req.branchId && { branch: req.branchId }) });
  if (!order) return res.status(404).json({ message: 'Order not found' });
  const branch = await Branch.findById(order.branch);
  const p = branch.settings.printer;
  const type = req.body.type === 'kot' ? 'kot' : 'bill';
  try {
    if (type === 'kot') await sendToPrinter(p.kotIp || p.ip, p.kotIp ? p.kotPort : p.port, buildKOT(order, branch));
    else await sendToPrinter(p.ip, p.port, buildBill(order, branch));
    res.json({ message: `${type.toUpperCase()} sent to printer` });
  } catch (e) {
    res.status(502).json({ message: e.message });
  }
});

r.post('/test', requireBranch, async (req, res) => {
  const branch = await Branch.findById(req.branchId);
  const target = req.body.target === 'kot' ? 'kot' : 'bill';
  const p = { ...branch.settings.printer.toObject(), ...(req.body.printer || {}) };
  try {
    await sendToPrinter(target === 'kot' ? p.kotIp : p.ip, target === 'kot' ? p.kotPort : p.port, buildTest(branch));
    res.json({ message: 'Test page sent' });
  } catch (e) {
    res.status(502).json({ message: e.message });
  }
});

export default r;
