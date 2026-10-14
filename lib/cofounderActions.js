import { dbConnect } from './mongodb';
import AIAction from '@/models/AIAction';
import AINote from '@/models/AINote';
import { ACTIONS } from './actionRegistry';
import { istDateKey } from './salesRules';

const EXPIRY_DAYS = 7; // unapproved proposals lapse after a week
const MAX_PENDING = 30; // stops the AI from flooding the approval list
const MAX_PROPOSALS_PER_RUN = 5; // per conversation turn

// Errors safe to show the admin (everything else is hidden behind a generic message).
export class ActionError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// ---------- what the AI sees ----------
export const actionToolDefinitions = Object.values(ACTIONS).map((a) => a.tool);

export const memoryToolDefinitions = [
  {
    name: 'save_note',
    description:
      'Save a note to your long-term memory: an owner goal, a decision made, something you learned, an idea, or a reminder. Include review_on for experiments so you remember to judge them. Notes are shown to you at the start of every future conversation.',
    input_schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['goal', 'decision', 'learning', 'idea', 'reminder'] },
        text: { type: 'string', description: 'Max 600 characters. Be specific: what, why, and the success metric.' },
        review_on: { type: 'string', description: 'Optional date YYYY-MM-DD to check back' }
      },
      required: ['kind', 'text']
    }
  },
  {
    name: 'get_action_history',
    description:
      'Recent changes you proposed and what happened to them (approved and applied, rejected, failed, undone). Use it before proposing, so you do not repeat yourself, and to judge whether past changes worked.',
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'integer', description: 'Default 15, max 40' } }
    }
  }
];

const MEMORY_TOOLS = new Set(memoryToolDefinitions.map((t) => t.name));
export const isActionTool = (name) => name.startsWith('propose_') || MEMORY_TOOLS.has(name);

// ---------- shape sent to the browser ----------
export function effectiveStatus(a) {
  return a.status === 'pending' && a.expiresAt && new Date(a.expiresAt) < new Date() ? 'expired' : a.status;
}

export function toPublic(a) {
  return {
    id: String(a._id),
    type: a.type,
    summary: a.summary,
    reason: a.reason,
    preview: a.preview || [],
    risk: a.risk,
    status: effectiveStatus(a),
    createdAt: a.createdAt,
    decidedAt: a.decidedAt,
    decidedBy: a.decidedBy,
    result: a.result,
    error: a.error,
    canUndo: a.status === 'executed' && !!a.undo
  };
}

// ---------- the AI proposes (never executes) ----------
async function proposeAction(type, input, ctx) {
  const def = ACTIONS[type];
  if (!def) throw new Error(`Unknown action type: ${type}`);
  await dbConnect();

  if (ctx.proposalCount >= MAX_PROPOSALS_PER_RUN) {
    throw new Error('Too many proposals in one turn. Ask the owner to review these first.');
  }
  const pendingCount = await AIAction.countDocuments({ status: 'pending', expiresAt: { $gt: new Date() } });
  if (pendingCount >= MAX_PENDING) {
    throw new Error('There are already many proposals waiting for approval. Ask the owner to clear them first.');
  }

  const reason = String(input.reason || '').trim().slice(0, 600);
  if (!reason) throw new Error('reason is required.');

  const prepared = await def.prepare(input); // validates and throws on anything out of bounds

  // Same change already waiting? Return it instead of creating a duplicate.
  const waiting = await AIAction.find({ type, status: 'pending', expiresAt: { $gt: new Date() } }).limit(50);
  const dup = waiting.find((w) => JSON.stringify(w.params) === JSON.stringify(prepared.params));
  if (dup) {
    return {
      result: { status: 'already_pending_owner_approval', id: String(dup._id), summary: dup.summary },
      proposal: null
    };
  }

  const doc = await AIAction.create({
    type,
    params: prepared.params,
    before: prepared.before ?? null,
    summary: prepared.summary,
    reason,
    preview: prepared.preview,
    risk: prepared.risk,
    expiresAt: new Date(Date.now() + EXPIRY_DAYS * 86400000)
  });
  ctx.proposalCount += 1;
  console.log('[cofounder proposal]', type, String(doc._id), prepared.summary);

  return {
    result: {
      status: 'pending_owner_approval',
      id: String(doc._id),
      summary: prepared.summary,
      preview: prepared.preview,
      risk: prepared.risk,
      note: 'Nothing has changed yet. The owner sees an Approve/Reject card under your reply. Do not say it is done.'
    },
    proposal: toPublic(doc)
  };
}

// ---------- memory tools ----------
async function saveNote(input) {
  await dbConnect();
  const text = String(input.text || '').trim().slice(0, 600);
  if (!text) throw new Error('text is required.');
  const kind = ['goal', 'decision', 'learning', 'idea', 'reminder'].includes(input.kind) ? input.kind : 'learning';
  let reviewOn = null;
  if (input.review_on) {
    reviewOn = new Date(`${String(input.review_on).slice(0, 10)}T00:00:00+05:30`);
    if (isNaN(reviewOn)) reviewOn = null;
  }
  await AINote.create({ kind, text, reviewOn });
  return { saved: true };
}

