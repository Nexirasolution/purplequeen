import { applyDiscount, isDiscountLive } from '@/lib/discount';

// ProductCard is a client component, so every field passed to it is serialized
// into the page HTML. The card only needs the first variant and its first
// image, so we send just that instead of the whole product document.
//
// Normal pages call toCardProduct(p)                      -> original price only.
// Discount pages call toCardProduct(p, { discount: true }) -> adds discountPrice
// and a link that carries ?src=discount so the product page prices correctly.
export function toCardProduct(p, { discount = false } = {}) {
  const v = p.variants?.[0];
  const base = {
    _id: String(p._id),
    slug: p.slug,
    name: p.name,
    basePrice: p.basePrice,
    variants: v ? [{ ...v, images: v.images?.slice(0, 1) }] : [],
  };

  if (discount && isDiscountLive(p)) {
    base.discountPrice = applyDiscount(p.basePrice, p.discount);
    base.href = `/product/${p.slug}?src=discount`; // adjust if your product route differs
  }
  return base;
}