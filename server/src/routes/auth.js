import { Router } from 'express';
import User from '../models/User.js';
import { protect, signToken } from '../middleware/auth.js';

const r = Router();

r.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password').populate('branch', 'name code active');
  if (!user || !(await user.matchPassword(password))) return res.status(401).json({ message: 'Invalid email or password' });
  if (!user.active) return res.status(403).json({ message: 'Your account is disabled' });
  if (user.role !== 'superadmin' && user.branch && !user.branch.active)
    return res.status(403).json({ message: 'Your branch is currently inactive' });
  user.lastLogin = new Date();
  await user.save();
  const obj = user.toObject();
  delete obj.password;
  res.json({ token: signToken(user), user: obj });
});

r.get('/me', protect, (req, res) => res.json(req.user));

r.put('/password', protect, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' });
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.matchPassword(currentPassword || ''))) return res.status(400).json({ message: 'Current password is incorrect' });
  user.password = newPassword;
  await user.save();
  res.json({ message: 'Password updated' });
});

export default r;
