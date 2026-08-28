#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const DEFAULT_BASE = 'http://127.0.0.1:1212';
const CANONICAL_ORIGIN = 'https://ethnos.app';
const LOCALES = ['en', 'pt', 'es'];
const LOCALE_PREFIX = { en: '', pt: '/pt', es: '/es' };
const SITEMAP_SECTIONS = ['pages', 'works', 'venues', 'persons'];
const SITEMAP_URL_LIMIT = 50000;
const SITEMAP_BYTE_LIMIT = 50 * 1024 * 1024;
const TITLE_MAX = 70;
const DESCRIPTION_MIN = 50;
const DESCRIPTION_MAX = 320;

const results = [];
let currentGroup = '';

function group(name) {
  currentGroup = name;
}

function record(ok, label, detail = '', level = 'error') {
  results.push({ group: currentGroup, ok, label, detail, level });
}

function check(condition, label, detail = '') {
  record(Boolean(condition), label, condition ? '' : detail);
  return Boolean(condition);
}

function advise(condition, label, detail = '') {
  record(Boolean(condition), label, condition ? '' : detail, 'warn');
  return Boolean(condition);
}

function parseArgs(argv) {
  const options = { base: DEFAULT_BASE, sampleSize: 3, skipEntities: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--base') options.base = argv[++index];
    else if (arg === '--sample') options.sampleSize = Number(argv[++index]) || 1;
    else if (arg === '--skip-entities') options.skipEntities = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  options.base = options.base.replace(/\/+$/, '');
  return options;
}

async function request(base, pathname, init) {
  const url = `${base}${pathname}`;
  const response = await fetch(url, { redirect: 'manual', ...init });
  const body = await response.text();
  return { url, status: response.status, headers: response.headers, body };
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function toCanonicalPath(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return '';
  }
}

function localizedPath(locale, pathname) {
  const prefix = LOCALE_PREFIX[locale];
  if (!prefix) return pathname;
  return pathname === '/' ? prefix : `${prefix}${pathname}`;
}

function extractHead(html) {
  const match = html.match(/<head>([\s\S]*?)<\/head>/i);
  return match ? match[1] : '';
}

function extractTag(head, regex) {
  return Array.from(head.matchAll(regex)).map((match) => decodeXml(match[1]));
}

function metaContent(head, name) {
  const attr = name.startsWith('og:') || name.startsWith('article:') ? 'property' : 'name';
  const regex = new RegExp(`<meta[^>]+${attr}="${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*content="([^"]*)"`, 'gi');
  const alternate = new RegExp(`<meta[^>]+content="([^"]*)"[^>]*${attr}="${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'gi');
  const values = [...extractTag(head, regex), ...extractTag(head, alternate)];
  return values;
}

function linkHrefs(head, rel) {
  const regex = new RegExp(`<link[^>]+rel="${rel}"[^>]*>`, 'gi');
  return Array.from(head.matchAll(regex)).map((match) => match[0]);
}

function attrOf(tag, attribute) {
  const match = tag.match(new RegExp(`${attribute}="([^"]*)"`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

async function auditRobots(base) {
  group('robots.txt');
  const response = await request(base, '/robots.txt');
  check(response.status === 200, 'robots.txt responds 200', `status ${response.status}`);
  check(/^text\/plain/.test(response.headers.get('content-type') || ''), 'robots.txt is text/plain', response.headers.get('content-type') || 'missing');
  const body = response.body;
  check(/^user-agent:\s*\*/im.test(body), 'declares a wildcard user-agent group');
  check(/^allow:\s*\//im.test(body), 'allows crawling of the site root');
  const sitemaps = Array.from(body.matchAll(/^sitemap:\s*(\S+)/gim)).map((match) => match[1]);
  check(sitemaps.length > 0, 'declares at least one Sitemap');
  for (const sitemap of sitemaps) {
    check(sitemap.startsWith(CANONICAL_ORIGIN), `sitemap ${sitemap} uses the canonical origin`, sitemap);
    const probe = await request(base, toCanonicalPath(sitemap) || '/sitemap.xml');
    check(probe.status === 200, `sitemap ${sitemap} is reachable`, `status ${probe.status}`);
  }
  const disallowed = Array.from(body.matchAll(/^disallow:\s*(\S+)/gim)).map((match) => match[1]);
  const indexablePrefixes = ['/works', '/persons', '/venues', '/institutions', '/subjects', '/search'];
  for (const rule of disallowed) {
    if (rule === '/') continue;
    const collides = indexablePrefixes.some((prefix) => prefix.startsWith(rule.replace(/\*$/, '')));
    check(!collides, `Disallow ${rule} does not block indexable sections`, rule);
  }
  return sitemaps;
}

async function auditIndexNowKey(base) {
  group('IndexNow');
  const entries = await readdir(PUBLIC_DIR);
  const candidates = entries.filter((entry) => /^[0-9a-f]{8,128}\.txt$/i.test(entry));
  if (!check(candidates.length === 1, 'exactly one IndexNow key file in public/', candidates.join(', ') || 'none')) return;
  const file = candidates[0];
  const expected = file.replace(/\.txt$/i, '');
  const local = (await readFile(path.join(PUBLIC_DIR, file), 'utf-8')).trim();
  check(local === expected, 'key file content matches its filename', `${local} != ${expected}`);
  const served = await request(base, `/${file}`);
  check(served.status === 200, `key file /${file} is served`, `status ${served.status}`);
  check(served.body.trim() === expected, 'served key file content matches', served.body.trim());
}

async function auditSitemaps(base) {
  group('sitemaps');
  const index = await request(base, '/sitemap.xml');
  check(index.status === 200, 'sitemap index responds 200', `status ${index.status}`);
  check(/application\/xml|text\/xml/.test(index.headers.get('content-type') || ''), 'sitemap index is XML', index.headers.get('content-type') || 'missing');
  check(index.body.includes('<sitemapindex'), 'sitemap index uses <sitemapindex>');
  const locs = Array.from(index.body.matchAll(/<loc>([^<]+)<\/loc>/gi)).map((match) => decodeXml(match[1]));
  check(locs.length === SITEMAP_SECTIONS.length, `sitemap index lists ${SITEMAP_SECTIONS.length} sections`, `found ${locs.length}`);

  const sitemapUrls = [];
  for (const loc of locs) {
    const pathname = toCanonicalPath(loc);
    const section = await request(base, pathname);
    check(section.status === 200, `${pathname} responds 200`, `status ${section.status}`);
    check(section.body.startsWith('<?xml'), `${pathname} starts with an XML declaration`);
    check(Buffer.byteLength(section.body) <= SITEMAP_BYTE_LIMIT, `${pathname} is under 50MB`);
    const urls = Array.from(section.body.matchAll(/<url>([\s\S]*?)<\/url>/gi)).map((match) => match[1]);
    check(urls.length > 0, `${pathname} contains URLs`);
    check(urls.length <= SITEMAP_URL_LIMIT, `${pathname} is under ${SITEMAP_URL_LIMIT} URLs`, `${urls.length} URLs`);

    let alternateFailures = 0;
    let originFailures = 0;
    for (const block of urls) {
      const loc2 = decodeXml((block.match(/<loc>([^<]+)<\/loc>/i) || [])[1] || '');
      if (!loc2.startsWith(CANONICAL_ORIGIN)) originFailures += 1;
      sitemapUrls.push(loc2);
      const alternates = Array.from(block.matchAll(/hreflang="([^"]+)"\s+href="([^"]+)"/gi))
        .map((match) => ({ lang: match[1], href: decodeXml(match[2]) }));
      const langs = new Set(alternates.map((entry) => entry.lang));
      const hrefs = new Set(alternates.map((entry) => entry.href));
      const complete = LOCALES.every((locale) => langs.has(locale)) && langs.has('x-default');
      if (!complete || !hrefs.has(loc2)) alternateFailures += 1;
    }
    check(originFailures === 0, `${pathname} <loc> values use the canonical origin`, `${originFailures} offending URLs`);
    check(alternateFailures === 0, `${pathname} alternates are complete and self-referential`, `${alternateFailures} offending URLs`);
  }
  return sitemapUrls;
}

async function auditManifests(base) {
  group('web manifest');
  for (const locale of LOCALES) {
    const pathname = `${LOCALE_PREFIX[locale]}/site.webmanifest`;
    const response = await request(base, pathname);
    if (!check(response.status === 200, `${pathname} responds 200`, `status ${response.status}`)) continue;
    check(/application\/manifest\+json/.test(response.headers.get('content-type') || ''), `${pathname} uses application/manifest+json`, response.headers.get('content-type') || 'missing');
    let manifest;
    try {
      manifest = JSON.parse(response.body);
    } catch (error) {
      record(false, `${pathname} is valid JSON`, error.message);
      continue;
    }
    record(true, `${pathname} is valid JSON`);
    for (const field of ['id', 'name', 'short_name', 'start_url', 'scope', 'display', 'icons', 'theme_color', 'background_color']) {
      check(manifest[field] !== undefined, `${pathname} declares ${field}`);
    }
    check(manifest.lang === locale, `${pathname} declares lang=${locale}`, String(manifest.lang));
    check(String(manifest.start_url).startsWith(LOCALE_PREFIX[locale] || '/'), `${pathname} start_url matches the locale`, String(manifest.start_url));
    const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
    check(icons.some((icon) => String(icon.sizes) === '192x192'), `${pathname} ships a 192x192 icon`);
    check(icons.some((icon) => String(icon.sizes) === '512x512'), `${pathname} ships a 512x512 icon`);
    check(icons.some((icon) => String(icon.purpose || '').includes('maskable')), `${pathname} ships a maskable icon`);
    const assets = new Set([
      ...icons.map((icon) => icon.src),
      ...(Array.isArray(manifest.screenshots) ? manifest.screenshots.map((shot) => shot.src) : [])
    ]);
    for (const asset of assets) {
      const probe = await request(base, asset, { method: 'HEAD' });
      check(probe.status === 200, `${pathname} asset ${asset} is reachable`, `status ${probe.status}`);
    }
    for (const shortcut of Array.isArray(manifest.shortcuts) ? manifest.shortcuts : []) {
      const probe = await request(base, shortcut.url);
      check(probe.status === 200, `${pathname} shortcut ${shortcut.url} resolves`, `status ${probe.status}`);
    }
  }
}

async function auditPage(base, pathname, expectations) {
  group(`page ${pathname}`);
  const response = await request(base, pathname);
  if (!check(response.status === (expectations.status || 200), `${pathname} responds ${expectations.status || 200}`, `status ${response.status}`)) return;
  const html = response.body;
  const head = extractHead(html);
  check(Boolean(head), `${pathname} exposes a <head>`);

  const titles = extractTag(head, /<title>([\s\S]*?)<\/title>/gi);
  check(titles.length === 1, `${pathname} has exactly one <title>`, `${titles.length} found`);
  const title = titles[0] || '';
  check(title.trim().length > 0, `${pathname} title is not empty`);
  advise(title.length <= TITLE_MAX, `${pathname} title fits ${TITLE_MAX} characters`, `${title.length}: ${title}`);

  const descriptions = metaContent(head, 'description');
  check(descriptions.length === 1, `${pathname} has exactly one meta description`, `${descriptions.length} found`);
  const description = descriptions[0] || '';
  check(description.length > 0, `${pathname} description is not empty`);
  advise(description.length >= DESCRIPTION_MIN && description.length <= DESCRIPTION_MAX,
    `${pathname} description length is ${DESCRIPTION_MIN}-${DESCRIPTION_MAX}`, `${description.length}: ${description.slice(0, 90)}`);

  const canonicalTags = linkHrefs(head, 'canonical');
  check(canonicalTags.length === 1, `${pathname} has exactly one canonical`, `${canonicalTags.length} found`);
  const canonical = attrOf(canonicalTags[0] || '', 'href');
  check(canonical.startsWith(CANONICAL_ORIGIN), `${pathname} canonical uses the production origin`, canonical);
  const canonicalPath = toCanonicalPath(canonical);
  check(canonicalPath === pathname || (pathname === '/' && canonicalPath === ''),
    `${pathname} canonical is self-referential`, canonical);

  const alternates = linkHrefs(head, 'alternate')
    .map((tag) => ({ lang: attrOf(tag, 'hreflang') || attrOf(tag, 'hrefLang'), href: attrOf(tag, 'href') }))
    .filter((entry) => entry.lang);
  const langs = new Set(alternates.map((entry) => entry.lang));
  check(LOCALES.every((locale) => langs.has(locale)), `${pathname} declares every locale hreflang`, [...langs].join(','));
  check(langs.has('x-default'), `${pathname} declares x-default`);
  const selfAlternate = alternates.some((entry) => toCanonicalPath(entry.href) === canonicalPath);
  check(selfAlternate, `${pathname} hreflang set includes itself`, canonical);

  const htmlLang = (html.match(/<html[^>]+lang="([^"]+)"/i) || [])[1] || '';
  check(htmlLang === expectations.locale, `${pathname} html lang is ${expectations.locale}`, htmlLang);

  const robots = metaContent(head, 'robots')[0] || '';
  check(Boolean(robots), `${pathname} declares a robots directive`);
  if (expectations.noindex) {
    check(/noindex/i.test(robots), `${pathname} is noindex`, robots);
  } else {
    check(!/noindex/i.test(robots), `${pathname} is indexable`, robots);
  }

  for (const property of ['og:title', 'og:description', 'og:url', 'og:image', 'og:type', 'og:site_name', 'og:locale']) {
    check(metaContent(head, property).length >= 1, `${pathname} declares ${property}`);
  }
  const ogImage = metaContent(head, 'og:image')[0] || '';
  if (ogImage) {
    const probe = await request(base, toCanonicalPath(ogImage), { method: 'HEAD' });
    check(probe.status === 200, `${pathname} og:image is reachable`, `status ${probe.status}`);
  }
  check(metaContent(head, 'twitter:card').length === 1, `${pathname} declares twitter:card`);

  const manifestTags = linkHrefs(head, 'manifest');
  check(manifestTags.length === 1, `${pathname} links exactly one manifest`, `${manifestTags.length} found`);
  const manifestHref = attrOf(manifestTags[0] || '', 'href');
  check(manifestHref === localizedPath(expectations.locale, '/site.webmanifest'),
    `${pathname} links the locale manifest`, manifestHref);

  const blocks = Array.from(html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)).map((match) => match[1]);
  check(blocks.length >= 1, `${pathname} embeds JSON-LD`);
  let jsonLdTypes = [];
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block);
      const nodes = Array.isArray(parsed['@graph']) ? parsed['@graph'] : [parsed];
      jsonLdTypes.push(...nodes.map((node) => node['@type']).filter(Boolean));
      check(Boolean(parsed['@context']), `${pathname} JSON-LD declares @context`);
    } catch (error) {
      record(false, `${pathname} JSON-LD parses`, error.message);
    }
  }
  if (expectations.jsonLdTypes) {
    for (const type of expectations.jsonLdTypes) {
      check(jsonLdTypes.includes(type), `${pathname} JSON-LD contains ${type}`, jsonLdTypes.join(','));
    }
  }
}

