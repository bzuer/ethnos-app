export type IdEntityKind = 'work' | 'venue' | 'person' | 'institution';

type HrefBuilder = (value: string, kind: IdEntityKind) => string | null;

type IdentifierSpec = {
  key: string;
  labelKey: string;
  href?: HrefBuilder;
};

const enc = (value: string) => encodeURIComponent(String(value).trim());

const REGISTRY: Record<string, IdentifierSpec> = {
  doi: { key: 'doi', labelKey: 'identifiers.doi', href: (v) => `https://doi.org/${enc(v)}` },
  pmid: { key: 'pmid', labelKey: 'identifiers.pmid', href: (v) => `https://pubmed.ncbi.nlm.nih.gov/${enc(v)}` },
  pmcid: { key: 'pmcid', labelKey: 'identifiers.pmcid', href: (v) => `https://www.ncbi.nlm.nih.gov/pmc/articles/${enc(v)}` },
  arxiv: { key: 'arxiv', labelKey: 'identifiers.arxiv', href: (v) => `https://arxiv.org/abs/${enc(v)}` },
  wos: { key: 'wos', labelKey: 'identifiers.wos' },
  handle: { key: 'handle', labelKey: 'identifiers.handle', href: (v) => `https://hdl.handle.net/${enc(v)}` },
  wikidata: { key: 'wikidata', labelKey: 'identifiers.wikidata', href: (v) => `https://www.wikidata.org/wiki/${enc(v)}` },
  openalex: { key: 'openalex', labelKey: 'identifiers.openalex', href: (v) => `https://openalex.org/${enc(v)}` },
  openlibrary: { key: 'openlibrary', labelKey: 'identifiers.openlibrary', href: (v) => `https://openlibrary.org/books/${enc(v)}` },
  openlibrarywork: { key: 'openlibrarywork', labelKey: 'identifiers.openlibrary', href: (v) => `https://openlibrary.org/works/${enc(v)}` },
  isbn: { key: 'isbn', labelKey: 'identifiers.isbn' },
  isbn13: { key: 'isbn13', labelKey: 'identifiers.isbn13', href: (v) => `https://openlibrary.org/isbn/${enc(v)}` },
  issn: { key: 'issn', labelKey: 'identifiers.issn' },
  eissn: { key: 'eissn', labelKey: 'identifiers.eissn' },
  issnl: { key: 'issnl', labelKey: 'identifiers.issnl' },
  scopus: {
    key: 'scopus',
    labelKey: 'identifiers.scopus',
    href: (v, kind) => (kind === 'person'
      ? `https://www.scopus.com/authid/detail.uri?authorId=${enc(v)}`
      : `https://www.scopus.com/sourceid/${enc(v)}`)
  },
  orcid: { key: 'orcid', labelKey: 'identifiers.orcid', href: (v) => `https://orcid.org/${enc(v)}` },
  ror: { key: 'ror', labelKey: 'identifiers.ror', href: (v) => `https://ror.org/${enc(v)}` },
  grid: { key: 'grid', labelKey: 'identifiers.grid' },
  mag: { key: 'mag', labelKey: 'identifiers.mag' },
  lattes: { key: 'lattes', labelKey: 'identifiers.lattes', href: (v) => `http://lattes.cnpq.br/${enc(v)}` },
  url: { key: 'url', labelKey: 'identifiers.url' }
};

const ALIASES: Record<string, string> = {
  wikidataid: 'wikidata',
  openalexid: 'openalex',
  scopusid: 'scopus',
  scopusauthorid: 'scopus',
  magid: 'mag',
  openlibraryid: 'openlibrary',
  openlibraryworkid: 'openlibrarywork',
  lattesid: 'lattes',
  rorid: 'ror',
  gridid: 'grid',
  wosid: 'wos',
  webofscience: 'wos',
  homepage: 'url',
  homepageurl: 'url',
  website: 'url',
  websiteurl: 'url'
};

export function normalizeIdentifierKey(raw: string): string {
  const base = String(raw || '').replace(/[-\s]/g, '').replace(/_/g, '').toLowerCase();
  return ALIASES[base] || base;
}

export function getIdentifierSpec(raw: string): IdentifierSpec | null {
  const key = normalizeIdentifierKey(raw);
  return REGISTRY[key] || null;
}

export function buildIdentifierHref(raw: string, value: string | number | null | undefined, kind: IdEntityKind = 'work'): string | null {
  const spec = getIdentifierSpec(raw);
  if (!spec || !spec.href) return null;
  if (value === null || value === undefined || String(value).trim() === '') return null;
  return spec.href(String(value), kind);
}

export function identifierLabelKey(raw: string): string | null {
  const spec = getIdentifierSpec(raw);
  return spec ? spec.labelKey : null;
}
