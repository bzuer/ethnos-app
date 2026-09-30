import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
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

function stylesheetVersion() {
  try {
    const css = readFileSync(new URL('./public/css/styles.min.css', import.meta.url));
    return createHash('sha256').update(css).digest('hex').slice(0, 12);
  } catch {
    return '';
  }
}

const revalidatedCss = [
  { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }
];

const versionedCss = [
  { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }
];

const versionQuery = [{ type: 'query', key: 'v' }];

const crawlableAsset = [
  { key: 'Cache-Control', value: 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400' }
];

const nextConfig = {
  reactStrictMode: true,
  compress: false,
  env: {
    ETHNOS_CSS_VERSION: stylesheetVersion()
  },
  images: { unoptimized: true },
  cacheMaxMemorySize: 256 * 1024 * 1024,
  experimental: {
    isrFlushToDisk: false
  },
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
      { source: '/css/styles.css', headers: revalidatedCss },
      { source: '/css/styles.min.css', headers: revalidatedCss },
      { source: '/css/styles.min.css', has: versionQuery, headers: versionedCss },
      { source: '/robots.txt', headers: crawlableAsset },
      { source: '/sitemap.xml', headers: crawlableAsset },
      { source: '/sitemaps/:path*', headers: crawlableAsset }
    ];
  }
};

export default withNextIntl(nextConfig);
