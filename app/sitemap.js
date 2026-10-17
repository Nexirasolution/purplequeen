import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';
import Category from '@/models/Category';

// Regenerate at most once per hour (ISR) so bots hitting /sitemap.xml don't trigger a DB query each time
export const revalidate = 3600;

const FALLBACK_SITE_URL = 'https://www.purplequeen.in';

export default async function sitemap() {
  // Strip trailing slash so we never emit "//" in URLs
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_SITE_URL).replace(/\/+$/, '');
  let products = [];
  let categories = [];

  try {
    await dbConnect();
    [products, categories] = await Promise.all([
      // Sitemap protocol limit is 50,000 URLs per file
      Product.find({ isActive: true }).select('slug updatedAt').sort({ updatedAt: -1 }).limit(49000).lean(),
      Category.find({ isActive: true }).select('slug updatedAt').lean(),
    ]);
  } catch (err) {
    console.error('[sitemap] DB error:', err?.message);
  }

  // Only pages you want indexed (cart/checkout are disallowed in robots.js)
  const staticRoutes = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    // Add other indexable static pages here, e.g. /about, /contact, /size-guide
  ];

  const categoryRoutes = categories
    .filter((c) => c.slug)
    .map((c) => ({
      url: `${siteUrl}/category/${c.slug}`,
      lastModified: c.updatedAt || undefined,
      changeFrequency: 'daily',
      priority: 0.8,
    }));

  const productRoutes = products
    .filter((p) => p.slug)
    .map((p) => ({
      url: `${siteUrl}/product/${p.slug}`,
      lastModified: p.updatedAt || undefined,
      changeFrequency: 'weekly',
      priority: 0.7,
    }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}