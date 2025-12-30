import type { MetadataRoute } from 'next';

const disallow = [
  '/api/',
  '/_next/'
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/'],
        disallow
      }
    ],
    sitemap: 'https://ethnos.app/sitemap.xml'
  };
}
