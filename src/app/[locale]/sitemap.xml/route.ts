import { NextResponse } from 'next/server';
import type { MetadataRoute } from 'next';
import { locales, defaultLocale, type Locale } from '@/i18n/config';
import { buildLocaleSitemap } from '@/lib/sitemap';

export const dynamic = 'force-dynamic';

type ParamsInput = { params: Promise<{ locale: string }> | { locale: string } };

export async function GET(_request: Request, context: ParamsInput) {
  const resolved = 'then' in context.params ? await context.params : context.params;
  const locale = resolved?.locale || '';
  if (!locales.includes(locale as Locale) || locale === defaultLocale) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }
  const entries = await buildLocaleSitemap(locale as Locale);
  const body = renderSitemap(entries);
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}

function renderSitemap(entries: MetadataRoute.Sitemap) {
  const head = '<?xml version="1.0" encoding="UTF-8"?>';
  const open = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">';
  const close = '</urlset>';
  const rows = entries.map((entry) => renderEntry(entry)).join('');
  return `${head}\n${open}\n${rows}\n${close}`;
}

function renderEntry(entry: MetadataRoute.Sitemap[number]) {
  const parts = ['<url>', `<loc>${escapeXml(entry.url)}</loc>`];
  if (entry.alternates?.languages) {
    for (const [lang, href] of Object.entries(entry.alternates.languages)) {
      if (typeof href !== 'string' || !href) continue;
      parts.push(`<xhtml:link rel="alternate" hreflang="${escapeXml(lang)}" href="${escapeXml(href)}" />`);
    }
  }
  if (entry.lastModified) {
    const lastMod = entry.lastModified instanceof Date ? entry.lastModified.toISOString() : entry.lastModified;
    parts.push(`<lastmod>${escapeXml(lastMod)}</lastmod>`);
  }
  if (entry.changeFrequency) {
    parts.push(`<changefreq>${escapeXml(entry.changeFrequency)}</changefreq>`);
  }
  if (typeof entry.priority === 'number') {
    parts.push(`<priority>${entry.priority}</priority>`);
  }
  parts.push('</url>');
  return parts.join('\n');
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
