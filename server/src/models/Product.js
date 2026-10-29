import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema(
  { name: { type: String, required: true }, price: { type: Number, required: true, min: 0 } },
  { _id: false }
);

const recipeSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
    qty: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    sku: { type: String, default: '' },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, default: 0 },
    // null = use branch tax rate
    taxRate: { type: Number, default: null },
    variants: { type: [variantSchema], default: [] },
    recipe: { type: [recipeSchema], default: [] },
    isVeg: { type: Boolean, default: true },
    available: { type: Boolean, default: true },
    image: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Product', productSchema);
