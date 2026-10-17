import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb'; // named export (lib/mongodb.js has no default export)
import StockNotification from '@/models/StockNotification';

export async function POST(req) {
  try {
    const { productId, productSlug, productName, productImage, name, phone } = await req.json();

    const digits = String(phone || '').replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
    if (!productId || !name?.trim() || !/^[6-9]\d{9}$/.test(digits)) {
      return NextResponse.json({ error: 'Invalid details' }, { status: 400 });
    }

    await dbConnect();
    await StockNotification.findOneAndUpdate(
      { productId: String(productId), phone: `91${digits}` },
      {
        $set: {
          name: name.trim().slice(0, 60),
          productSlug, productName, productImage,
          status: 'pending', // re-subscribing resets an old "notified" entry
        },
        $unset: { notifiedAt: '' },
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[/api/notify] failed:', e); // <-- read this in your terminal
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}