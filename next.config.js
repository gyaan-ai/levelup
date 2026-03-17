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
              "style-src 'self' 'unsafe-inline' https://js.stripe.com",
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





