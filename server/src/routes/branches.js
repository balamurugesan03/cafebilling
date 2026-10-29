import { Router } from 'express';
import Branch from '../models/Branch.js';
import Order from '../models/Order.js';
import { protect, allow } from '../middleware/auth.js';

const r = Router();
r.use(protect);

r.get('/', async (req, res) => {
  if (req.user.role === 'superadmin') return res.json(await Branch.find().sort({ createdAt: 1 }));
  res.json(await Branch.find({ _id: req.user.branch?._id }));
});

r.get('/:id', async (req, res) => {
  if (req.user.role !== 'superadmin' && req.user.branch?._id.toString() !== req.params.id)
    return res.status(403).json({ message: 'Access denied' });
  const b = await Branch.findById(req.params.id);
  if (!b) return res.status(404).json({ message: 'Branch not found' });
  res.json(b);
});

r.post('/', allow('superadmin'), async (req, res) => {
  const { invoiceSeq, ...body } = req.body;
  res.status(201).json(await Branch.create(body));
});

r.put('/:id', allow('superadmin', 'manager'), async (req, res) => {
  const isSuper = req.user.role === 'superadmin';
  if (!isSuper && req.user.branch?._id.toString() !== req.params.id) return res.status(403).json({ message: 'Access denied' });
  const { invoiceSeq, _id, ...body } = req.body;
  if (!isSuper) {
    delete body.code;
    delete body.active;
  }
  const b = await Branch.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
  if (!b) return res.status(404).json({ message: 'Branch not found' });
  res.json(b);
});

r.delete('/:id', allow('superadmin'), async (req, res) => {
  const used = await Order.exists({ branch: req.params.id });
  if (used) return res.status(400).json({ message: 'Branch has orders. Deactivate it instead of deleting.' });
  await Branch.findByIdAndDelete(req.params.id);
  res.json({ message: 'Branch deleted' });
});

export default r;
