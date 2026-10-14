'use client';

import { useCart } from './CartContext';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Zap } from 'lucide-react';
import { piecesPerUnit } from '@/lib/comboPieces';

// Palette: #4B087A #F7B900 #FFF5E8 #24052F #D9B4E8
const PURPLE = '#4B087A';      // primary brand (royal purple)
const GOLD = '#F7B900';        // buttons / premium accents
const GOLD_DARK = '#D9A000';   // gold hover state
const IVORY = '#FFF5E8';       // website background
const INK = '#24052F';         // deep purple for text on gold
const LILAC = '#D9B4E8';       // soft accent / hover tint

export default function AddComboButton({ combo }) {
  const { addItem } = useCart();
  const router = useRouter();

  const item = {
    productId: combo._id,
    variantId: 'combo',
    comboId: combo._id,
    isCombo: true,
    name: combo.name,
    image: combo.images?.[0],
    color: '-',
    size: 'Combo',
    price: combo.comboPrice,
    qty: 1,
    // Pieces in ONE combo (admin-set piecesPerCombo, else products count)
    pieces: piecesPerUnit(combo),
  };

  function handleAddToCart() {
    addItem(item);
  }

  function handleBuyNow() {
    addItem(item);
    router.push('/checkout');
  }

  return (
    <div className="flex gap-2.5">
      <button
        onClick={handleAddToCart}
        className="flex-1 flex items-center justify-center gap-2 text-sm font-medium py-3 rounded-full active:scale-[0.98] transition-colors"
        style={{ border: `1px solid ${PURPLE}`, color: PURPLE, background: IVORY }}
        onMouseEnter={(e) => (e.currentTarget.style.background = LILAC)}
        onMouseLeave={(e) => (e.currentTarget.style.background = IVORY)}
      >
        <ShoppingBag size={16} strokeWidth={1.75} />
        Add to cart
      </button>
      <button
        onClick={handleBuyNow}
        className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold py-3 rounded-full transition-colors active:scale-[0.98]"
        style={{ background: GOLD, color: INK }}
        onMouseEnter={(e) => (e.currentTarget.style.background = GOLD_DARK)}
        onMouseLeave={(e) => (e.currentTarget.style.background = GOLD)}
      >
        <Zap size={16} fill="currentColor" strokeWidth={0} />
        Buy now
      </button>
    </div>
  );
}