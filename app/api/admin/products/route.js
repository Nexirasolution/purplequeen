export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';
import { requireAdmin } from '@/lib/apiAuth';

// GET /api/admin/products -> every product (active + inactive), never cached
export const GET = requireAdmin(async () => {
  try {
    await dbConnect();
    const products = await Product.find({})
      .populate('category', 'name slug type')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(
      { products, total: products.length },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('GET /api/admin/products error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch products' }, { status: 500 });
  }
});