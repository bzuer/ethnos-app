import type { Locale } from '@/i18n/config';
import {
  SITE_LOGO_PATH,
  SITE_NAME,
  SITE_ORIGIN,
  SITE_PUBLISHER,
  SITE_REPOSITORY,
  absoluteUrl,
  localeUrl
} from './site';

export type JsonLdValue = unknown;
export type JsonLdNode = Record<string, JsonLdValue>;
export type BreadcrumbItem = { name: string; path: string };

export const ORGANIZATION_ID = `${SITE_ORIGIN}/#organization`;
export const WEBSITE_ID = `${SITE_ORIGIN}/#website`;

export function pruneJsonLd(value: JsonLdValue): JsonLdValue {
  if (Array.isArray(value)) {
    const items = value.map(pruneJsonLd).filter((item) => item !== undefined);
    return items.length ? items : undefined;
  }
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as JsonLdNode)
      .map(([key, item]) => [key, pruneJsonLd(item)] as const)
      .filter(([, item]) => item !== undefined);
    if (entries.length === 0) return undefined;
    const meaningful = entries.filter(([key]) => key !== '@type' && key !== '@context');
    if (meaningful.length === 0) return undefined;
    return Object.fromEntries(entries);
  }
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return undefined;
  return value;
}

export function serializeJsonLd(value: JsonLdValue) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function buildOrganizationNode(): JsonLdNode {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: SITE_PUBLISHER,
    alternateName: SITE_NAME,
    url: SITE_ORIGIN,
    logo: {
      '@type': 'ImageObject',
      url: absoluteUrl(SITE_LOGO_PATH),
      width: 512,
      height: 512
    },
    sameAs: [SITE_REPOSITORY]
  };
}

export function buildWebSiteNode(locale: Locale, searchTemplate: string): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE_NAME,
    url: localeUrl(locale, '/'),
    inLanguage: locale,
    publisher: { '@id': ORGANIZATION_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: searchTemplate
      },
      'query-input': 'required name=search_term_string'
    }
  };
}

export function buildSiteGraph(locale: Locale, searchTemplate: string): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@graph': [buildOrganizationNode(), buildWebSiteNode(locale, searchTemplate)]
  };
}

export function buildBreadcrumbList(locale: Locale, trail: BreadcrumbItem[]): JsonLdNode | null {
  const items = trail.filter((item) => item && item.name && item.path);
  if (items.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: localeUrl(locale, item.path)
    }))
  };
}

export function buildItemList(locale: Locale, entries: Array<{ name: string; path: string }>): JsonLdNode | null {
  const items = entries.filter((entry) => entry && entry.name && entry.path);
  if (items.length === 0) return null;
  return {
    '@type': 'ItemList',
    numberOfItems: items.length,
    itemListElement: items.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.name,
      url: localeUrl(locale, entry.path)
    }))
  };
}


export function normalizeDoi(value: string) {
  return value.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:/i, '');
}

export function buildDoiIdentifier(value: string): JsonLdNode | undefined {
  const doi = normalizeDoi(value);
  if (!doi) return undefined;
  return { '@type': 'PropertyValue', propertyID: 'DOI', value: doi, url: `https://doi.org/${doi}` };
}

export function withSitePublisher(node: JsonLdNode): JsonLdNode {
  return { ...node, isPartOf: { '@id': WEBSITE_ID } };
}
