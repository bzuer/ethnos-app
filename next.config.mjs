import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://api.ethnos.app",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests'
].join('; ');

const cspHeaderName = process.env.CSP_ENFORCE === '1'
  ? 'Content-Security-Policy'
  : 'Content-Security-Policy-Report-Only';

const immutableCss = [
  { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }
];

const crawlableAsset = [
  { key: 'Cache-Control', value: 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400' }
];

const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  turbopack: {
    root: new URL('.', import.meta.url).pathname
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: cspHeaderName, value: contentSecurityPolicy }
        ]
      },
      { source: '/css/styles.css', headers: immutableCss },
      { source: '/css/styles.min.css', headers: immutableCss },
      { source: '/robots.txt', headers: crawlableAsset },
      { source: '/sitemap.xml', headers: crawlableAsset },
      { source: '/sitemaps/:path*', headers: crawlableAsset }
    ];
  }
};

export default withNextIntl(nextConfig);
