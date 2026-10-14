import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireAdmin } from '@/lib/apiAuth';
import { approveAction, rejectAction, undoAction, ActionError } from '@/lib/cofounderActions';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// POST { "decision": "approve" | "reject" | "undo" }
// This is the only place a proposed change can be applied, and it requires a
// logged-in admin. The AI has no tool that reaches this route.
export const POST = requireAdmin(async (req, ctx, admin) => {
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: 'Invalid proposal id.' }, { status: 400 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const decision = body?.decision;
  const who = admin?.email || 'admin';

  try {
    let action;
    if (decision === 'approve') action = await approveAction(id, who);
    else if (decision === 'reject') action = await rejectAction(id, who);
    else if (decision === 'undo') action = await undoAction(id, who);
    else return NextResponse.json({ error: 'decision must be approve, reject or undo.' }, { status: 400 });

    return NextResponse.json({ action });
  } catch (err) {
    if (err instanceof ActionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[ai-actions]', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
});