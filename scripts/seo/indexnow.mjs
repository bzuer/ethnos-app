#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const DEFAULT_ENDPOINT = 'https://api.indexnow.org/IndexNow';
const DEFAULT_BASE = 'https://ethnos.app';
const BATCH_SIZE = 10000;
const SECTIONS = ['pages', 'works', 'venues', 'persons'];

function parseArgs(argv) {
  const options = {
    base: DEFAULT_BASE,
    endpoint: DEFAULT_ENDPOINT,
    sections: ['pages'],
    limit: 0,
    urlsFile: '',
    dryRun: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => argv[index += 1];
    if (arg === '--base') options.base = next();
    else if (arg === '--endpoint') options.endpoint = next();
    else if (arg === '--section') {
      const value = next();
      options.sections = value === 'all' ? [...SECTIONS] : value.split(',').map((entry) => entry.trim()).filter(Boolean);
    } else if (arg === '--limit') options.limit = Number(next()) || 0;
    else if (arg === '--urls') options.urlsFile = next();
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function usage() {
  console.log(`Usage: node scripts/seo/indexnow.mjs [options]

  --base <url>        Site origin to submit (default ${DEFAULT_BASE})
  --section <list>    Sitemap sections to submit: ${SECTIONS.join(',')} or "all" (default pages)
  --urls <file>       Newline separated URL list, used instead of the sitemaps
  --limit <n>         Cap the number of submitted URLs
  --endpoint <url>    IndexNow endpoint (default ${DEFAULT_ENDPOINT})
  --dry-run           Resolve the URL list and print it without submitting
`);
}

async function resolveKey() {
  const fromEnv = process.env.INDEXNOW_KEY?.trim();
  if (fromEnv) return { key: fromEnv, file: `${fromEnv}.txt` };
  const entries = await readdir(PUBLIC_DIR);
  const candidates = entries.filter((entry) => /^[0-9a-f]{8,128}\.txt$/i.test(entry));
  if (candidates.length === 0) throw new Error('No IndexNow key file found in public/ and INDEXNOW_KEY is unset');
  if (candidates.length > 1) throw new Error(`Multiple IndexNow key files in public/: ${candidates.join(', ')}`);
  const file = candidates[0];
  const key = (await readFile(path.join(PUBLIC_DIR, file), 'utf-8')).trim();
  const expected = file.replace(/\.txt$/i, '');
  if (key !== expected) throw new Error(`Key file ${file} contains "${key}" but must contain "${expected}"`);
  return { key, file };
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { accept: 'application/xml,text/plain' } });
  if (!response.ok) throw new Error(`${url} responded ${response.status}`);
  return response.text();
}

function extractLocs(xml) {
  return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/gi)).map((match) => decodeXml(match[1].trim()));
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

async function collectUrls(options) {
  if (options.urlsFile) {
    const content = await readFile(options.urlsFile, 'utf-8');
    return content.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
  }
  const urls = [];
  for (const section of options.sections) {
    if (!SECTIONS.includes(section)) throw new Error(`Unknown sitemap section: ${section}`);
    const xml = await fetchText(`${options.base}/sitemaps/${section}.xml`);
    urls.push(...extractLocs(xml));
  }
  return Array.from(new Set(urls));
}

async function submitBatch(endpoint, payload) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload)
  });
  const body = await response.text();
  return { status: response.status, body: body.trim() };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }
  const { key, file } = await resolveKey();
  const base = options.base.replace(/\/+$/, '');
  const host = new URL(base).host;
  const keyLocation = `${base}/${file}`;
  let urls = await collectUrls({ ...options, base });
  if (options.limit > 0) urls = urls.slice(0, options.limit);
  if (urls.length === 0) throw new Error('No URLs resolved for submission');

  console.log(`host=${host} key=${key.slice(0, 6)}… keyLocation=${keyLocation} urls=${urls.length}`);
  if (options.dryRun) {
    urls.forEach((url) => console.log(url));
    return;
  }

  let failures = 0;
  for (let offset = 0; offset < urls.length; offset += BATCH_SIZE) {
    const batch = urls.slice(offset, offset + BATCH_SIZE);
    const result = await submitBatch(options.endpoint, { host, key, keyLocation, urlList: batch });
    const ok = result.status === 200 || result.status === 202;
    if (!ok) failures += 1;
    console.log(`batch ${offset / BATCH_SIZE + 1}: ${batch.length} urls -> ${result.status} ${result.body || ''}`.trim());
  }
  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`indexnow: ${error.message}`);
  process.exitCode = 1;
});
