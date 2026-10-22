import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    image: { type: String, default: '' },
    description: { type: String, default: '' },

    // When false, products in this category have NO size selection:
    // the admin only enters one stock/price, and the customer never has to pick a size.
    hasSizes: { type: Boolean, default: true },
    sizes: [{ type: String }], // available size options for filter, e.g. S,M,L,XL,XXL

    // One or more fallback size chart images, shown as a gallery on the
    // storefront for any product in this category that has no size chart
    // of its own.
    sizeChart: [{ type: String }],

    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    seoTitle: String,
    seoDescription: String
  },
  { timestamps: true }
);

// Force a fresh compile in dev so the new `hasSizes` field is picked up
if (process.env.NODE_ENV !== 'production' && mongoose.models.Category) {
  delete mongoose.models.Category;
}

export default mongoose.models.Category || mongoose.model('Category', CategorySchema);