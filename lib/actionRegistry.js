import Product from '@/models/Product';
import Coupon from '@/models/Coupon';
import Settings from '@/models/Settings';
import Review from '@/models/Review';
import { istDateKey } from './salesRules';

// THE ONLY CHANGES THE AI CAN EVER PROPOSE. Anything not listed here is impossible:
// orders, payments, customers and admin accounts are deliberately not included.
//
// Every entry has:
//   tool     what Claude sees (name, description, input schema)
//   prepare  validates input against hard limits, reads current data, and returns the
//            normalised params + a server-written preview + a "before" snapshot
//   execute  runs ONLY after an admin approves; re-checks the snapshot first
//   undo     reverses an executed change

// ---------- hard limits ----------
const MAX_PRICE_CHANGE_PCT = 40;
const MAX_PERCENT_COUPON = 40;
const MAX_FLAT_COUPON = 1500;
const MAX_COUPON_DAYS = 90;
const MAX_STOCK = 100000;

// ---------- helpers ----------
const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const clip = (s, n = 140) => {
  s = String(s ?? '');
  return s.length > n ? s.slice(0, n) + '…' : s;
};
const scale = (price, pct) => Math.round(price * (1 + pct / 100));
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const addDays = (n) => new Date(Date.now() + n * 86400000);

function num(v, name, min, max, int = false) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max || (int && !Number.isInteger(n))) {
    throw new Error(`${name} must be ${int ? 'a whole number' : 'a number'} between ${min} and ${max}.`);
  }
  return n;
}

// Plain text only: no HTML can reach your storefront through the AI.
function text(v, name, max) {
  const s = String(v ?? '').trim();
  if (/[<>]/.test(s)) throw new Error(`${name} must be plain text (no < or > characters).`);
  if (s.length > max) throw new Error(`${name} is too long (max ${max} characters).`);
  return s;
}

async function findProduct(identifier) {
  const key = String(identifier || '').trim();
  if (!key) throw new Error('product is required (slug or SKU).');
  const p = await Product.findOne({ $or: [{ slug: key.toLowerCase() }, { sku: key.toUpperCase() }] });
  if (!p) throw new Error(`Product not found: "${key}". Use get_product_details or get_top_products to find the slug/SKU.`);
  return p;
}

// Lowest price across all colours and sizes (same rule your Product model describes for basePrice).
function lowestPrice(product) {
  let min = Infinity;
  for (const v of product.variants) {
    if (v.sizes && v.sizes.length) {
      for (const s of v.sizes) {
        const p = s.price > 0 ? s.price : v.price;
        if (p < min) min = p;
      }
    } else if (v.price < min) {
      min = v.price;
    }
  }
  return Number.isFinite(min) ? min : product.basePrice;
}

function findVariant(product, color) {
  const c = String(color || '').trim().toLowerCase();
  const v = product.variants.find((x) => (x.color || '').toLowerCase() === c);
  if (!v) {
    const list = product.variants.map((x) => x.color || '(default)').join(', ');
    throw new Error(`No colour "${color}" on ${product.name}. Available: ${list}`);
  }
  return v;
}

const why = {
  reason: {
    type: 'string',
    description: 'Why you recommend this, with the numbers that support it. Shown to the owner.'
  }
};

