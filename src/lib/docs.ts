import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { inlineText, parseMarkdown, slugifyHeading, type BlockNode, type InlineNode } from './markdown';

export type DocCollectionId = 'corpus';

export type DocChapterEntry = {
  slug: string;
  file: string;
  number: number;
};

export type DocCollection = {
  id: DocCollectionId;
  directory: string;
  indexFile: string;
  metadataKey: string;
  chapters: DocChapterEntry[];
};

export type DocOutlineEntry = {
  id: string;
  ordinal: string;
  text: string;
  level: number;
};

export type DocDocument = {
  blocks: BlockNode[];
  outline: DocOutlineEntry[];
};

export type DocChapter = DocDocument & {
  collection: DocCollectionId;
  slug: string;
  number: number;
  previous: DocChapterEntry | null;
  next: DocChapterEntry | null;
};

const DOCS_ROOT = path.join(process.cwd(), 'docs');

export const DOC_COLLECTIONS: DocCollection[] = [
  {
    id: 'corpus',
    directory: 'data_doc',
    indexFile: 'README.md',
    metadataKey: 'metadata.docsCorpus',
    chapters: [
      { slug: 'the-problem', file: '01-the-problem.md', number: 1 },
      { slug: 'data-model', file: '02-data-model.md', number: 2 },
      { slug: 'sources', file: '03-sources.md', number: 3 },
      { slug: 'collection', file: '04-collection.md', number: 4 },
      { slug: 'cleaning', file: '05-cleaning.md', number: 5 },
      { slug: 'relevance', file: '06-relevance.md', number: 6 },
      { slug: 'incompleteness', file: '07-incompleteness.md', number: 7 },
      { slug: 'files-and-availability', file: '08-files-and-availability.md', number: 8 },
      { slug: 'operations', file: '09-operations.md', number: 9 }
    ]
  }
];

export const DOCS_PATH = '/docs';

export function docCollectionPath(collection: DocCollectionId) {
  return `${DOCS_PATH}/${collection}`;
}

export function docChapterPath(collection: DocCollectionId, slug: string) {
  return `${DOCS_PATH}/${collection}/${slug}`;
}

export function getDocCollection(id: string): DocCollection | null {
  return DOC_COLLECTIONS.find((collection) => collection.id === id) ?? null;
}

export function getDocChapterEntry(collection: DocCollection, slug: string): DocChapterEntry | null {
  return collection.chapters.find((chapter) => chapter.slug === slug) ?? null;
}

export function listDocPaths(): string[] {
  const paths = [DOCS_PATH];
  for (const collection of DOC_COLLECTIONS) {
    paths.push(docCollectionPath(collection.id));
    for (const chapter of collection.chapters) paths.push(docChapterPath(collection.id, chapter.slug));
  }
  return paths;
}

const routeBySourceFile = buildRouteMap();

function buildRouteMap() {
  const routes = new Map<string, string>();
  for (const collection of DOC_COLLECTIONS) {
    routes.set(`${collection.directory}/${collection.indexFile}`, docCollectionPath(collection.id));
    routes.set(collection.directory, docCollectionPath(collection.id));
    for (const chapter of collection.chapters) {
      routes.set(`${collection.directory}/${chapter.file}`, docChapterPath(collection.id, chapter.slug));
    }
  }
  return routes;
}

const documentCache = new Map<string, DocDocument>();

export async function getDocCollectionIndex(collection: DocCollection): Promise<DocDocument> {
  return loadDocument(`${collection.directory}/${collection.indexFile}`, null);
}

export async function getDocChapter(collection: DocCollection, slug: string): Promise<DocChapter | null> {
  const entry = getDocChapterEntry(collection, slug);
  if (!entry) return null;
  const index = collection.chapters.indexOf(entry);
  const document = await loadDocument(`${collection.directory}/${entry.file}`, entry.number);
  return {
    ...document,
    collection: collection.id,
    slug: entry.slug,
    number: entry.number,
    previous: index > 0 ? collection.chapters[index - 1] : null,
    next: index < collection.chapters.length - 1 ? collection.chapters[index + 1] : null
  };
}

async function loadDocument(sourceFile: string, chapterNumber: number | null): Promise<DocDocument> {
  const cached = documentCache.get(sourceFile);
  if (cached) return cached;
  const raw = await fs.readFile(path.join(DOCS_ROOT, sourceFile), 'utf8');
  const document = prepareDocument(parseMarkdown(raw), sourceFile, chapterNumber);
  documentCache.set(sourceFile, document);
  return document;
}

