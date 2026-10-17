'use client';

import { memo, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import { MoreVertical, Heart, Bell } from 'lucide-react';
import { formatINR } from '@/lib/utils';
import { getVariantTotalStock } from '@/lib/stock';
import { useWishlist } from '@/components/WhishlistContext'; // adjust path as needed

// Loaded only when a customer actually taps "Notify me" (keeps the grid light)
const NotifyMeModal = dynamic(() => import('@/components/Notifymemodal'), { ssr: false });

const PURPLE = '#4B087A';
const GOLD = '#F7B900';
const INK = '#24052F';
const INK_FAINT = '#6E5A7C';
const WASH = '#F6EAF9';
const PAPER = '#FFF5E8';
const FONT_SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const pillBase = { padding: '6px 14px', borderRadius: '999px' };

function ProductCard({ product, priority = false }) {
  const variant = product.variants?.[0];
  const image = variant?.images?.[0] || '/placeholder.png';

  // Discount section: toCardProduct(p, { discount: true }) adds `discountPrice`
  // and an `href` ending in ?src=discount. Every other page leaves both empty,
  // so the card shows the original price there.
  const regularPrice = product.basePrice || variant?.price || 0;
  const isDiscount = product.discountPrice != null && product.discountPrice < regularPrice;
  const price = isDiscount ? product.discountPrice : regularPrice;
  const compareAt = isDiscount ? regularPrice : (variant?.compareAtPrice || 0);
  const hasOffer = compareAt > price;
  const discountPct = hasOffer ? Math.round(((compareAt - price) / compareAt) * 100) : 0;

  const productHref = product.href || `/product/${product.slug}`;

  const totalStock = getVariantTotalStock(variant);
  const outOfStock = totalStock <= 0;
  const lowStock = !outOfStock && totalStock <= 5;

  const wishId = product.id ?? product._id ?? product.slug;
  const { isWishlisted, toggleWishlist } = useWishlist();
  const wishlisted = isWishlisted(wishId);

  const [notifyOpen, setNotifyOpen] = useState(false);

  const handleWishlistClick = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleWishlist(wishId);
    },
    [toggleWishlist, wishId]
  );

  return (
    <div className="relative" style={{ background: PAPER, fontFamily: FONT_SANS }}>
      <button
        type="button"
        onClick={handleWishlistClick}
        aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        aria-pressed={wishlisted}
        className="absolute top-4 right-4 z-10 flex items-center justify-center w-8 h-8 rounded-full transition-transform active:scale-90"
        style={{ background: 'rgba(255,245,232,0.92)' }}
      >
        <Heart
          className="w-4 h-4"
          strokeWidth={2}
          style={{ color: wishlisted ? PURPLE : INK }}
          fill={wishlisted ? GOLD : 'none'}
        />
      </button>

      <Link href={productHref} prefetch={false} className="block">
        <div className="relative aspect-[3/4] overflow-hidden" style={{ background: WASH }}>
          <Image
            src={image}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            quality={75}
            priority={priority}
            className={`object-cover ${outOfStock ? 'grayscale opacity-70' : ''}`}
          />

          <div className="absolute top-4 left-4">
            {outOfStock ? (
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ ...pillBase, color: PAPER, background: INK_FAINT }}>
                Out of stock
              </span>
            ) : lowStock ? (
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ ...pillBase, color: PAPER, background: PURPLE }}>
                {totalStock} left
              </span>
            ) : discountPct > 0 ? (
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ ...pillBase, color: INK, background: GOLD }}>
                {isDiscount ? 'Offer' : 'Sale'}
              </span>
            ) : null}
          </div>

          <span className="absolute bottom-3.5 right-3.5 flex items-center justify-center w-8 h-8" style={{ color: PAPER }}>
            <MoreVertical className="w-5 h-5" strokeWidth={2} />
          </span>
        </div>

        <div className="pt-3">
          <h3
            className="text-sm sm:text-base font-medium leading-snug line-clamp-2 min-h-[2.5rem]"
            style={{ color: INK }}
          >
            {product.name}
          </h3>

          <div className="mt-1 flex items-baseline gap-x-3 gap-y-1 flex-wrap">
            <span className="font-bold text-lg sm:text-xl" style={{ color: PURPLE }}>
              {formatINR(price)}
            </span>

            {hasOffer && (
              <>
                <span className="text-sm sm:text-base line-through font-light" style={{ color: INK_FAINT }}>
                  {formatINR(compareAt)}
                </span>
                <span
                  className="text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded"
                  style={{ color: INK, background: GOLD }}
                >
                  {discountPct}% off
                </span>
              </>
            )}
          </div>

          {hasOffer && (
            <p className="mt-1 text-xs" style={{ color: INK_FAINT }}>
              You save {formatINR(compareAt - price)}
            </p>
          )}
        </div>
      </Link>

      {/* Notify button: outside the Link so tapping it never navigates */}
      {outOfStock && (
        <>
          <button
            type="button"
            onClick={() => setNotifyOpen(true)}
            className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold transition-transform active:scale-95"
            style={{ background: PURPLE, color: PAPER }}
          >
            <Bell className="w-4 h-4" strokeWidth={2} />
            Notify me
          </button>
          {notifyOpen && <NotifyMeModal product={product} onClose={() => setNotifyOpen(false)} />}
        </>
      )}
    </div>
  );
}

export default memo(ProductCard);