async function auditStatuses(base) {
  group('status codes');
  const missing = await request(base, '/works/000000000');
  check(missing.status === 404, 'unknown work returns 404', `status ${missing.status}`);
  const bogus = await request(base, '/this-page-does-not-exist');
  check(bogus.status === 404, 'unknown path returns 404', `status ${bogus.status}`);
  for (const legacy of ['/journals', '/journals/all', '/results', '/works']) {
    const response = await request(base, legacy);
    check(response.status === 308, `${legacy} redirects permanently`, `status ${response.status}`);
    const location = response.headers.get('location') || '';
    check(Boolean(location), `${legacy} sets a Location header`);
    if (location) {
      const followed = await request(base, toCanonicalPath(location) || location);
      check(followed.status === 200, `${legacy} lands on a 200`, `status ${followed.status}`);
    }
  }
}

function pickSample(urls, prefix, count) {
  const matching = urls
    .map(toCanonicalPath)
    .filter((pathname) => pathname.startsWith(prefix) && !LOCALES.some((locale) => pathname.startsWith(`/${locale}/`)));
  const step = Math.max(1, Math.floor(matching.length / count));
  const picked = [];
  for (let index = 0; index < matching.length && picked.length < count; index += step) {
    picked.push(matching[index]);
  }
  return picked;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(`Usage: node scripts/seo/audit.mjs [--base <url>] [--sample <n>] [--skip-entities]`);
    return;
  }
  console.log(`SEO audit against ${options.base}\n`);

  await auditRobots(options.base);
  await auditIndexNowKey(options.base);
  const sitemapUrls = await auditSitemaps(options.base);
  await auditManifests(options.base);

  for (const locale of LOCALES) {
    await auditPage(options.base, localizedPath(locale, '/'), { locale, jsonLdTypes: ['WebSite', 'Organization'] });
    await auditPage(options.base, localizedPath(locale, '/search'), { locale });
    await auditPage(options.base, localizedPath(locale, '/venues'), { locale });
  }
  await auditPage(options.base, '/privacy', { locale: 'en' });
  await auditPage(options.base, '/license', { locale: 'en' });
  await auditPage(options.base, '/search/results', { locale: 'en', noindex: true });
  await auditPage(options.base, '/search/global', { locale: 'en', noindex: true });
  await auditPage(options.base, '/lists', { locale: 'en', noindex: true });
  await auditPage(options.base, '/maintenance', { locale: 'en', noindex: true });

  if (!options.skipEntities) {
    const samples = [
      ...pickSample(sitemapUrls, '/works/', options.sampleSize).map((pathname) => ({ pathname, jsonLdTypes: ['BreadcrumbList'] })),
      ...pickSample(sitemapUrls, '/venues/', options.sampleSize).map((pathname) => ({ pathname, jsonLdTypes: ['Periodical', 'BreadcrumbList'] })),
      ...pickSample(sitemapUrls, '/persons/', options.sampleSize).map((pathname) => ({ pathname, jsonLdTypes: ['Person', 'BreadcrumbList'] }))
    ];
    for (const sample of samples) {
      await auditPage(options.base, sample.pathname, { locale: 'en', jsonLdTypes: sample.jsonLdTypes });
    }
  }

  await auditStatuses(options.base);

  const failures = results.filter((entry) => !entry.ok && entry.level === 'error');
  const warnings = results.filter((entry) => !entry.ok && entry.level === 'warn');
  const groups = [...new Set(results.map((entry) => entry.group))];
  for (const name of groups) {
    const entries = results.filter((entry) => entry.group === name);
    const failed = entries.filter((entry) => !entry.ok && entry.level === 'error');
    const warned = entries.filter((entry) => !entry.ok && entry.level === 'warn');
    const label = failed.length > 0 ? 'FAIL' : warned.length > 0 ? 'WARN' : 'PASS';
    console.log(`${label}  ${name}  (${entries.length - failed.length - warned.length}/${entries.length})`);
    for (const entry of failed) console.log(`      ! ${entry.label}${entry.detail ? ` :: ${entry.detail}` : ''}`);
    for (const entry of warned) console.log(`      ~ ${entry.label}${entry.detail ? ` :: ${entry.detail}` : ''}`);
  }
  console.log(`\n${results.length - failures.length - warnings.length}/${results.length} checks passed, ${warnings.length} advisory, ${failures.length} failed`);
  if (failures.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`audit: ${error.message}`);
  console.error(error.stack);
  process.exitCode = 1;
});
