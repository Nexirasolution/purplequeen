import mongoose from 'mongoose';
import Product from '@/models/Product';
import Combo from '@/models/Combo';

const oid = (v) => new mongoose.Types.ObjectId(String(v));
const norm = (s) => String(s || '').toLowerCase().trim();

export function findVariant(product, { variantId, colorName }) {
  if (!product) return null;
  return (
    (variantId && product.variants?.find((v) => String(v._id) === String(variantId))) ||
    product.variants?.find((v) => norm(v.color) === norm(colorName)) ||
    null
  );
}

// ---- op builders: each op = guarded atomic $inc ----
function variantSizeOp(productId, variantId, size, n, label) {
  return {
    Model: Product,
    label,
    filter: {
      _id: oid(productId),
      variants: { $elemMatch: { _id: oid(variantId), sizes: { $elemMatch: { size, stock: { $gte: n } } } } },
    },
    update: { $inc: { 'variants.$[v].sizes.$[s].stock': -n } },
    arrayFilters: [{ 'v._id': oid(variantId) }, { 's.size': size }],
  };
}

function addonOp(productId, field, optionId, n, label) {
  return {
    Model: Product,
    label,
    filter: { _id: oid(productId), [field]: { $elemMatch: { _id: oid(optionId), stock: { $gte: n } } } },
    update: { $inc: { [`${field}.$[a].stock`]: -n } },
    arrayFilters: [{ 'a._id': oid(optionId) }],
  };
}

function packOp(comboId, packSize, n, label) {
  return {
    Model: Combo,
    label,
    filter: { _id: oid(comboId), packOptions: { $elemMatch: { size: packSize, stock: { $gte: n } } } },
    update: { $inc: { 'packOptions.$[p].stock': -n } },
    arrayFilters: [{ 'p.size': packSize }],
  };
}

function comboColorOp(comboId, colorName, n, label) {
  return {
    Model: Combo,
    label,
    filter: { _id: oid(comboId), colors: { $elemMatch: { name: colorName, stock: { $gte: n } } } },
    update: { $inc: { 'colors.$[c].stock': -n } },
    arrayFilters: [{ 'c.name': colorName }],
  };
}

// Every deduction one ORDER LINE needs (same rules as validate-stock).
export function buildOps(item, combo, productMap) {
  const qty = Number(item.qty) || 0;
  const name = item.name || 'item';
  const ops = [];
  if (qty <= 0) return ops;

  if (item.isCombo) {
    if (!combo) throw new Error(`${name}: combo no longer exists`);

    // multi-product bundle: only entries with a pinned variant + size hold stock
    if (combo.type !== 'color-pack') {
      for (const e of combo.products || []) {
        if (e.variantId && e.size) ops.push(variantSizeOp(e.product, e.variantId, e.size, qty, `${name} (${e.size})`));
      }
      return ops;
    }

    // color pack
    const packSize = Number(item.packDetails?.packSize);
    const pack = (combo.packOptions || []).find((p) => Number(p.size) === packSize);
    if (!pack) throw new Error(`${name}: pack size ${packSize} no longer exists`);
    if (pack.stock != null) ops.push(packOp(combo._id, packSize, qty, `${name} (pack of ${packSize})`));

    const base = productMap.get(String(combo.baseProduct));
    const perColor = new Map();
    for (const c of item.packDetails?.colors || []) {
      const pieces = Number(c.qty) || 0;
      if (pieces <= 0) continue;
      const size = c.size || item.packDetails?.size || item.size;
      const opt = (combo.colors || []).find((o) => o.name === c.name);
      if (!opt) throw new Error(`${name}: color ${c.name} no longer exists`);
      const variant = findVariant(base, { variantId: opt.variantId, colorName: opt.name });
      if (!variant) throw new Error(`${name}: color ${c.name} has no matching variant`);
      ops.push(variantSizeOp(base._id, variant._id, size, pieces * qty, `${name} ${c.name}/${size}`));
      perColor.set(c.name, (perColor.get(c.name) || 0) + pieces);
    }
    for (const [colorName, perPack] of perColor) {
      const opt = (combo.colors || []).find((o) => o.name === colorName);
      if (opt?.stock != null) ops.push(comboColorOp(combo._id, colorName, perPack * qty, `${name} ${colorName}`));
    }
    return ops;
  }

  // normal product line
  const product = productMap.get(String(item.product));
  const variant = findVariant(product, { variantId: item.variantId, colorName: item.color });
  if (!variant) throw new Error(`${name}: product or color "${item.color}" no longer exists`);
  ops.push(variantSizeOp(product._id, variant._id, item.size, qty, `${name} ${item.color}/${item.size}`));
  if (item.pantOption?.optionId) ops.push(addonOp(product._id, 'pantOptions', item.pantOption.optionId, qty, `${name} pant`));
  if (item.shawlOption?.optionId) ops.push(addonOp(product._id, 'shawlOptions', item.shawlOption.optionId, qty, `${name} shawl`));
  return ops;
}

// Runs ops one by one; on any failure undoes the ones already applied.
export async function applyOps(ops, applied = []) {
  for (const op of ops) {
    const res = await op.Model.updateOne(op.filter, op.update, { arrayFilters: op.arrayFilters });
    if (res.modifiedCount !== 1) {
      const err = new Error(`Not enough stock: ${op.label}`);
      err.code = 'INSUFFICIENT_STOCK';
      throw err;
    }
    applied.push(op);
  }
  return applied;
}

export async function rollbackOps(ops) {
  for (const op of ops) {
    const inverse = {
      $inc: Object.fromEntries(Object.entries(op.update.$inc).map(([k, v]) => [k, -v])),
    };
    await op.Model.updateOne({ _id: op.filter._id }, inverse, { arrayFilters: op.arrayFilters });
  }
}