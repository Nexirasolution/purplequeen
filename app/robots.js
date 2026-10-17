export default function robots() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.purplequeen.in').replace(/\/+$/, '');

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Keep crawlers off admin, API, private, and endless filter/sort/param URLs
        disallow: [
          '/admin',
          '/api',
          '/cart',
          '/checkout',
          '/account',
          '/login',
          '/register',
          '/wishlist',
          '/search',
          '/*?*sort=',
          '/*?*filter=',
          '/*?*utm_',
          '/*?*sessionid=',
        ],
      },
      {
        // AI training / scraper bots: block entirely to save function invocations
        userAgent: ['GPTBot', 'CCBot', 'ClaudeBot', 'Bytespider', 'Amazonbot', 'PerplexityBot', 'anthropic-ai'],
        disallow: '/',
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}