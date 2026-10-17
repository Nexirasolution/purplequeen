export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import StockNotification from '@/models/StockNotification';
import { requireAdmin } from '@/lib/apiAuth';

// GET /api/admin/notify -> all stock-notification requests, never cached
export const GET = requireAdmin(async () => {
  try {
    await dbConnect();
    const rows = await StockNotification.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json(
      rows.map((r) => ({ ...r, _id: String(r._id) })),
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('GET /api/admin/notify error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch requests' }, { status: 500 });
  }
});

// PATCH -> mark one request as notified (admin sent the WhatsApp message)
export const PATCH = requireAdmin(async (req) => {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await dbConnect();
    await StockNotification.findByIdAndUpdate(id, { status: 'notified', notifiedAt: new Date() });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/admin/notify error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update request' }, { status: 500 });
  }
});

// DELETE -> remove one request
export const DELETE = requireAdmin(async (req) => {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await dbConnect();
    await StockNotification.findByIdAndDelete(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/admin/notify error:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete request' }, { status: 500 });
  }
});