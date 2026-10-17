import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';
import Combo from '@/models/Combo';
import Order from '@/models/Order';
import Invoice from '@/models/Invoice';
import { buildOps, applyOps, rollbackOps } from '@/lib/stockDeduct';

// TODO: add your admin session check at the top of GET / POST / PUT / DELETE.

const json = (data, status = 200) => NextResponse.json(data, { status });
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const num = (v) => Number(v) || 0;
// image can be a url string or an object like { url }
const imgOf = (x) => (typeof x === 'string' ? x : x?.url || x?.secure_url || x?.src || '');

function describe(i) {
  const parts = [];
  if (i.packDetails?.colors?.length)
    parts.push(`Pack of ${i.packDetails.packSize}: ` + i.packDetails.colors.map((c) => `${c.name} x${c.qty}`).join(', '));
  if (i.sleeveType) parts.push(i.sleeveType);
  if (i.zipType) parts.push(i.zipType);
  if (i.pantOption?.name) parts.push(`Pant: ${i.pantOption.name}`);
  if (i.shawlOption?.name) parts.push(`Shawl: ${i.shawlOption.name}`);
  return parts.join(' • ');
}

// load combos + products needed to build stock ops for these lines
async function loadMaps(lines) {
  const comboIds = [...new Set(lines.filter((i) => i.isCombo && i.comboId).map((i) => String(i.comboId)))];
  const combos = comboIds.length ? await Combo.find({ _id: { $in: comboIds } }).lean() : [];
  const pids = new Set();
  lines.forEach((i) => { if (!i.isCombo && i.product) pids.add(String(i.product)); });
  combos.forEach((c) => { if (c.type === 'color-pack' && c.baseProduct) pids.add(String(c.baseProduct)); });
  const products = pids.size ? await Product.find({ _id: { $in: [...pids] } }).lean() : [];
  return {
    comboMap: new Map(combos.map((c) => [String(c._id), c])),
    productMap: new Map(products.map((p) => [String(p._id), p])),
  };
}

// deduct stock for lines; pushes every applied op into `applied` so caller can roll back
async function deduct(lines, maps, applied) {
  for (const item of lines) {
    const ops = buildOps(item, maps.comboMap.get(String(item.comboId)), maps.productMap);
    await applyOps(ops, applied);
  }
}

// One-time self-heal: an older version created a NON-sparse unique index on `order`,
// which makes every manual invoice (no order) collide as { order: null }.
// Drop it if present, then let Mongoose rebuild indexes from models/Invoice.js.
let indexFix;
function ensureIndexes() {
  if (!indexFix) {
    indexFix = (async () => {
      try {
        const idx = await Invoice.collection.indexes().catch(() => []);
        if (idx.some((i) => i.name === 'order_1' && !i.sparse)) {
          await Invoice.collection.dropIndex('order_1');
        }
        await Invoice.createIndexes();
      } catch (e) {
        console.error('Invoice index fix failed:', e.message);
        indexFix = null; // retry on next request
      }
    })();
  }
  return indexFix;
}

const errStatus = (e) => (e.code === 'INSUFFICIENT_STOCK' ? 409 : 400);

function money(items, discount, shippingFee) {
  const subtotal = items.reduce((s, i) => s + num(i.price) * num(i.qty), 0);
  const d = Math.max(0, num(discount));
  const f = Math.max(0, num(shippingFee));
  return { subtotal, discount: d, shippingFee: f, total: Math.max(0, subtotal - d + f) };
}

function checkItems(items) {
  if (!Array.isArray(items) || items.length === 0) return 'Add at least one product';
  for (const i of items) {
    if (!mongoose.isValidObjectId(i.product)) return 'Invalid product';
    if (!i.size || (!i.variantId && !i.color)) return 'Choose a size for every product';
    if (!Number.isInteger(Number(i.qty)) || Number(i.qty) < 1) return 'Quantity must be 1 or more';
    if (!(Number(i.price) >= 0)) return 'Invalid price';
  }
  return null;
}

// turn client lines into trusted lines (name/sku taken from the DB)
async function manualLines(items) {
  const raw = items.map((i) => ({
    product: i.product, variantId: i.variantId || undefined, color: i.color || '', size: i.size,
    qty: Number(i.qty), price: Number(i.price),
  }));
  const maps = await loadMaps(raw);
  const lines = raw.map((l) => {
    const p = maps.productMap.get(String(l.product));
    const v = p?.variants?.find((x) => String(x._id) === String(l.variantId)) ||
      p?.variants?.find((x) => String(x.color || '').toLowerCase().trim() === String(l.color).toLowerCase().trim());
    const image = imgOf(v?.images?.[0] ?? v?.image ?? p?.images?.[0] ?? p?.image ?? p?.thumbnail);
    return { ...l, name: p?.name || 'Unknown product', sku: p?.sku || '', image };
  });
  return { lines, maps };
}

