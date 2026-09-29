#!/usr/bin/env node
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const DEFAULT_ENDPOINT = 'https://api.indexnow.org/IndexNow';
const DEFAULT_BASE = 'https://ethnos.app';
const DEFAULT_STATE = path.join(ROOT, '.cache', 'indexnow', 'state.json');
const BATCH_SIZE = 10000;
const SECTIONS = ['pages', 'recent', 'works', 'venues', 'persons'];

function parseArgs(argv) {
  const options = {
    base: DEFAULT_BASE,
    source: '',
    endpoint: DEFAULT_ENDPOINT,
    sections: ['pages'],
    limit: 0,
    urlsFile: '',
    onlyNew: false,
    statePath: DEFAULT_STATE,
    dryRun: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => argv[index += 1];
    if (arg === '--base') options.base = next();
    else if (arg === '--source') options.source = next();
    else if (arg === '--endpoint') options.endpoint = next();
    else if (arg === '--section') {
      const value = next();
      options.sections = value === 'all' ? [...SECTIONS] : value.split(',').map((entry) => entry.trim()).filter(Boolean);
    } else if (arg === '--limit') options.limit = Number(next()) || 0;
    else if (arg === '--urls') options.urlsFile = next();
    else if (arg === '--new') options.onlyNew = true;
    else if (arg === '--state') options.statePath = path.resolve(next());
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function usage() {
  console.log(`Usage: node scripts/seo/indexnow.mjs [options]

  --base <url>        Site origin the URLs belong to (default ${DEFAULT_BASE})
  --source <url>      Where to read the sitemaps from, e.g. http://127.0.0.1:1212 (default --base)
  --section <list>    Sitemap sections to submit: ${SECTIONS.join(',')} or "all" (default pages)
  --urls <file>       Newline separated URL list, used instead of the sitemaps
  --new               Submit only URLs never submitted before or whose <lastmod> changed
  --state <file>      State file used by --new (default .cache/indexnow/state.json)
  --limit <n>         Cap the number of submitted URLs (with --new the rest waits for the next run)
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

function decodeXml(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function extractEntries(xml, section) {
  return Array.from(xml.matchAll(/<url>([\s\S]*?)<\/url>/gi))
    .map((match) => {
      const block = match[1];
      const loc = decodeXml(((block.match(/<loc>([^<]+)<\/loc>/i) || [])[1] || '').trim());
      const lastmod = ((block.match(/<lastmod>([^<]+)<\/lastmod>/i) || [])[1] || '').trim();
      return { section, loc, lastmod };
    })
    .filter((entry) => entry.loc);
}

async function collectEntries(options) {
  if (options.urlsFile) {
    const content = await readFile(options.urlsFile, 'utf-8');
    return {
      fetched: new Set(),
      entries: content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((loc) => ({ section: 'urls', loc, lastmod: '' }))
    };
  }
  const fetched = new Set();
  const entries = [];
  for (const section of options.sections) {
    if (!SECTIONS.includes(section)) throw new Error(`Unknown sitemap section: ${section}`);
    const sectionEntries = extractEntries(await fetchText(`${options.source}/sitemaps/${section}.xml`), section);
    if (sectionEntries.length > 0) fetched.add(section);
    entries.push(...sectionEntries);
  }
  return { fetched, entries };
}

async function loadState(file) {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf-8'));
    if (parsed && typeof parsed === 'object' && parsed.urls && typeof parsed.urls === 'object') return parsed;
  } catch {}
  return { version: 1, urls: {} };
}

async function saveState(file, state) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify({ ...state, updatedAt: new Date().toISOString() })}\n`);
  await rename(temporary, file);
}

function isPending(state, entry) {
  const known = state.urls[entry.loc];
  if (!known) return true;
  return Boolean(entry.lastmod) && known.lastmod !== entry.lastmod;
}

function pruneState(state, fetched, entries) {
  const listed = new Set(entries.map((entry) => entry.loc));
  let removed = 0;
  for (const [loc, record] of Object.entries(state.urls)) {
    if (fetched.has(record.section) && !listed.has(loc)) {
      delete state.urls[loc];
      removed += 1;
    }
  }
  return removed;
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
  const source = (options.source || base).replace(/\/+$/, '');
  const host = new URL(base).host;
  const keyLocation = `${base}/${file}`;
  const { fetched, entries: collected } = await collectEntries({ ...options, source });
  const seen = new Set();
  const entries = collected.filter((entry) => {
    if (seen.has(entry.loc)) return false;
    seen.add(entry.loc);
    try {
      return new URL(entry.loc).host === host;
    } catch {
      return false;
    }
  });
  if (entries.length === 0) throw new Error('No URLs resolved for submission');

  const state = options.onlyNew ? await loadState(options.statePath) : null;
  let pending = state ? entries.filter((entry) => isPending(state, entry)) : entries;
  const backlog = pending.length;
  if (options.limit > 0) pending = pending.slice(0, options.limit);

  console.log(`host=${host} key=${key.slice(0, 6)}… keyLocation=${keyLocation} listed=${entries.length} pending=${backlog} submitting=${pending.length}`);
  if (options.dryRun) {
    pending.forEach((entry) => console.log(entry.loc));
    return;
  }

  let failures = 0;
  let throttled = false;
  let submitted = 0;
  for (let offset = 0; offset < pending.length; offset += BATCH_SIZE) {
    const batch = pending.slice(offset, offset + BATCH_SIZE);
    const result = await submitBatch(options.endpoint, { host, key, keyLocation, urlList: batch.map((entry) => entry.loc) });
    console.log(`batch ${offset / BATCH_SIZE + 1}: ${batch.length} urls -> ${result.status} ${result.body || ''}`.trim());
    if (result.status === 429) {
      throttled = true;
      break;
    }
    if (result.status !== 200 && result.status !== 202) {
      failures += 1;
      break;
    }
    submitted += batch.length;
    if (state) {
      for (const entry of batch) state.urls[entry.loc] = { lastmod: entry.lastmod, section: entry.section };
      await saveState(options.statePath, state);
    }
  }

  if (state) {
    const removed = failures === 0 ? pruneState(state, fetched, entries) : 0;
    await saveState(options.statePath, state);
    console.log(`state=${options.statePath} tracked=${Object.keys(state.urls).length} pruned=${removed} remaining=${backlog - submitted}`);
  }
  if (throttled) console.warn('indexnow: throttled (HTTP 429); the remaining URLs stay pending for the next run');
  if (failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`indexnow: ${error.message}`);
  process.exitCode = 1;
});
