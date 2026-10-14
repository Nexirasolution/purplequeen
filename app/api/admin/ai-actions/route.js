import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import AIAction from '@/models/AIAction';
import { requireAdmin } from '@/lib/apiAuth';
import { toPublic } from '@/lib/cofounderActions';

export const dynamic = 'force-dynamic';

// Pending proposals (newest first) and the recent history of everything else.
export const GET = requireAdmin(async () => {
  await dbConnect();
  const now = new Date();

  const [pending, recent] = await Promise.all([
    AIAction.find({ status: 'pending', expiresAt: { $gt: now } }).sort({ createdAt: -1 }).limit(50).lean(),
    AIAction.find({ $or: [{ status: { $ne: 'pending' } }, { expiresAt: { $lte: now } }] })
      .sort({ updatedAt: -1 })
      .limit(30)
      .lean()
  ]);

  return NextResponse.json({ pending: pending.map(toPublic), recent: recent.map(toPublic) });
});