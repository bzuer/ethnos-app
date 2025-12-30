import type { MetadataRoute } from 'next';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { locales, type Locale } from '@/i18n/config';
import { localizedPath } from '@/i18n/paths';

const baseUrl = 'https://ethnos.app';
const topListDir = path.join(process.cwd(), 'docs', 'top-list');

type Frequency = NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;
type BuildOptions = { includeAlternates?: boolean };
type TopEntity = 'works' | 'venues' | 'persons';

const MINIMUM_ENTRIES: Record<TopEntity, number> = {
  works: 500,
  venues: 1000,
  persons: 100
};

const TOP_LIST_FILES: Record<TopEntity, string> = {
  works: 'top_works.xml',
  venues: 'top_venues.xml',
  persons: 'top_persons.xml'
};

const ENTITY_META: Record<TopEntity, { frequency: Frequency; priority: number }> = {
  works: { frequency: 'monthly', priority: 0.6 },
  venues: { frequency: 'weekly', priority: 0.7 },
  persons: { frequency: 'monthly', priority: 0.5 }
};

const topCache: Partial<Record<TopEntity, string[]>> = {};

export async function buildLocaleSitemap(locale: Locale, options?: BuildOptions): Promise<MetadataRoute.Sitemap> {
  const includeAlternates = options?.includeAlternates ?? false;
  const lastModified = new Date();
  const [workPaths, venuePaths, personPaths] = await Promise.all([
    loadTopEntries('works'),
    loadTopEntries('venues'),
    loadTopEntries('persons')
  ]);
  return [
    ...buildStaticEntries(locale, lastModified, includeAlternates),
    ...buildTopEntries(locale, lastModified, includeAlternates, 'works', workPaths),
    ...buildTopEntries(locale, lastModified, includeAlternates, 'venues', venuePaths),
    ...buildTopEntries(locale, lastModified, includeAlternates, 'persons', personPaths)
  ];
}

function buildTopEntries(
  locale: Locale,
  lastModified: Date,
  includeAlternates: boolean,
  type: TopEntity,
  paths: string[]
): MetadataRoute.Sitemap {
  if (!Array.isArray(paths) || paths.length === 0) return [];
  const meta = ENTITY_META[type];
  return paths.map((pathItem) => buildEntry(locale, pathItem, lastModified, meta.frequency, meta.priority, includeAlternates));
}

function buildStaticEntries(locale: Locale, fallbackDate: Date, includeAlternates: boolean): MetadataRoute.Sitemap {
  const definitions: Array<{ path: string; frequency: Frequency; priority: number }> = [
    { path: '/', frequency: 'daily', priority: 1 },
    { path: '/search', frequency: 'daily', priority: 0.8 },
    { path: '/venues', frequency: 'weekly', priority: 0.8 },
    { path: '/lists', frequency: 'weekly', priority: 0.7 }
  ];
  return definitions.map((item) => buildEntry(locale, item.path, fallbackDate, item.frequency, item.priority, includeAlternates));
}

function buildEntry(
  locale: Locale,
  pathItem: string,
  lastModified: Date,
  changeFrequency: Frequency,
  priority: number,
  includeAlternates: boolean
) {
  const url = `${baseUrl}${localizedPath(locale, pathItem)}`;
  if (!includeAlternates) {
    return { url, lastModified, changeFrequency, priority };
  }
  const languages = locales.reduce<Record<string, string>>((acc, code) => {
    acc[code] = `${baseUrl}${localizedPath(code, pathItem)}`;
    return acc;
  }, {});
  return { url, lastModified, changeFrequency, priority, alternates: { languages } };
}

async function loadTopEntries(type: TopEntity) {
  if (topCache[type]) return topCache[type]!;
  const filePath = path.join(topListDir, TOP_LIST_FILES[type]);
  let xml = '';
  try {
    xml = await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    console.error('Sitemap top list error', type, error);
    topCache[type] = [];
    return [];
  }
  const matches = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi));
  const entries: string[] = [];
  const seen = new Set<string>();
  for (const match of matches) {
    const rawValue = match[1] ?? '';
    const normalized = normalizeTopItem(rawValue, type);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    entries.push(normalized);
  }
  if (entries.length < MINIMUM_ENTRIES[type]) {
    console.warn(`Sitemap ${type} entries below expectation: ${entries.length}`);
  }
  topCache[type] = entries;
  return entries;
}

function normalizeTopItem(value: string, type: TopEntity) {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  const withoutOrigin = trimmed.replace(/^https?:\/\/[^/]+/i, '');
  const cleaned = withoutOrigin.replace(/^\/+/, '');
  if (!cleaned) return null;
  const parts = cleaned
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  if (parts[0].toLowerCase() === type) {
    parts.shift();
  }
  if (type === 'works' && parts[0]?.toLowerCase() === 'work') parts.shift();
  if (type === 'persons' && parts[0]?.toLowerCase() === 'person') parts.shift();
  if (type === 'venues' && parts[0]?.toLowerCase() === 'venue') parts.shift();
  if (parts.length === 0) return null;
  return `/${type}/${parts.join('/')}`;
}
