import mongoose from 'mongoose';

const InvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    source: { type: String, enum: ['order', 'manual'], default: 'manual' },
    // only set for invoices generated from an order (sparse => many manual invoices allowed)
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', unique: true, sparse: true },
    orderNumber: String,
    customer: { name: String, phone: String, email: String },
    shippingAddress: {
      line1: String, line2: String, city: String, state: String, pincode: String, landmark: String,
    },
    items: [
      {
        _id: false,
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        variantId: String,
        name: String, sku: String, image: String, color: String, size: String,
        qty: Number, price: Number, details: String,
      },
    ],
    subtotal: Number,
    discount: { type: Number, default: 0 },
    couponCode: { type: String, default: '' },
    shippingFee: { type: Number, default: 0 },
    total: Number,
    paymentMethod: { type: String, default: 'cash' },
    paymentStatus: { type: String, default: 'paid' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.models.Invoice || mongoose.model('Invoice', InvoiceSchema);