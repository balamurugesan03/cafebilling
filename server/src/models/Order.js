import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    category: String,
    variant: { type: String, default: '' },
    qty: { type: Number, required: true, min: 1 },
    price: Number,
    taxRate: Number,
    taxAmount: Number,
    total: Number,
    notes: { type: String, default: '' },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    method: { type: String, enum: ['cash', 'card', 'upi', 'wallet', 'points'], required: true },
    amount: { type: Number, required: true },
    ref: { type: String, default: '' },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    invoiceNo: { type: String, index: true },
    tokenNo: Number,
    orderType: { type: String, enum: ['dine-in', 'takeaway', 'delivery'], default: 'takeaway' },
    table: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', default: null },
    tableName: { type: String, default: '' },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    customerName: { type: String, default: '' },
    customerPhone: { type: String, default: '' },
    items: [itemSchema],
    subTotal: Number,
    discountType: { type: String, enum: ['flat', 'percent'], default: 'flat' },
    discountValue: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    pointsRedeemed: { type: Number, default: 0 },
    pointsValue: { type: Number, default: 0 },
    pointsEarned: { type: Number, default: 0 },
    taxAmount: Number,
    taxInclusive: Boolean,
    roundOff: Number,
    grandTotal: Number,
    payments: [paymentSchema],
    paidAmount: { type: Number, default: 0 },
    changeDue: { type: Number, default: 0 },
    status: { type: String, enum: ['held', 'completed', 'cancelled'], default: 'completed', index: true },
    kotStatus: { type: String, enum: ['new', 'preparing', 'ready', 'served'], default: 'new' },
    note: { type: String, default: '' },
    cancelReason: { type: String, default: '' },
    stockDeducted: { type: Boolean, default: false },
    cashier: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cashierName: String,
    completedAt: Date,
  },
  { timestamps: true }
);

orderSchema.index({ branch: 1, createdAt: -1 });

export default mongoose.model('Order', orderSchema);
