/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "script-src 'self' 'unsafe-inline' https://js.stripe.com",
              "style-src 'self' 'unsafe-inline' https://js.stripe.com https://api.mapbox.com",
              "worker-src 'self' blob:",
              "child-src blob:",
              "img-src 'self' data: blob: https://*.tiles.mapbox.com https://api.mapbox.com https://*.stripe.com https://*.supabase.co https://*.public.blob.vercel-storage.com",
              "connect-src 'self' https://api.mapbox.com https://events.mapbox.com https://*.supabase.co https://js.stripe.com https://api.stripe.com",
              "font-src 'self' data: https://fonts.mapbox.com",
            ].join('; '),
          },
        ],
      },
      // Prevent CDN/browser from caching My Bookings HTML so mobile gets updates after deploy
      {
        source: '/bookings',
        headers: [{ key: 'Cache-Control', value: 'private, no-store, max-age=0' }],
      },
    ];
  },
};

module.exports = nextConfig;





