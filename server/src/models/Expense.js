import mongoose from 'mongoose';

export const EXPENSE_CATEGORIES = ['Rent', 'Salary', 'Electricity', 'Supplies', 'Maintenance', 'Marketing', 'Transport', 'Other'];

const expenseSchema = new mongoose.Schema(
  {
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    category: { type: String, default: 'Other' },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, default: '' },
    paymentMethod: { type: String, default: 'cash' },
    date: { type: Date, default: Date.now },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('Expense', expenseSchema);