export const ACTIONS = {
  // ------------------------------------------------------------------ price
  price_change: {
    tool: {
      name: 'propose_price_change',
      description:
        'Propose changing a product price by a percentage (all colours, or one colour). Max ±40%. The owner must approve before anything changes. Prefer small tests (5-15%) on one product, with a review date.',
      input_schema: {
        type: 'object',
        properties: {
          product: { type: 'string', description: 'Product slug or SKU' },
          color: { type: 'string', description: 'Optional: change only this colour' },
          change_percent: { type: 'number', description: 'Negative to cut, positive to raise, e.g. -10' },
          show_old_price_as_compare_at: {
            type: 'boolean',
            description: 'When cutting, show the old price as the struck-through compare-at price'
          },
          ...why
        },
        required: ['product', 'change_percent', 'reason']
      }
    },

    async prepare(input) {
      const pct = num(input.change_percent, 'change_percent', -MAX_PRICE_CHANGE_PCT, MAX_PRICE_CHANGE_PCT);
      if (pct === 0) throw new Error('change_percent cannot be 0.');
      const p = await findProduct(input.product);
      const targets = input.color ? [findVariant(p, input.color)] : p.variants;
      if (!targets.length) throw new Error(`${p.name} has no colour variants to change.`);

      const before = {};
      const preview = [];
      for (const v of targets) {
        const next = scale(v.price, pct);
        if (next < 1) throw new Error('That change would make a price below ₹1.');
        before[String(v._id)] = v.price;
        preview.push(`${p.name} (${v.color || 'default'}): ${rupees(v.price)} → ${rupees(next)}`);
      }
      const keepOld = !!input.show_old_price_as_compare_at && pct < 0;
      if (keepOld) preview.push('Old price will be shown as the compare-at (struck-through) price.');
      preview.push('Size-specific prices, where set, change by the same percentage.');

      const abs = Math.abs(pct);
      return {
        params: {
          productId: String(p._id),
          variantIds: targets.map((v) => String(v._id)),
          changePercent: pct,
          keepOld
        },
        before,
        summary: `${pct > 0 ? 'Raise' : 'Cut'} the price of ${p.name}${input.color ? ` (${input.color})` : ''} by ${abs}%`,
        preview,
        risk: abs > 25 ? 'high' : abs > 12 ? 'medium' : 'low'
      };
    },

    async execute(params, before) {
      const p = await Product.findById(params.productId);
      if (!p) throw new Error('The product no longer exists.');

      // Verify everything first, change nothing until all checks pass.
      for (const vid of params.variantIds) {
        const v = p.variants.id(vid);
        if (!v) throw new Error('A colour variant no longer exists. Ask me to propose again.');
        if (v.price !== before[vid]) {
          throw new Error(`The price changed since this was proposed (now ${rupees(v.price)}). Ask me to propose again.`);
        }
      }

      const undo = { productId: params.productId, basePrice: p.basePrice, variants: {} };
      for (const vid of params.variantIds) {
        const v = p.variants.id(vid);
        const oldPrice = v.price;
        undo.variants[vid] = {
          price: v.price,
          compareAtPrice: v.compareAtPrice,
          sizes: v.sizes.map((s) => ({ id: String(s._id), price: s.price }))
        };
        v.price = scale(v.price, params.changePercent);
        for (const s of v.sizes) if (s.price > 0) s.price = scale(s.price, params.changePercent);
        if (params.keepOld) v.compareAtPrice = Math.max(v.compareAtPrice || 0, oldPrice);
      }
      p.basePrice = lowestPrice(p);
      await p.save();
      return {
        result: `Updated ${params.variantIds.length} colour(s) of ${p.name}. Lowest price is now ${rupees(p.basePrice)}.`,
        undo
      };
    },

    async undo(u) {
      const p = await Product.findById(u.productId);
      if (!p) throw new Error('The product no longer exists.');
      for (const [vid, old] of Object.entries(u.variants)) {
        const v = p.variants.id(vid);
        if (!v) continue;
        v.price = old.price;
        v.compareAtPrice = old.compareAtPrice;
        for (const s of old.sizes) {
          const sub = v.sizes.id(s.id);
          if (sub) sub.price = s.price;
        }
      }
      p.basePrice = lowestPrice(p);
      await p.save();
      return `Restored the previous prices of ${p.name}.`;
    }
  },

  // ------------------------------------------------------------------ stock
  stock_update: {
    tool: {
      name: 'propose_stock_update',
      description:
        'Propose setting the stock of ONE product colour and size to an exact number. Only use this when the owner told you the real numbers (for example a restock they received). Never guess stock.',
      input_schema: {
        type: 'object',
        properties: {
          product: { type: 'string', description: 'Product slug or SKU' },
          color: { type: 'string' },
          size: { type: 'string', description: 'For example M, L, XL' },
          new_stock: { type: 'integer', description: 'The exact stock after the change' },
          ...why
        },
        required: ['product', 'color', 'size', 'new_stock', 'reason']
      }
    },

    async prepare(input) {
      const stock = num(input.new_stock, 'new_stock', 0, MAX_STOCK, true);
      const p = await findProduct(input.product);
      const v = findVariant(p, input.color);
      const sz = v.sizes.find((s) => (s.size || '').toLowerCase() === String(input.size || '').trim().toLowerCase());
      if (!sz) {
        throw new Error(`No size "${input.size}" for ${p.name} (${v.color}). Sizes: ${v.sizes.map((s) => s.size).join(', ')}`);
      }
      if (sz.stock === stock) throw new Error('Stock is already that number.');
      return {
        params: { productId: String(p._id), variantId: String(v._id), sizeId: String(sz._id), newStock: stock },
        before: { stock: sz.stock },
        summary: `Set stock of ${p.name} (${v.color || 'default'}, ${sz.size}) to ${stock}`,
        preview: [`${p.name} / ${v.color || 'default'} / ${sz.size}: stock ${sz.stock} → ${stock}`],
        risk: 'medium'
      };
    },

    async execute(params, before) {
      const p = await Product.findById(params.productId);
      const sz = p?.variants.id(params.variantId)?.sizes.id(params.sizeId);
      if (!sz) throw new Error('That product size no longer exists.');
      if (sz.stock !== before.stock) {
        throw new Error(`Stock changed since this was proposed (now ${sz.stock}). Ask me to propose again.`);
      }
      const undo = { productId: params.productId, variantId: params.variantId, sizeId: params.sizeId, stock: sz.stock };
      sz.stock = params.newStock;
      await p.save();
      return { result: `Stock set to ${params.newStock}.`, undo };
    },

    async undo(u) {
      const p = await Product.findById(u.productId);
      const sz = p?.variants.id(u.variantId)?.sizes.id(u.sizeId);
      if (!sz) throw new Error('That product size no longer exists.');
      sz.stock = u.stock;
      await p.save();
      return `Stock restored to ${u.stock}.`;
    }
  },

  // ------------------------------------------------------------------ product content & flags
  product_update: {
    tool: {
      name: 'propose_product_update',
      description:
        'Propose changing a product description, tags, SEO title/description, or its visibility flags (featured, best seller, top seller, ready to ship, active). Plain text only. Include only the fields you want to change.',
      input_schema: {
        type: 'object',
        properties: {
          product: { type: 'string', description: 'Product slug or SKU' },
          description: { type: 'string', description: 'New description, plain text, max 4000 characters' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Full replacement tag list, max 20' },
          seo_title: { type: 'string', description: 'Max 70 characters' },
          seo_description: { type: 'string', description: 'Max 170 characters' },
          is_featured: { type: 'boolean' },
          is_best_seller: { type: 'boolean' },
          is_top_seller: { type: 'boolean' },
          is_ready_to_ship: { type: 'boolean' },
          is_active: { type: 'boolean', description: 'false HIDES the product from the store' },
          ...why
        },
        required: ['product', 'reason']
      }
    },

    async prepare(input) {
      const p = await findProduct(input.product);
      const next = {};

      if (input.description !== undefined) next.description = text(input.description, 'description', 4000);
      if (input.seo_title !== undefined) next.seoTitle = text(input.seo_title, 'seo_title', 70);
      if (input.seo_description !== undefined) next.seoDescription = text(input.seo_description, 'seo_description', 170);
      if (input.tags !== undefined) {
        if (!Array.isArray(input.tags) || input.tags.length > 20) throw new Error('tags must be a list of at most 20 items.');
        next.tags = [...new Set(input.tags.map((t) => text(t, 'tag', 30)).filter(Boolean))];
      }
      for (const [inKey, field] of [
        ['is_featured', 'isFeatured'],
        ['is_best_seller', 'isBestSeller'],
        ['is_top_seller', 'isTopSeller'],
        ['is_ready_to_ship', 'isReadyToShip'],
        ['is_active', 'isActive']
      ]) {
        if (input[inKey] !== undefined) {
          if (typeof input[inKey] !== 'boolean') throw new Error(`${inKey} must be true or false.`);
          next[field] = input[inKey];
        }
      }

      const before = {};
      const changes = {};
      const preview = [];
      for (const [field, value] of Object.entries(next)) {
        const current = p[field];
        if (same(current, value)) continue;
        before[field] = current ?? null;
        changes[field] = value;
        const show = (x) => (Array.isArray(x) ? x.join(', ') : typeof x === 'boolean' ? (x ? 'yes' : 'no') : clip(x, 110) || '(empty)');
        preview.push(`${p.name} › ${field}: ${show(current)} → ${show(value)}`);
      }
      if (!Object.keys(changes).length) throw new Error('Nothing would change: those values are already set.');

      return {
        params: { productId: String(p._id), changes },
        before,
        summary: `Update ${p.name}: ${Object.keys(changes).join(', ')}`,
        preview,
        risk: changes.isActive === false ? 'high' : 'low'
      };
    },

    async execute(params, before) {
      const p = await Product.findById(params.productId);
      if (!p) throw new Error('The product no longer exists.');
      for (const field of Object.keys(params.changes)) {
        if (!same(p[field], before[field])) {
          throw new Error(`"${field}" was edited since this was proposed. Ask me to propose again.`);
        }
      }
      for (const [field, value] of Object.entries(params.changes)) p[field] = value;
      await p.save();
      return { result: `Updated ${Object.keys(params.changes).join(', ')} on ${p.name}.`, undo: { productId: params.productId, before } };
    },

    async undo(u) {
      const p = await Product.findById(u.productId);
      if (!p) throw new Error('The product no longer exists.');
      for (const [field, value] of Object.entries(u.before)) p[field] = value;
      await p.save();
      return `Restored the previous values on ${p.name}.`;
    }
  },

  // ------------------------------------------------------------------ coupons
  coupon_create: {
    tool: {
      name: 'propose_coupon_create',
      description:
        'Propose a new discount coupon. Hard limits: percent max 40, flat max ₹1,500, expiry max 90 days. Percent coupons above 15% must set max_discount. Prefer short expiries and usage limits.',
      input_schema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: '3-20 letters/numbers, e.g. DIWALI10' },
          type: { type: 'string', enum: ['percent', 'flat'] },
          value: { type: 'number', description: 'Percent (1-40) or rupees (1-1500)' },
          min_order_value: { type: 'number', description: 'Minimum cart value in ₹ (0 = none)' },
          max_discount: { type: 'number', description: 'Cap in ₹ for percent coupons (0 = none)' },
          expires_in_days: { type: 'integer', description: '1-90, default 14' },
          usage_limit: { type: 'integer', description: 'Total uses allowed, default 500, 0 = unlimited' },
          ...why
        },
        required: ['code', 'type', 'value', 'reason']
      }
    },

    async prepare(input) {
      const code = String(input.code || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{3,20}$/.test(code)) throw new Error('code must be 3-20 letters or numbers.');
      if (input.type !== 'percent' && input.type !== 'flat') throw new Error('type must be "percent" or "flat".');
      const value = input.type === 'percent' ? num(input.value, 'value', 1, MAX_PERCENT_COUPON) : num(input.value, 'value', 1, MAX_FLAT_COUPON);
      const minOrder = num(input.min_order_value ?? 0, 'min_order_value', 0, 1000000);
      const maxDiscount = num(input.max_discount ?? 0, 'max_discount', 0, MAX_FLAT_COUPON * 4);
      const dayCount = num(input.expires_in_days ?? 14, 'expires_in_days', 1, MAX_COUPON_DAYS, true);
      const limit = num(input.usage_limit ?? 500, 'usage_limit', 0, 100000, true);
      if (input.type === 'percent' && value > 15 && maxDiscount === 0) {
        throw new Error('Percent coupons above 15% must set max_discount so one big order cannot get a huge discount.');
      }
      if (await Coupon.exists({ code })) throw new Error(`A coupon with code ${code} already exists.`);

      const expiresAt = addDays(dayCount);
      const parts = [
        input.type === 'percent' ? `${value}% off` : `${rupees(value)} off`,
        minOrder ? `min order ${rupees(minOrder)}` : 'no minimum',
        maxDiscount ? `max discount ${rupees(maxDiscount)}` : null,
        `expires ${istDateKey(expiresAt)}`,
        limit ? `limit ${limit} uses` : 'unlimited uses'
      ].filter(Boolean);

      return {
        params: { code, type: input.type, value, minOrderValue: minOrder, maxDiscount, expiresAt: expiresAt.toISOString(), usageLimit: limit },
        before: null,
        summary: `Create coupon ${code}`,
        preview: [`${code}: ${parts.join(', ')}`],
        risk: (input.type === 'percent' && value >= 25) || (input.type === 'flat' && value >= 500) ? 'medium' : 'low'
      };
    },

    async execute(params) {
      if (await Coupon.exists({ code: params.code })) throw new Error(`Coupon ${params.code} already exists now.`);
      const c = await Coupon.create({
        code: params.code,
        type: params.type,
        value: params.value,
        minOrderValue: params.minOrderValue,
        maxDiscount: params.maxDiscount,
        expiresAt: new Date(params.expiresAt),
        usageLimit: params.usageLimit,
        isActive: true
      });
      return { result: `Coupon ${params.code} is live.`, undo: { couponId: String(c._id) } };
    },

    async undo(u) {
      const c = await Coupon.findById(u.couponId);
      if (!c) return 'The coupon was already removed.';
      if (!c.usedCount) {
        await c.deleteOne();
        return `Coupon ${c.code} deleted (it had not been used).`;
      }
      c.isActive = false;
      await c.save();
      return `Coupon ${c.code} was already used ${c.usedCount} time(s), so it was deactivated instead of deleted.`;
    }
  },

  coupon_update: {
    tool: {
      name: 'propose_coupon_update',
      description:
        'Propose changing an existing coupon: switch it on/off, extend or shorten expiry, or change its limits. Same hard limits as creating one. Include only the fields to change.',
      input_schema: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          is_active: { type: 'boolean' },
          expires_in_days: { type: 'integer', description: 'New expiry, counted from today (1-90)' },
          usage_limit: { type: 'integer' },
          value: { type: 'number' },
          min_order_value: { type: 'number' },
          max_discount: { type: 'number' },
          ...why
        },
        required: ['code', 'reason']
      }
    },

    async prepare(input) {
      const code = String(input.code || '').trim().toUpperCase();
      const c = await Coupon.findOne({ code });
      if (!c) throw new Error(`No coupon with code ${code}.`);

      const next = {};
      if (input.is_active !== undefined) {
        if (typeof input.is_active !== 'boolean') throw new Error('is_active must be true or false.');
        next.isActive = input.is_active;
      }
      if (input.expires_in_days !== undefined) next.expiresAt = addDays(num(input.expires_in_days, 'expires_in_days', 1, MAX_COUPON_DAYS, true)).toISOString();
      if (input.usage_limit !== undefined) next.usageLimit = num(input.usage_limit, 'usage_limit', 0, 100000, true);
      if (input.value !== undefined) {
        next.value = c.type === 'percent' ? num(input.value, 'value', 1, MAX_PERCENT_COUPON) : num(input.value, 'value', 1, MAX_FLAT_COUPON);
      }
      if (input.min_order_value !== undefined) next.minOrderValue = num(input.min_order_value, 'min_order_value', 0, 1000000);
      if (input.max_discount !== undefined) next.maxDiscount = num(input.max_discount, 'max_discount', 0, MAX_FLAT_COUPON * 4);

      const finalValue = next.value ?? c.value;
      const finalMax = next.maxDiscount ?? c.maxDiscount;
      if (c.type === 'percent' && finalValue > 15 && !finalMax) {
        throw new Error('Percent coupons above 15% must have a max_discount.');
      }

      const cur = {
        isActive: c.isActive,
        expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
        usageLimit: c.usageLimit,
        value: c.value,
        minOrderValue: c.minOrderValue,
        maxDiscount: c.maxDiscount
      };
      const before = {};
      const changes = {};
      const preview = [];
      for (const [k, v] of Object.entries(next)) {
        if (same(cur[k], v)) continue;
        before[k] = cur[k];
        changes[k] = v;
        const f = (x) => (k === 'expiresAt' ? (x ? istDateKey(new Date(x)) : 'never') : typeof x === 'boolean' ? (x ? 'on' : 'off') : x);
        preview.push(`${code} › ${k}: ${f(cur[k])} → ${f(v)}`);
      }
      if (!Object.keys(changes).length) throw new Error('Nothing would change: those values are already set.');

      return {
        params: { couponId: String(c._id), changes },
        before,
        summary: `Update coupon ${code}: ${Object.keys(changes).join(', ')}`,
        preview,
        risk: 'low'
      };
    },

    async execute(params, before) {
      const c = await Coupon.findById(params.couponId);
      if (!c) throw new Error('The coupon no longer exists.');
      const cur = {
        isActive: c.isActive,
        expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
        usageLimit: c.usageLimit,
        value: c.value,
        minOrderValue: c.minOrderValue,
        maxDiscount: c.maxDiscount
      };
      for (const k of Object.keys(params.changes)) {
        if (!same(cur[k], before[k])) throw new Error(`"${k}" was edited since this was proposed. Ask me to propose again.`);
      }
      for (const [k, v] of Object.entries(params.changes)) c[k] = k === 'expiresAt' ? new Date(v) : v;
      await c.save();
      return { result: `Coupon ${c.code} updated.`, undo: { couponId: params.couponId, before } };
    },

    async undo(u) {
      const c = await Coupon.findById(u.couponId);
      if (!c) throw new Error('The coupon no longer exists.');
      for (const [k, v] of Object.entries(u.before)) c[k] = k === 'expiresAt' ? (v ? new Date(v) : null) : v;
      await c.save();
      return `Coupon ${c.code} restored.`;
    }
  },

  // ------------------------------------------------------------------ shipping settings
  shipping_settings: {
    tool: {
      name: 'propose_shipping_settings',
      description:
        'Propose changing store-wide shipping: the free-shipping threshold, the default shipping charge, or the price per kg. This affects EVERY order, so it is high risk. Include only the fields to change.',
      input_schema: {
        type: 'object',
        properties: {
          free_shipping_above: { type: 'number', description: 'Cart value in ₹ above which shipping is free (0 = off), max 20000' },
          default_shipping_charge: { type: 'number', description: '₹0 to 500' },
          price_per_kg: { type: 'number', description: '₹0 to 1000' },
          ...why
        },
        required: ['reason']
      }
    },

    async prepare(input) {
      const s = await Settings.findOne().sort({ createdAt: 1 });
      if (!s) throw new Error('No settings document found.');
      const next = {};
      if (input.free_shipping_above !== undefined) next.freeShippingAbove = num(input.free_shipping_above, 'free_shipping_above', 0, 20000);
      if (input.default_shipping_charge !== undefined) next.defaultShippingCharge = num(input.default_shipping_charge, 'default_shipping_charge', 0, 500);
      if (input.price_per_kg !== undefined) next.pricePerKg = num(input.price_per_kg, 'price_per_kg', 0, 1000);

      const before = {};
      const changes = {};
      const preview = [];
      for (const [k, v] of Object.entries(next)) {
        if (same(s[k], v)) continue;
        before[k] = s[k] ?? 0;
        changes[k] = v;
        preview.push(`Shipping › ${k}: ${rupees(s[k])} → ${rupees(v)}`);
      }
      if (!Object.keys(changes).length) throw new Error('Nothing would change: those values are already set.');

      return {
        params: { settingsId: String(s._id), changes },
        before,
        summary: `Change shipping settings: ${Object.keys(changes).join(', ')}`,
        preview: [...preview, 'This applies to every new order.'],
        risk: 'high'
      };
    },

    async execute(params, before) {
      const s = await Settings.findById(params.settingsId);
      if (!s) throw new Error('The settings document no longer exists.');
      for (const k of Object.keys(params.changes)) {
        if (!same(s[k] ?? 0, before[k])) throw new Error(`"${k}" was edited since this was proposed. Ask me to propose again.`);
      }
      await Settings.updateOne({ _id: s._id }, { $set: params.changes });
      return { result: 'Shipping settings updated.', undo: { settingsId: params.settingsId, before } };
    },

    async undo(u) {
      await Settings.updateOne({ _id: u.settingsId }, { $set: u.before });
      return 'Shipping settings restored.';
    }
  },

  // ------------------------------------------------------------------ review moderation
  review_moderation: {
    tool: {
      name: 'propose_review_moderation',
      description:
        'Propose approving or hiding a customer review, or featuring it on the storefront. Get review ids from get_pending_reviews. Only approve genuine reviews; never approve spam or abusive text.',
      input_schema: {
        type: 'object',
        properties: {
          review_id: { type: 'string', description: 'The review id from get_pending_reviews' },
          approve: { type: 'boolean', description: 'true to publish, false to hide' },
          feature: { type: 'boolean', description: 'true to feature (the review must be approved)' },
          ...why
        },
        required: ['review_id', 'reason']
      }
    },

    async prepare(input) {
      if (!/^[a-f0-9]{24}$/i.test(String(input.review_id || ''))) throw new Error('review_id must be a valid id from get_pending_reviews.');
      const r = await Review.findById(input.review_id);
      if (!r) throw new Error('Review not found.');
      const p = await Product.findById(r.product).select('name');

      const next = {};
      if (input.approve !== undefined) next.isApproved = !!input.approve;
      if (input.feature !== undefined) next.isFeatured = !!input.feature;
      if (next.isFeatured && !(next.isApproved ?? r.isApproved)) throw new Error('Only approved reviews can be featured.');
      if (next.isApproved === false) next.isFeatured = false;

      const before = {};
      const changes = {};
      for (const [k, v] of Object.entries(next)) {
        if (r[k] === v) continue;
        before[k] = r[k];
        changes[k] = v;
      }
      if (!Object.keys(changes).length) throw new Error('Nothing would change on that review.');

      const verbs = [];
      if ('isApproved' in changes) verbs.push(changes.isApproved ? 'publish' : 'hide');
      if ('isFeatured' in changes) verbs.push(changes.isFeatured ? 'feature' : 'unfeature');
      return {
        params: { reviewId: String(r._id), changes },
        before,
        summary: `${verbs.join(' and ')} a ${r.rating}★ review on ${p?.name || 'a product'}`,
        preview: [`${r.rating}★ on ${p?.name || 'a product'}: "${clip(r.comment, 160) || '(no text)'}"`, `Action: ${verbs.join(' and ')}`],
        risk: 'low'
      };
    },

    async execute(params, before) {
      const r = await Review.findById(params.reviewId);
      if (!r) throw new Error('The review no longer exists.');
      for (const k of Object.keys(params.changes)) {
        if (r[k] !== before[k]) throw new Error('The review was edited since this was proposed. Ask me to propose again.');
      }
      for (const [k, v] of Object.entries(params.changes)) r[k] = v;
      await r.save();
      return { result: 'Review updated.', undo: { reviewId: params.reviewId, before } };
    },

    async undo(u) {
      const r = await Review.findById(u.reviewId);
      if (!r) throw new Error('The review no longer exists.');
      for (const [k, v] of Object.entries(u.before)) r[k] = v;
      await r.save();
      return 'Review restored.';
    }
  }
};