function commonFields(b) {
  return {
    customer: { name: b.customer?.name?.trim(), phone: b.customer?.phone, email: b.customer?.email },
    shippingAddress: b.shippingAddress || {},
    paymentMethod: b.paymentMethod || 'cash',
    paymentStatus: b.paymentStatus || 'paid',
    notes: b.notes || '',
  };
}

// ───────────────────────── GET ─────────────────────────
// ?id=            one invoice
// ?orders=1       orders without an invoice yet
// ?products=1&q=&category=&skip=&limit=  browse products (or &ids=a,b to hydrate specific ones)
// ?categories=1   category list
// (none)          recent invoices
export async function GET(req) {
  await dbConnect();
  const sp = new URL(req.url).searchParams;

  if (sp.get('id')) {
    const inv = await Invoice.findById(sp.get('id')).lean();
    return inv ? json(inv) : json({ error: 'Not found' }, 404);
  }

  if (sp.get('categories')) {
    const cats = await mongoose.connection.collection('categories').find({}).toArray();
    return json(
      cats.map((c) => ({ _id: String(c._id), name: c.name || c.title || '' })).filter((c) => c.name)
    );
  }

  if (sp.get('products')) {
    const ids = sp.get('ids');
    const q = (sp.get('q') || '').trim();
    const category = sp.get('category');
    const skip = Math.max(0, parseInt(sp.get('skip')) || 0);
    const limit = Math.min(50, parseInt(sp.get('limit')) || 20);
    const toOid = (x) => new mongoose.Types.ObjectId(x);

    const cats = await mongoose.connection.collection('categories').find({}).toArray();
    const catName = new Map(cats.map((c) => [String(c._id), c.name || c.title || '']));

    const filter = {};
    if (ids) {
      filter._id = { $in: ids.split(',').filter((x) => mongoose.isValidObjectId(x)).map(toOid) };
    } else {
      filter.isActive = { $ne: false };
      if (q) filter.name = { $regex: esc(q), $options: 'i' };
      if (category && mongoose.isValidObjectId(category)) {
        // works whether products store the category id (ObjectId/string) or its name
        const vals = [category, toOid(category), catName.get(category)].filter(Boolean);
        filter.$or = [{ category: { $in: vals } }, { categories: { $in: vals } }];
      }
    }

    const ps = await Product.collection
      .find(filter)
      .sort({ name: 1 })
      .skip(ids ? 0 : skip)
      .limit(ids ? 50 : limit)
      .toArray();

    return json(
      ps.map((p) => {
        const cid = Array.isArray(p.categories) && p.categories.length ? p.categories[0] : p.category;
        return {
          _id: String(p._id),
          name: p.name,
          sku: p.sku || '',
          category: catName.get(String(cid)) || (typeof cid === 'string' ? cid : ''),
          // adjust if your price field has another name
          // your products use basePrice (fallback: first variant's price)
          price: p.basePrice ?? p.variants?.[0]?.price ?? p.salePrice ?? p.price ?? 0,
          image: imgOf(p.images?.[0] ?? p.image ?? p.thumbnail),
          variants: (p.variants || []).map((v) => ({
            id: String(v._id),
            color: v.color || '',
            image: imgOf(v.images?.[0] ?? v.image),
            sizes: (v.sizes || []).map((s) => ({ size: s.size, stock: s.stock || 0 })),
          })),
        };
      })
    );
  }

  if (sp.get('orders')) {
    const invoiced = await Invoice.find({ order: { $ne: null } }).select('order').lean();
    const orders = await Order.find({
      _id: { $nin: invoiced.map((i) => i.order) },
      status: { $nin: ['cancelled', 'returned'] },
      paymentStatus: { $ne: 'failed' },
    })
      .select('orderNumber customer total status paymentMethod paymentStatus createdAt')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return json(orders);
  }

  return json(await Invoice.find().sort({ createdAt: -1 }).limit(100).lean());
}

// ───────────────────────── POST ─────────────────────────
// { orderId }                  -> invoice from an order
// { customer, items, ... }     -> manual invoice
export async function POST(req) {
  await dbConnect();
  await ensureIndexes();
  const b = await req.json().catch(() => ({}));
  return b.orderId ? fromOrder(b.orderId) : createManual(b);
}

async function fromOrder(orderId) {
  if (await Invoice.findOne({ order: orderId }).lean()) return json({ error: 'Invoice already exists' }, 409);

  const order = await Order.findById(orderId).lean();
  if (!order) return json({ error: 'Order not found' }, 404);
  if (['cancelled', 'returned'].includes(order.status) || order.paymentStatus === 'failed')
    return json({ error: `Cannot invoice a ${order.status} / ${order.paymentStatus} order` }, 400);

  const lines = order.items || [];
  const maps = await loadMaps(lines);
  const applied = [];
  try {
    await deduct(lines, maps, applied);
  } catch (e) {
    await rollbackOps(applied);
    return json({ error: e.message }, errStatus(e));
  }

  try {
    const invoice = await Invoice.create({
      invoiceNumber: `INV-${order.orderNumber}`,
      source: 'order',
      order: order._id,
      orderNumber: order.orderNumber,
      customer: order.customer,
      shippingAddress: order.shippingAddress,
      items: lines.map((i) => ({
        product: i.product, name: i.name, sku: i.sku, image: i.image, color: i.color, size: i.size,
        qty: i.qty, price: i.price, details: describe(i),
      })),
      subtotal: order.subtotal,
      discount: order.discount,
      couponCode: order.couponCode,
      shippingFee: order.shippingFee,
      total: order.total,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
    });
    return json(invoice, 201);
  } catch (e) {
    await rollbackOps(applied);
    return json({ error: 'Could not create invoice: ' + e.message }, 500);
  }
}

