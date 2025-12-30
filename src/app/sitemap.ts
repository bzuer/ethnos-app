import type { MetadataRoute } from 'next';
import { defaultLocale } from '@/i18n/config';
import { buildLocaleSitemap } from '@/lib/sitemap';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildLocaleSitemap(defaultLocale, { includeAlternates: true });
}
