import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    productId: { type: String, required: true, index: true },
    productSlug: String,
    productName: String,
    productImage: String,
    name: { type: String, required: true, trim: true, maxlength: 60 },
    phone: { type: String, required: true }, // stored as 91XXXXXXXXXX
    status: { type: String, enum: ['pending', 'notified'], default: 'pending', index: true },
    notifiedAt: Date,
  },
  { timestamps: true }
);

// one request per customer per product
schema.index({ productId: 1, phone: 1 }, { unique: true });

export default mongoose.models.StockNotification ||
  mongoose.model('StockNotification', schema);