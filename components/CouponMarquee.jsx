'use client';

import { useEffect, useState } from 'react';
import { Tag, Truck } from 'lucide-react';

// Palette: #4B087A #F7B900 #FFF5E8 #24052F #D9B4E8
// Keep these tokens in sync with Navbar if you tweak the palette.
const BG = '#6B2682';                       // slightly darker medium purple
const TEXT = '#FFF5E8';                     // ivory text
const TEXT_FAINT = 'rgba(255, 245, 232, 0.75)';
const ACCENT = '#F7B900';                   // gold icons / coupon code underline

// A quiet serif, matched to the wordmark used elsewhere on the site,
// so the marquee reads as part of the same brand rather than generic UI text.
const FONT = "Georgia, 'Times New Roman', serif";

export default function CouponMarquee() {
  const [coupons, setCoupons] = useState([]);
  const [freeShippingAbove, setFreeShippingAbove] = useState(null);

  useEffect(() => {
    fetch('/api/coupons?active=true')
      .then((r) => r.json())
      .then((d) => setCoupons(d.coupons || []))
      .catch(() => {});

    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((d) => setFreeShippingAbove(d.settings?.freeShippingAbove ?? null))
      .catch(() => {});
  }, []);

  const freeShippingItem =
    freeShippingAbove != null ? { type: 'freeshipping', minOrderValue: freeShippingAbove } : null;

  const allItems = freeShippingItem ? [...coupons, freeShippingItem] : coupons;
  if (!allItems.length) return null;

  const items = [...allItems, ...allItems];

  return (
    <div className="relative overflow-hidden py-2" style={{ background: BG }}>
      {/* Fade edges */}
      <div
        className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 z-10"
        style={{ background: `linear-gradient(to right, ${BG}, transparent)` }}
      />
      <div
        className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 z-10"
        style={{ background: `linear-gradient(to left, ${BG}, transparent)` }}
      />

      <div className="flex animate-marquee whitespace-nowrap w-max">
        {items.map((c, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-2 mx-8 text-[12px] tracking-[0.3px]"
            style={{ color: TEXT, fontFamily: FONT }}
          >
            {i > 0 && <span className="mr-4" style={{ color: ACCENT }}>—</span>}

            {c.type === 'freeshipping' ? (
              <>
                <Truck size={12} strokeWidth={1.25} className="shrink-0" style={{ color: ACCENT }} />
                Free shipping on orders above ₹{c.minOrderValue}
              </>
            ) : (
              <>
                <Tag size={12} strokeWidth={1.25} className="shrink-0" style={{ color: ACCENT }} />
                Use{' '}
                <span
                  className="italic px-1.5"
                  style={{ color: ACCENT, borderBottom: `1px solid ${ACCENT}` }}
                >
                  {c.code}
                </span>
                {' '}for{' '}
                {c.type === 'percent' ? `${c.value}% off` : `₹${c.value} off`}
                {c.minOrderValue > 0 && (
                  <span style={{ color: TEXT_FAINT }}> on orders above ₹{c.minOrderValue}</span>
                )}
              </>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}