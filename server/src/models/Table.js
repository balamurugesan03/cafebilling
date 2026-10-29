import mongoose from 'mongoose';

const tableSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    area: { type: String, default: 'Main' },
    capacity: { type: Number, default: 4 },
    status: { type: String, enum: ['free', 'occupied', 'reserved'], default: 'free' },
    currentOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  },
  { timestamps: true }
);

export default mongoose.model('Table', tableSchema);
