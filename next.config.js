// Images are compressed to WebP in the browser before upload and served from
// Cloudflare R2, so Vercel does NOT need to optimize them. `unoptimized: true`
// turns off Next's image optimizer (no /_next/image calls, no Vercel image usage).
// Set R2_PUBLIC_URL (e.g. https://cdn.example.com) in .env.local and Vercel env vars.
const r2Host = (() => {
  try {
    return new URL(process.env.R2_PUBLIC_URL || '').hostname;
  } catch {
    return null;
  }
})();

// Old product images may still point to Cloudinary. They keep loading as-is.
const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,

    // Not used while unoptimized, but keeps next/image happy if you turn optimization back on.
    remotePatterns: [
      ...(r2Host ? [{ protocol: 'https', hostname: r2Host, pathname: '/**' }] : []),
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: cloudName ? `/${cloudName}/**` : '/**',
      },
    ],
  },

  eslint: { ignoreDuringBuilds: true },

  // Cache static files in /public aggressively
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|jpeg|png|webp|gif|ico|woff2)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

module.exports = nextConfig;