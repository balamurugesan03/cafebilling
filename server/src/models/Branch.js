import mongoose from 'mongoose';

const printerSchema = new mongoose.Schema(
  {
    // browser = OS print dialog (any USB/Bluetooth/thermal printer installed in Windows)
    // network = raw ESC/POS over TCP (LAN/WiFi thermal printers, port 9100)
    mode: { type: String, enum: ['browser', 'network'], default: 'browser' },
    ip: { type: String, default: '' },
    port: { type: Number, default: 9100 },
    kotIp: { type: String, default: '' },
    kotPort: { type: Number, default: 9100 },
    paperWidth: { type: Number, enum: [58, 80], default: 80 },
    autoPrintBill: { type: Boolean, default: true },
    autoPrintKOT: { type: Boolean, default: false },
    showLogo: { type: Boolean, default: true },
  },
  { _id: false }
);

const settingsSchema = new mongoose.Schema(
  {
    currency: { type: String, default: '₹' },
    taxLabel: { type: String, default: 'GST' },
    taxRate: { type: Number, default: 5 },
    taxInclusive: { type: Boolean, default: false },
    invoicePrefix: { type: String, default: 'INV' },
    receiptHeader: { type: String, default: '' },
    receiptFooter: { type: String, default: 'Thank you! Visit again.' },
    loyaltyEarnPercent: { type: Number, default: 2 },
    pointValue: { type: Number, default: 1 },
    printer: { type: printerSchema, default: () => ({}) },
  },
  { _id: false }
);

const branchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    gstin: { type: String, default: '' },
    active: { type: Boolean, default: true },
    invoiceSeq: { type: Number, default: 0 },
    settings: { type: settingsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export default mongoose.model('Branch', branchSchema);
