import { Router } from 'express';
import User from '../models/User.js';
import { protect, allow, branchScope } from '../middleware/auth.js';

const r = Router();
r.use(protect, branchScope, allow('superadmin', 'manager'));

const MANAGER_CAN_ASSIGN = ['cashier', 'kitchen'];

r.get('/', async (req, res) => {
  const q = {};
  if (req.branchId) q.branch = req.branchId;
  if (req.user.role !== 'superadmin') q.role = { $ne: 'superadmin' };
  res.json(await User.find(q).populate('branch', 'name code').sort({ createdAt: -1 }));
});

function validate(req, body) {
  if (req.user.role === 'superadmin') {
    if (body.role !== 'superadmin' && !body.branch) return 'Branch is required for this role';
    if (body.role === 'superadmin') body.branch = undefined;
    return null;
  }
  if (!MANAGER_CAN_ASSIGN.includes(body.role)) return 'Managers can only create cashier or kitchen users';
  body.branch = req.branchId;
  return null;
}

r.post('/', async (req, res) => {
  const body = { ...req.body };
  const err = validate(req, body);
  if (err) return res.status(400).json({ message: err });
  if (await User.exists({ email: body.email?.toLowerCase() })) return res.status(400).json({ message: 'Email already in use' });
  const u = await User.create(body);
  const obj = u.toObject();
  delete obj.password;
  res.status(201).json(obj);
});

r.put('/:id', async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) return res.status(404).json({ message: 'User not found' });
  if (req.user.role !== 'superadmin' && (u.branch?.toString() !== req.branchId || !MANAGER_CAN_ASSIGN.includes(u.role)))
    return res.status(403).json({ message: 'You cannot edit this user' });
  const body = { ...req.body };
  const err = validate(req, body);
  if (err) return res.status(400).json({ message: err });
  for (const k of ['name', 'email', 'phone', 'role', 'branch', 'active']) if (k in body) u[k] = body[k];
  if (body.password) u.password = body.password;
  if (u._id.equals(req.user._id)) u.active = true;
  await u.save();
  res.json(await User.findById(u._id).populate('branch', 'name code'));
});

r.delete('/:id', async (req, res) => {
  if (req.params.id === req.user._id.toString()) return res.status(400).json({ message: 'You cannot delete yourself' });
  const u = await User.findById(req.params.id);
  if (!u) return res.status(404).json({ message: 'User not found' });
  if (req.user.role !== 'superadmin' && (u.branch?.toString() !== req.branchId || !MANAGER_CAN_ASSIGN.includes(u.role)))
    return res.status(403).json({ message: 'You cannot delete this user' });
  await u.deleteOne();
  res.json({ message: 'User deleted' });
});

export default r;
