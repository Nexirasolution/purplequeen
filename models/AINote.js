import mongoose from 'mongoose';

// The AI cofounder's memory: goals, decisions, learnings and things to follow up.
// The latest notes are loaded into every conversation so it remembers across sessions.
const AINoteSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['goal', 'decision', 'learning', 'idea', 'reminder'], default: 'learning' },
    text: { type: String, required: true, maxlength: 600 },
    reviewOn: { type: Date, default: null } // when to check whether a decision worked
  },
  { timestamps: true }
);

export default mongoose.models.AINote || mongoose.model('AINote', AINoteSchema);