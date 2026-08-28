import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

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
          { key: 'X-DNS-Prefetch-Control', value: 'on' }
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
