// Discount helpers (shared by API routes, server pages and client components).
// IMPORTANT: no server-only imports here: the admin page uses this on the client.

// Is this product's discount switched on AND inside its start/end window?
export function isDiscountLive(product, now = new Date()) {
  const d = product?.discount;
  if (!d?.isActive || !(Number(d.value) > 0)) return false;
  if (d.startsAt && new Date(d.startsAt) > now) return false;
  if (d.endsAt && new Date(d.endsAt) < now) return false;
  return true;
}

// Discounted price for ONE unit. Works for variant price, size price or basePrice.
export function applyDiscount(price, discount) {
  const p = Number(price) || 0;
  const v = Number(discount?.value) || 0;
  const off = discount?.type === 'flat' ? v : (p * v) / 100;
  return Math.max(0, Math.round(p - off));
}

// Mongo filter for "discount is live right now"
export function liveDiscountQuery(now = new Date()) {
  return {
    'discount.isActive': true,
    'discount.value': { $gt: 0 },
    $and: [
      { $or: [{ 'discount.startsAt': null }, { 'discount.startsAt': { $lte: now } }] },
      { $or: [{ 'discount.endsAt': null }, { 'discount.endsAt': { $gte: now } }] },
    ],
  };
}

// Cleans body.discount coming from the admin (updates skip schema validators).
// Only touched when the request actually sends it, so partial updates
// (e.g. the inventory page saving stock) never wipe a product's discount.
export function sanitizeDiscount(body) {
  if (!body || !('discount' in body)) return;
  const d = body.discount || {};
  const type = d.type === 'flat' ? 'flat' : 'percent';
  let value = Math.max(0, Number(d.value) || 0);
  if (type === 'percent') value = Math.min(value, 95);
  body.discount = {
    isActive: !!d.isActive && value > 0,
    type,
    value,
    startsAt: d.startsAt ? new Date(d.startsAt) : null,
    endsAt: d.endsAt ? new Date(d.endsAt) : null,
  };
}