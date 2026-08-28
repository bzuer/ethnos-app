import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { locales, type Locale } from '@/i18n/config';
import { alternateUrls, localeUrl } from './site';

export type SitemapSection = 'pages' | 'works' | 'venues' | 'persons';
export type ChangeFrequency = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
export type SitemapEntry = {
  path: string;
  lastModified: Date;
  changeFrequency: ChangeFrequency;
  priority: number;
};

export const SITEMAP_SECTIONS: SitemapSection[] = ['pages', 'works', 'venues', 'persons'];
export const SITEMAP_URL_LIMIT = 50000;

type TopEntity = Exclude<SitemapSection, 'pages'>;

const topListDir = path.join(process.cwd(), 'public', 'xml-list');

const TOP_LIST_FILES: Record<TopEntity, string> = {
  works: 'top_works.xml',
  venues: 'top_venues.xml',
  persons: 'top_persons.xml'
};

const MINIMUM_ENTRIES: Record<TopEntity, number> = {
  works: 500,
  venues: 250,
  persons: 100
};

const ENTITY_META: Record<TopEntity, { changeFrequency: ChangeFrequency; priority: number }> = {
  works: { changeFrequency: 'monthly', priority: 0.6 },
  venues: { changeFrequency: 'weekly', priority: 0.7 },
  persons: { changeFrequency: 'monthly', priority: 0.5 }
};

const STATIC_PAGES: Array<{ path: string; changeFrequency: ChangeFrequency; priority: number }> = [
  { path: '/', changeFrequency: 'daily', priority: 1 },
  { path: '/search', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/venues', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/license', changeFrequency: 'yearly', priority: 0.2 }
];

const sectionCache = new Map<SitemapSection, SitemapEntry[]>();

export function sitemapSectionPath(section: SitemapSection) {
  return `/sitemaps/${section}.xml`;
}

export function parseSitemapSection(value: string): SitemapSection | null {
  const normalized = value.toLowerCase().replace(/\.xml$/, '');
  return (SITEMAP_SECTIONS as string[]).includes(normalized) ? (normalized as SitemapSection) : null;
}

export async function buildSitemapSection(section: SitemapSection): Promise<SitemapEntry[]> {
  const cached = sectionCache.get(section);
  if (cached) return cached;
  const entries = section === 'pages' ? await buildStaticEntries() : await buildEntityEntries(section);
  sectionCache.set(section, entries);
  return entries;
}

export async function renderSitemapSection(section: SitemapSection) {
  const entries = await buildSitemapSection(section);
  const rows: string[] = [];
  for (const entry of entries) {
    const languages = alternateUrls(entry.path);
    for (const locale of locales) {
      rows.push(renderUrl(locale, entry, languages));
    }
  }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...rows,
    '</urlset>',
    ''
  ].join('\n');
}

export async function renderSitemapIndex() {
  const rows = await Promise.all(
    SITEMAP_SECTIONS.map(async (section) => {
      const entries = await buildSitemapSection(section);
      const lastModified = entries.reduce<Date | null>((acc, entry) => {
        if (!acc || entry.lastModified > acc) return entry.lastModified;
        return acc;
      }, null);
      return [
        '  <sitemap>',
        `    <loc>${escapeXml(localeUrl('en', sitemapSectionPath(section)))}</loc>`,
        lastModified ? `    <lastmod>${lastModified.toISOString()}</lastmod>` : '',
        '  </sitemap>'
      ]
        .filter(Boolean)
        .join('\n');
    })
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...rows,
    '</sitemapindex>',
    ''
  ].join('\n');
}

function renderUrl(locale: Locale, entry: SitemapEntry, languages: Record<string, string>) {
  const alternates = Object.entries(languages).map(
    ([code, href]) => `    <xhtml:link rel="alternate" hreflang="${escapeXml(code)}" href="${escapeXml(href)}" />`
  );
  return [
    '  <url>',
    `    <loc>${escapeXml(localeUrl(locale, entry.path))}</loc>`,
    ...alternates,
    `    <lastmod>${entry.lastModified.toISOString()}</lastmod>`,
    `    <changefreq>${entry.changeFrequency}</changefreq>`,
    `    <priority>${entry.priority.toFixed(1)}</priority>`,
    '  </url>'
  ].join('\n');
}

async function buildStaticEntries(): Promise<SitemapEntry[]> {
  const lastModified = await resolveBuildDate();
  return STATIC_PAGES.map((page) => ({ ...page, lastModified }));
}

async function buildEntityEntries(section: TopEntity): Promise<SitemapEntry[]> {
  const filePath = path.join(topListDir, TOP_LIST_FILES[section]);
  const meta = ENTITY_META[section];
  let xml = '';
  let lastModified = new Date();
  try {
    const [content, stats] = await Promise.all([fs.readFile(filePath, 'utf-8'), fs.stat(filePath)]);
    xml = content;
    lastModified = stats.mtime;
  } catch (error) {
    console.error('Sitemap source unavailable', section, error);
    return [];
  }
  const seen = new Set<string>();
  const entries: SitemapEntry[] = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const normalized = normalizeTopItem(match[1] ?? '', section);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    entries.push({ path: normalized, lastModified, changeFrequency: meta.changeFrequency, priority: meta.priority });
  }
  if (entries.length < MINIMUM_ENTRIES[section]) {
    console.warn(`Sitemap ${section} entries below expectation: ${entries.length}`);
  }
  const maxEntries = Math.floor(SITEMAP_URL_LIMIT / locales.length);
  if (entries.length > maxEntries) {
    console.warn(`Sitemap ${section} truncated to ${maxEntries} entries to stay within the 50000 URL limit`);
    return entries.slice(0, maxEntries);
  }
  return entries;
}

function normalizeTopItem(value: string, section: TopEntity) {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  const withoutOrigin = trimmed.replace(/^https?:\/\/[^/]+/i, '');
  const parts = withoutOrigin
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  if (parts[0].toLowerCase() === section) parts.shift();
  const singular = section.slice(0, -1);
  if (parts[0]?.toLowerCase() === singular) parts.shift();
  if (parts.length === 0) return null;
  const id = parts.join('/');
  if (!/^[A-Za-z0-9._~-]+$/.test(id)) return null;
  return `/${section}/${id}`;
}

async function resolveBuildDate() {
  try {
    const stats = await fs.stat(path.join(process.cwd(), 'package.json'));
    return stats.mtime;
  } catch {
    return new Date();
  }
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
