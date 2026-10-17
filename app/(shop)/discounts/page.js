import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';
import ProductCard from '@/components/ProductCard';
import { toCardProduct } from '@/lib/cardProduct';
import { liveDiscountQuery } from '@/lib/discount';

// Rebuilt at most every 5 minutes; the admin product API also calls
// revalidatePath('/discounts') on every save, so changes show up instantly.
export const revalidate = 300;

export const metadata = {
  title: 'Discount Offers',
  description: 'Products on offer right now.',
};

const PURPLE = '#4B087A';
const INK_FAINT = '#7A6685';
const PAPER = '#FFF5E8';
const FONT_SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export default async function DiscountsPage() {
  await dbConnect();
  const products = JSON.parse(
    JSON.stringify(
      await Product.find({ isActive: true, ...liveDiscountQuery() })
        .sort({ createdAt: -1 })
        .lean()
    )
  );

  return (
    <div style={{ background: PAPER }} className="min-h-[60vh]">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <h1
          className="text-xl sm:text-2xl font-bold tracking-[3px] uppercase text-center"
          style={{ color: PURPLE, fontFamily: FONT_SANS }}
        >
          Discount Offers
        </h1>
        <p
          className="text-center text-sm font-light mt-2 mb-8"
          style={{ color: INK_FAINT, fontFamily: FONT_SANS }}
        >
          Offer prices apply to items added from this page.
        </p>

        {products.length === 0 ? (
          <p className="text-center py-16" style={{ color: INK_FAINT, fontFamily: FONT_SANS }}>
            No offers right now. Check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8">
            {products.map((p) => (
              <ProductCard key={p._id} product={toCardProduct(p, { discount: true })} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}