async function getActionHistory(input) {
  await dbConnect();
  const limit = Math.min(Number(input.limit) || 15, 40);
  const rows = await AIAction.find().sort({ createdAt: -1 }).limit(limit).lean();
  return rows.map((a) => ({
    proposedOn: istDateKey(a.createdAt),
    type: a.type,
    summary: a.summary,
    status: effectiveStatus(a),
    appliedOn: a.executedAt ? istDateKey(a.executedAt) : null,
    result: a.result || a.error || ''
  }));
}

// Returns { result, proposal? } so the agent can show approval cards for new proposals.
export async function runActionTool(name, input, ctx) {
  if (name.startsWith('propose_')) return proposeAction(name.slice('propose_'.length), input || {}, ctx);
  if (name === 'save_note') return { result: await saveNote(input || {}) };
  if (name === 'get_action_history') return { result: await getActionHistory(input || {}) };
  throw new Error(`Unknown tool: ${name}`);
}

// Memory shown to the AI at the start of every conversation.
export async function getMemoryText() {
  await dbConnect();
  const [notes, applied] = await Promise.all([
    AINote.find().sort({ createdAt: -1 }).limit(20).lean(),
    AIAction.find({ status: { $in: ['executed', 'undone'] } }).sort({ updatedAt: -1 }).limit(10).lean()
  ]);

  const lines = [];
  if (notes.length) {
    lines.push('Your notes (newest first):');
    for (const n of notes) {
      lines.push(`- [${n.kind}] ${istDateKey(n.createdAt)}: ${n.text}${n.reviewOn ? ` (review on ${istDateKey(n.reviewOn)})` : ''}`);
    }
  }
  if (applied.length) {
    lines.push('Recent changes the owner approved or reversed:');
    for (const a of applied) {
      lines.push(`- ${a.executedAt ? istDateKey(a.executedAt) : istDateKey(a.createdAt)}: ${a.summary} [${a.status}]`);
    }
  }
  return lines.join('\n');
}

// ---------- the admin decides ----------
export async function approveAction(id, adminEmail) {
  await dbConnect();
  const now = new Date();

  // Atomic: only one request can ever move a proposal from "pending" to "executing".
  const doc = await AIAction.findOneAndUpdate(
    { _id: id, status: 'pending', expiresAt: { $gt: now } },
    { $set: { status: 'executing', decidedBy: adminEmail, decidedAt: now } },
    { new: true }
  );
  if (!doc) {
    const existing = await AIAction.findById(id);
    if (!existing) throw new ActionError('Proposal not found.', 404);
    throw new ActionError(`This proposal is already ${effectiveStatus(existing)}.`, 409);
  }

  try {
    const { result, undo } = await ACTIONS[doc.type].execute(doc.params, doc.before);
    doc.status = 'executed';
    doc.executedAt = new Date();
    doc.result = result;
    doc.undo = undo ?? null;
    console.log('[cofounder action executed]', doc.type, String(doc._id), adminEmail);
  } catch (err) {
    doc.status = 'failed';
    doc.error = err.message || 'Failed to apply.';
    console.error('[cofounder action failed]', doc.type, String(doc._id), err.message);
  }
  await doc.save();
  return toPublic(doc);
}

export async function rejectAction(id, adminEmail) {
  await dbConnect();
  const now = new Date();
  const doc = await AIAction.findOneAndUpdate(
    { _id: id, status: 'pending' },
    { $set: { status: 'rejected', decidedBy: adminEmail, decidedAt: now } },
    { new: true }
  );
  if (!doc) {
    const existing = await AIAction.findById(id);
    if (!existing) throw new ActionError('Proposal not found.', 404);
    throw new ActionError(`This proposal is already ${effectiveStatus(existing)}.`, 409);
  }
  return toPublic(doc);
}

export async function undoAction(id, adminEmail) {
  await dbConnect();
  const doc = await AIAction.findOneAndUpdate(
    { _id: id, status: 'executed', undo: { $ne: null } },
    { $set: { status: 'executing' } },
    { new: true }
  );
  if (!doc) throw new ActionError('This change cannot be undone (it was not applied, or was already undone).', 409);

  try {
    const message = await ACTIONS[doc.type].undo(doc.undo);
    doc.status = 'undone';
    doc.undoneAt = new Date();
    doc.result = message;
    console.log('[cofounder action undone]', doc.type, String(doc._id), adminEmail);
  } catch (err) {
    doc.status = 'executed'; // still applied, the undo did not work
    doc.error = `Undo failed: ${err.message}`;
  }
  await doc.save();
  return toPublic(doc);
}