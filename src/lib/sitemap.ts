import 'server-only';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { defaultLocale } from '@/i18n/config';
import { listDocPages } from './docs';
import { listRecentlyAddedWorks } from './endpoints';
import { localeUrl } from './site';

export type SitemapSection = 'pages' | 'recent' | 'works' | 'venues' | 'persons';
export type ChangeFrequency = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
export type SitemapEntry = {
  path: string;
  lastModified?: Date;
  changeFrequency: ChangeFrequency;
  priority: number;
};
export type SitemapSectionData = {
  entries: SitemapEntry[];
  lastModified?: Date;
};

export const SITEMAP_SECTIONS: SitemapSection[] = ['pages', 'recent', 'works', 'venues', 'persons'];
export const SITEMAP_URL_LIMIT = 50000;
export const RECENT_WORKS_WINDOW_DAYS = 90;

type CuratedSection = Extract<SitemapSection, 'works' | 'venues' | 'persons'>;

const execFileAsync = promisify(execFile);
const RECENT_CACHE_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const CURATED_FILES: Record<CuratedSection, string> = {
  works: 'top_works.xml',
  venues: 'top_venues.xml',
  persons: 'top_persons.xml'
};

type SourceFile = { tracked: string; absolute: string };

const curatedSource = (file: string): SourceFile => ({
  tracked: `public/xml-list/${file}`,
  absolute: path.join(process.cwd(), 'public', 'xml-list', file)
});

const docSource = (file: string): SourceFile => ({
  tracked: `docs/${file}`,
  absolute: path.join(process.cwd(), 'docs', file)
});

const MINIMUM_ENTRIES: Record<CuratedSection, number> = {
  works: 500,
  venues: 250,
  persons: 100
};

const ENTITY_META: Record<CuratedSection | 'recent', { changeFrequency: ChangeFrequency; priority: number }> = {
  recent: { changeFrequency: 'weekly', priority: 0.6 },
  works: { changeFrequency: 'monthly', priority: 0.6 },
  venues: { changeFrequency: 'weekly', priority: 0.7 },
  persons: { changeFrequency: 'monthly', priority: 0.5 }
};

const STATIC_PAGES: Array<{ path: string; changeFrequency: ChangeFrequency; priority: number }> = [
  { path: '/', changeFrequency: 'daily', priority: 1 },
  { path: '/search', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/venues', changeFrequency: 'weekly', priority: 0.8 }
];

const TRAILING_PAGES: Array<{ path: string; changeFrequency: ChangeFrequency; priority: number }> = [
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/license', changeFrequency: 'yearly', priority: 0.2 }
];

const staticCache = new Map<SitemapSection, Promise<SitemapSectionData>>();
const sourceDates = new Map<string, Promise<Date | undefined>>();
let recentCache: { at: number; data: SitemapSectionData } | null = null;

export function sitemapSectionPath(section: SitemapSection) {
  return `/sitemaps/${section}.xml`;
}

export function parseSitemapSection(value: string): SitemapSection | null {
  const normalized = value.toLowerCase().replace(/\.xml$/, '');
  return (SITEMAP_SECTIONS as string[]).includes(normalized) ? (normalized as SitemapSection) : null;
}

export function maxEntriesPerSection() {
  return SITEMAP_URL_LIMIT;
}

export async function buildSitemapSection(section: SitemapSection): Promise<SitemapSectionData> {
  if (section === 'recent') return buildRecentSection();
  let pending = staticCache.get(section);
  if (!pending) {
    pending = section === 'pages' ? buildPagesSection() : buildCuratedSection(section);
    staticCache.set(section, pending);
    pending.catch(() => staticCache.delete(section));
  }
  return pending;
}

export async function renderSitemapSection(section: SitemapSection) {
  const { entries } = await buildSitemapSection(section);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(renderUrl),
    '</urlset>',
    ''
  ].join('\n');
}

