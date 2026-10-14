import mongoose from 'mongoose';

// One document per change the AI cofounder PROPOSES. Nothing in your store
// changes until an admin approves it; this record is also the audit log.
const AIActionSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // e.g. "price_change", "coupon_create"
    params: { type: mongoose.Schema.Types.Mixed, required: true }, // validated, normalised inputs
    summary: { type: String, required: true }, // one line, written by the server
    reason: { type: String, default: '' }, // the AI's reasoning (untrusted text, shown as "Why")
    preview: [{ type: String }], // exact before -> after lines, written by the server
    risk: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    status: {
      type: String,
      enum: ['pending', 'executing', 'executed', 'rejected', 'failed', 'expired', 'undone'],
      default: 'pending'
    },
    before: { type: mongoose.Schema.Types.Mixed, default: null }, // snapshot, to detect edits made after the proposal
    undo: { type: mongoose.Schema.Types.Mixed, default: null }, // what is needed to reverse it
    result: { type: String, default: '' },
    error: { type: String, default: '' },
    decidedBy: { type: String, default: '' },
    decidedAt: { type: Date, default: null },
    executedAt: { type: Date, default: null },
    undoneAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

AIActionSchema.index({ status: 1, createdAt: -1 });

export default mongoose.models.AIAction || mongoose.model('AIAction', AIActionSchema);