function prepareDocument(blocks: BlockNode[], sourceFile: string, chapterNumber: number | null): DocDocument {
  const body = stripSourceNavigation(blocks);
  const outline: DocOutlineEntry[] = [];
  const usedIds = new Set<string>();
  const counters = [0, 0, 0];
  const prepared = body.map((block) => decorateBlock(block, sourceFile, chapterNumber, outline, usedIds, counters));
  return { blocks: prepared, outline };
}

function stripSourceNavigation(blocks: BlockNode[]): BlockNode[] {
  const body = [...blocks];
  if (body[0]?.kind === 'heading' && body[0].level === 1) body.shift();
  const first = body[0];
  if (first?.kind === 'paragraph' && isSourceNavigation(first.children)) {
    body.shift();
    if (body[0]?.kind === 'rule') body.shift();
  }
  const last = body[body.length - 1];
  if (last?.kind === 'paragraph' && isSourceNavigation(last.children)) {
    body.pop();
    if (body[body.length - 1]?.kind === 'rule') body.pop();
  }
  return body;
}

function isSourceNavigation(children: InlineNode[]) {
  const text = inlineText(children).trim();
  if (!text.startsWith('←') && !text.startsWith('next →')) return false;
  const links = children.filter((node) => node.kind === 'link');
  return links.length > 0 && links.every((node) => node.kind === 'link' && /\.md(#.*)?$/.test(node.href));
}

function decorateBlock(
  block: BlockNode,
  sourceFile: string,
  chapterNumber: number | null,
  outline: DocOutlineEntry[],
  usedIds: Set<string>,
  counters: number[]
): BlockNode {
  if (block.kind === 'heading') {
    const id = uniqueId(slugifyHeading(block.text) || 'section', usedIds);
    const ordinal = nextOrdinal(block.level, chapterNumber, counters);
    if (block.level <= 3) outline.push({ id, ordinal, text: block.text, level: block.level });
    return { ...block, id, ordinal, children: resolveInline(block.children, sourceFile) };
  }
  if (block.kind === 'paragraph') return { ...block, children: resolveInline(block.children, sourceFile) };
  if (block.kind === 'quote') {
    return { ...block, children: block.children.map((child) => decorateBlock(child, sourceFile, chapterNumber, outline, usedIds, counters)) };
  }
  if (block.kind === 'list') {
    return {
      ...block,
      items: block.items.map((item) => item.map((child) => decorateBlock(child, sourceFile, chapterNumber, outline, usedIds, counters)))
    };
  }
  if (block.kind === 'table') {
    return {
      ...block,
      head: block.head.map((cell) => resolveInline(cell, sourceFile)),
      rows: block.rows.map((row) => row.map((cell) => resolveInline(cell, sourceFile)))
    };
  }
  return block;
}

function nextOrdinal(level: number, chapterNumber: number | null, counters: number[]) {
  if (chapterNumber === null || level < 2 || level > 3) return '';
  if (level === 2) {
    counters[0] += 1;
    counters[1] = 0;
    return `${chapterNumber}.${counters[0]}`;
  }
  counters[1] += 1;
  return `${chapterNumber}.${counters[0]}.${counters[1]}`;
}

function uniqueId(base: string, used: Set<string>) {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let suffix = 1;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  const id = `${base}-${suffix}`;
  used.add(id);
  return id;
}

function resolveInline(nodes: InlineNode[], sourceFile: string): InlineNode[] {
  return nodes.map((node) => {
    if (node.kind === 'link') {
      const href = resolveDocHref(node.href, sourceFile);
      const children = resolveInline(node.children, sourceFile);
      if (!href) return { kind: 'emphasis', children };
      return { kind: 'link', href, children };
    }
    if (node.kind === 'strong' || node.kind === 'emphasis') {
      return { ...node, children: resolveInline(node.children, sourceFile) };
    }
    return node;
  });
}

export function resolveDocHref(href: string, sourceFile: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) return null;
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('#')) return trimmed;
  const [target, hash] = splitHash(trimmed);
  if (!target) return hash ? `#${hash}` : null;
  const resolved = normalizeRelative(path.posix.dirname(sourceFile), target);
  const route = routeBySourceFile.get(resolved) ?? routeBySourceFile.get(resolved.replace(/\/$/, ''));
  if (!route) return null;
  return hash ? `${route}#${hash}` : route;
}

function splitHash(value: string): [string, string] {
  const index = value.indexOf('#');
  if (index === -1) return [value, ''];
  return [value.slice(0, index), value.slice(index + 1)];
}

function normalizeRelative(directory: string, target: string) {
  const base = directory === '.' ? '' : directory;
  const joined = path.posix.normalize(path.posix.join(base, target));
  return joined.replace(/^\.\//, '').replace(/\/$/, '');
}
