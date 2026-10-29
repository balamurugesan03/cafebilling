import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    unit: { type: String, default: 'pcs' }, // g, ml, pcs, kg, l
    stock: { type: Number, default: 0 },
    minStock: { type: Number, default: 0 },
    costPerUnit: { type: Number, default: 0 },
    supplier: { type: String, default: '' },
  },
  { timestamps: true }
);

export const InventoryItem = mongoose.model('InventoryItem', inventorySchema);

const stockLogSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    type: { type: String, enum: ['in', 'out', 'adjust', 'consume', 'return'], required: true },
    qty: { type: Number, required: true },
    balance: Number,
    note: { type: String, default: '' },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const StockLog = mongoose.model('StockLog', stockLogSchema);
