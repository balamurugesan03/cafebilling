import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';

export const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES || '7d',
  });

export async function protect(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Not authenticated' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).populate('branch', 'name code active');
    if (!user || !user.active) return res.status(401).json({ message: 'Account disabled or removed' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Session expired, please login again' });
  }
}

export const allow =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'You do not have access to this action' });

/**
 * Resolves which branch a request operates on.
 * - Super admin: chooses via `x-branch-id` header or `?branch=` (null = all branches)
 * - Everyone else: locked to their own branch
 */
export function branchScope(req, res, next) {
  if (req.user.role === 'superadmin') {
    const b = req.headers['x-branch-id'] || req.query.branch;
    req.branchId = b && b !== 'all' && mongoose.isValidObjectId(b) ? b : null;
  } else {
    req.branchId = req.user.branch?._id?.toString() || null;
    if (!req.branchId) return res.status(403).json({ message: 'No branch assigned to this user' });
  }
  next();
}

export function requireBranch(req, res, next) {
  if (!req.branchId) return res.status(400).json({ message: 'Please select a branch first' });
  next();
}
