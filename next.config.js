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
              "script-src 'self' 'sha256-2I/UQjGvK8DC2a0IIm0Md7Cm+ZHj2NYE4a6ugk09FVw=' https://js.stripe.com",
              "style-src 'self' 'unsafe-inline' https://js.stripe.com",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;





