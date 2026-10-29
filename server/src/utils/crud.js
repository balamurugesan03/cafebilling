import { Router } from 'express';
import { protect, allow, branchScope, requireBranch } from '../middleware/auth.js';

export const escapeRegex = (s = '') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Generic branch-scoped CRUD router. */
export function crudRouter(Model, opts = {}) {
  const {
    populate,
    sort = { createdAt: -1 },
    searchFields = ['name'],
    writeRoles = ['superadmin', 'manager'],
    beforeCreate,
    extraFilter,
  } = opts;
  const r = Router();
  r.use(protect, branchScope);

  r.get('/', async (req, res) => {
    const q = {};
    if (req.branchId) q.branch = req.branchId;
    if (req.query.search && searchFields.length) {
      const rx = { $regex: escapeRegex(req.query.search), $options: 'i' };
      q.$or = searchFields.map((f) => ({ [f]: rx }));
    }
    if (extraFilter) Object.assign(q, extraFilter(req));
    let query = Model.find(q).sort(sort);
    if (populate) query = query.populate(populate);
    query = query.populate('branch', 'name code');
    res.json(await query);
  });

  r.get('/:id', async (req, res) => {
    const filter = { _id: req.params.id };
    if (req.branchId) filter.branch = req.branchId;
    const doc = await Model.findOne(filter);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json(doc);
  });

  r.post('/', allow(...writeRoles), requireBranch, async (req, res) => {
    const body = { ...req.body, branch: req.branchId };
    delete body._id;
    if (beforeCreate) await beforeCreate(req, body);
    const doc = await Model.create(body);
    res.status(201).json(doc);
  });

  r.put('/:id', allow(...writeRoles), async (req, res) => {
    const filter = { _id: req.params.id };
    if (req.branchId) filter.branch = req.branchId;
    const { branch, _id, ...body } = req.body;
    const doc = await Model.findOneAndUpdate(filter, body, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json(doc);
  });

  r.delete('/:id', allow(...writeRoles), async (req, res) => {
    const filter = { _id: req.params.id };
    if (req.branchId) filter.branch = req.branchId;
    const doc = await Model.findOneAndDelete(filter);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  });

  return r;
}