export async function renderSitemapIndex() {
  const rows = await Promise.all(
    SITEMAP_SECTIONS.map(async (section) => {
      const { lastModified } = await buildSitemapSection(section);
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

function renderUrl(entry: SitemapEntry) {
  return [
    '  <url>',
    `    <loc>${escapeXml(localeUrl(defaultLocale, entry.path))}</loc>`,
    entry.lastModified ? `    <lastmod>${entry.lastModified.toISOString()}</lastmod>` : '',
    `    <changefreq>${entry.changeFrequency}</changefreq>`,
    `    <priority>${entry.priority.toFixed(1)}</priority>`,
    '  </url>'
  ]
    .filter(Boolean)
    .join('\n');
}

async function buildPagesSection(): Promise<SitemapSectionData> {
  const docEntries = await Promise.all(
    listDocPages().map(async (page) => ({
      path: page.path,
      lastModified: newestDate(await Promise.all(page.sources.map((file) => resolveSourceDate(docSource(file))))),
      changeFrequency: 'monthly' as ChangeFrequency,
      priority: 0.6
    }))
  );
  const entries: SitemapEntry[] = [...STATIC_PAGES, ...docEntries, ...TRAILING_PAGES];
  return { entries, lastModified: newestDate(entries.map((entry) => entry.lastModified)) };
}

async function buildRecentSection(): Promise<SitemapSectionData> {
  if (recentCache && Date.now() - recentCache.at < RECENT_CACHE_MS) return recentCache.data;
  try {
    const works = await listRecentlyAddedWorks({
      limit: maxEntriesPerSection(),
      since: new Date(Date.now() - RECENT_WORKS_WINDOW_DAYS * DAY_MS)
    });
    const entries: SitemapEntry[] = works.map((work) => ({
      path: `/works/${work.id}`,
      lastModified: work.addedAt ?? undefined,
      ...ENTITY_META.recent
    }));
    const data = { entries, lastModified: newestDate(entries.map((entry) => entry.lastModified)) };
    recentCache = { at: Date.now(), data };
    return data;
  } catch (error) {
    if (recentCache) return recentCache.data;
    if (process.env.NEXT_PHASE !== 'phase-production-build') throw error;
    console.warn('Sitemap recent works unavailable at build time; the section will fill on its first revalidation', error);
    return { entries: [] };
  }
}

async function buildCuratedSection(section: CuratedSection): Promise<SitemapSectionData> {
  const source = curatedSource(CURATED_FILES[section]);
  let xml = '';
  try {
    xml = await fs.readFile(path.join(process.cwd(), 'public', 'xml-list', CURATED_FILES[section]), 'utf-8');
  } catch (error) {
    console.error('Sitemap source unavailable', section, error);
    return { entries: [] };
  }
  const seen = new Set<string>();
  const entries: SitemapEntry[] = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const normalized = normalizeTopItem(match[1] ?? '', section);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    entries.push({ path: normalized, ...ENTITY_META[section] });
  }
  if (entries.length < MINIMUM_ENTRIES[section]) {
    console.warn(`Sitemap ${section} entries below expectation: ${entries.length}`);
  }
  const maxEntries = maxEntriesPerSection();
  if (entries.length > maxEntries) {
    console.warn(`Sitemap ${section} truncated to ${maxEntries} entries to stay within the ${SITEMAP_URL_LIMIT} URL limit`);
    entries.length = maxEntries;
  }
  return { entries, lastModified: await resolveSourceDate(source) };
}

function normalizeTopItem(value: string, section: CuratedSection) {
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

function resolveSourceDate(source: SourceFile): Promise<Date | undefined> {
  let pending = sourceDates.get(source.tracked);
  if (!pending) {
    pending = readSourceDate(source);
    sourceDates.set(source.tracked, pending);
  }
  return pending;
}

async function readSourceDate(source: SourceFile): Promise<Date | undefined> {
  try {
    const { stdout } = await execFileAsync('git', ['log', '-1', '--format=%cI', '--', source.tracked], {
      cwd: process.cwd(),
      timeout: 5000
    });
    const committed = new Date(stdout.trim());
    if (stdout.trim() && !Number.isNaN(committed.getTime())) return committed;
  } catch {}
  try {
    return (await fs.stat(source.absolute)).mtime;
  } catch {
    return undefined;
  }
}

function newestDate(dates: Array<Date | undefined>) {
  return dates.reduce<Date | undefined>((acc, date) => (date && (!acc || date > acc) ? date : acc), undefined);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
