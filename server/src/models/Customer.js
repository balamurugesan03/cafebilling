import mongoose from 'mongoose';

// Customers are shared across all branches so loyalty points work everywhere.
const customerSchema = new mongoose.Schema(
  {
    name: { type: String, default: '', trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, default: '' },
    birthday: Date,
    points: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    visits: { type: Number, default: 0 },
    lastVisit: Date,
    lastBranch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Customer', customerSchema);