async function createManual(b) {
  const f = commonFields(b);
  if (!f.customer.name) return json({ error: 'Customer name is required' }, 400);
  const bad = checkItems(b.items);
  if (bad) return json({ error: bad }, 400);

  const { lines, maps } = await manualLines(b.items);
  const applied = [];
  try {
    await deduct(lines, maps, applied);
  } catch (e) {
    await rollbackOps(applied);
    return json({ error: e.message }, errStatus(e));
  }

  try {
    const invoice = await Invoice.create({
      ...f,
      invoiceNumber: `INV-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Date.now().toString().slice(-6)}`,
      source: 'manual',
      items: lines,
      ...money(lines, b.discount, b.shippingFee),
    });
    return json(invoice, 201);
  } catch (e) {
    await rollbackOps(applied);
    return json({ error: 'Could not create invoice: ' + e.message }, 500);
  }
}

// ───────────────────────── PUT (edit) ─────────────────────────
// manual invoice: everything editable, stock is adjusted
// order invoice : customer / address / discount / shipping / payment / notes only
export async function PUT(req) {
  await dbConnect();
  const b = await req.json().catch(() => ({}));
  const inv = b.id ? await Invoice.findById(b.id).lean() : null;
  if (!inv) return json({ error: 'Invoice not found' }, 404);

  const f = commonFields(b);
  if (!f.customer.name) return json({ error: 'Customer name is required' }, 400);

  // order invoice: no stock change
  if (inv.source === 'order') {
    const m = money(inv.items, b.discount, b.shippingFee);
    const updated = await Invoice.findByIdAndUpdate(inv._id, { $set: { ...f, ...m } }, { new: true }).lean();
    return json(updated);
  }

  // manual invoice
  const bad = checkItems(b.items);
  if (bad) return json({ error: bad }, 400);
  const { lines: newLines, maps: newMaps } = await manualLines(b.items);
  const oldMaps = await loadMaps(inv.items);
  const maps = {
    comboMap: new Map(),
    productMap: new Map([...oldMaps.productMap, ...newMaps.productMap]),
  };

  // 1) put the old quantities back
  let oldOps;
  try {
    oldOps = inv.items.flatMap((i) => buildOps(i, null, maps.productMap));
  } catch (e) {
    return json({ error: 'Cannot restore old stock: ' + e.message }, 400);
  }
  await rollbackOps(oldOps);

  // 2) take the new quantities; if anything fails, go back to the old state
  const applied = [];
  try {
    await deduct(newLines, maps, applied);
  } catch (e) {
    await rollbackOps(applied);
    await applyOps(oldOps).catch(() => {});
    return json({ error: e.message }, errStatus(e));
  }

  try {
    const updated = await Invoice.findByIdAndUpdate(
      inv._id,
      { $set: { ...f, items: newLines, ...money(newLines, b.discount, b.shippingFee) } },
      { new: true }
    ).lean();
    return json(updated);
  } catch (e) {
    await rollbackOps(applied);
    await applyOps(oldOps).catch(() => {});
    return json({ error: 'Could not save invoice: ' + e.message }, 500);
  }
}

// ───────────────────────── DELETE (void: restores stock) ─────────────────────────
export async function DELETE(req) {
  await dbConnect();
  const id = new URL(req.url).searchParams.get('id');
  const inv = id ? await Invoice.findById(id).lean() : null;
  if (!inv) return json({ error: 'Invoice not found' }, 404);

  let lines = inv.items;
  if (inv.source === 'order') {
    const order = await Order.findById(inv.order).lean();
    if (!order) return json({ error: 'Original order not found, cannot restore stock' }, 400);
    lines = order.items || [];
  }

  const maps = await loadMaps(lines);
  let ops;
  try {
    ops = lines.flatMap((i) => buildOps(i, maps.comboMap.get(String(i.comboId)), maps.productMap));
  } catch (e) {
    return json({ error: 'Cannot restore stock: ' + e.message }, 400);
  }

  await rollbackOps(ops); // add the stock back
  try {
    await Invoice.deleteOne({ _id: inv._id });
  } catch (e) {
    await applyOps(ops).catch(() => {});
    return json({ error: 'Could not delete invoice' }, 500);
  }
  return json({ ok: true });
}