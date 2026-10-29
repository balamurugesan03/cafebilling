import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import branchRoutes from './routes/branches.js';
import userRoutes from './routes/users.js';
import orderRoutes from './routes/orders.js';
import dashboardRoutes from './routes/dashboard.js';
import reportRoutes from './routes/reports.js';
import printRoutes from './routes/print.js';
import { categories, products, tables, expenses, inventory, customers } from './routes/resources.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL?.split(',') || true }));
app.use(express.json({ limit: '2mb' }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// Everything is mounted under BASE_PATH (e.g. /cafebilling in production)
const BASE_PATH = (process.env.BASE_PATH || '').replace(/\/$/, '');
const router = express.Router();

router.get('/api/health', (req, res) => res.json({ ok: true, time: new Date() }));
router.use('/api/auth', authRoutes);
router.use('/api/branches', branchRoutes);
router.use('/api/users', userRoutes);
router.use('/api/categories', categories);
router.use('/api/products', products);
router.use('/api/tables', tables);
router.use('/api/expenses', expenses);
router.use('/api/inventory', inventory);
router.use('/api/customers', customers);
router.use('/api/orders', orderRoutes);
router.use('/api/dashboard', dashboardRoutes);
router.use('/api/reports', reportRoutes);
router.use('/api/print', printRoutes);

// Serve the built React app in production (client/dist)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(dist)) {
  router.use(express.static(dist));
  router.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(BASE_PATH || '/', router);

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.name === 'ValidationError') return res.status(400).json({ message: Object.values(err.errors).map((e) => e.message).join(', ') });
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid id' });
  if (err.code === 11000) return res.status(400).json({ message: `Duplicate value: ${Object.keys(err.keyValue || {}).join(', ')}` });
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;
connectDB()
  .then(() => app.listen(PORT, () => console.log(`BrewBill API running on http://localhost:${PORT}`)))
  .catch((e) => {
    console.error('Failed to connect to MongoDB:', e.message);
    process.exit(1);
  });
