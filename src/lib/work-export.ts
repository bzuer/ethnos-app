import { groupContributorsByRole, normalizeWorkDetail, pickContributorEntries } from './works';
import { buildIdentifierHref } from './identifiers';
import { SITE_ORIGIN } from './site';

const WORK_TYPE_FORMATS: Record<string, { bibtex: string; ris: string }> = {
  ARTICLE: { bibtex: 'article', ris: 'JOUR' },
  REVIEW: { bibtex: 'article', ris: 'JOUR' },
  EDITORIAL: { bibtex: 'article', ris: 'JOUR' },
  BOOK: { bibtex: 'book', ris: 'BOOK' },
  CHAPTER: { bibtex: 'incollection', ris: 'CHAP' },
  CONFERENCE: { bibtex: 'inproceedings', ris: 'CPAPER' },
  CONFERENCE_PAPER: { bibtex: 'inproceedings', ris: 'CPAPER' },
  THESIS: { bibtex: 'phdthesis', ris: 'THES' },
  REPORT: { bibtex: 'techreport', ris: 'RPRT' },
  DATASET: { bibtex: 'misc', ris: 'DATA' },
  PREPRINT: { bibtex: 'misc', ris: 'UNPB' },
  OTHER: { bibtex: 'misc', ris: 'GEN' },
  INPROCEEDINGS: { bibtex: 'inproceedings', ris: 'CPAPER' },
  INCOLLECTION: { bibtex: 'incollection', ris: 'CHAP' },
  PHDTHESIS: { bibtex: 'phdthesis', ris: 'THES' },
  MASTERSTHESIS: { bibtex: 'mastersthesis', ris: 'THES' }
};

export function workTypeFormats(workType: any) {
  const key = String(workType || '').toUpperCase().trim();
  return WORK_TYPE_FORMATS[key] || { bibtex: 'misc', ris: 'GEN' };
}

function splitPersonName(raw: any) {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return { family: '', given: '' };
  const parts = text.split(/\s+/).filter(Boolean);
  return {
    family: parts.length ? parts[parts.length - 1] : '',
    given: parts.length > 1 ? parts.slice(0, -1).join(' ') : ''
  };
}

export function normAuthor(a: any) {
  if (!a) return null;
  if (typeof a === 'string') {
    const { family, given } = splitPersonName(a);
    return { family_name: family || null, given_names: given || null, preferred_name: a, identifiers: {}, affiliation: null };
  }
  const aff = a.affiliation && typeof a.affiliation === 'object' ? a.affiliation.name : a.affiliation || null;
  const preferred = a.preferred_name || a.full_name || a.name || null;
  const fallback = a.family_name || a.given_names ? { family: '', given: '' } : splitPersonName(preferred);
  return {
    family_name: a.family_name || fallback.family || null,
    given_names: a.given_names || fallback.given || null,
    preferred_name: preferred,
    identifiers: a.identifiers || (a.orcid ? { orcid: a.orcid } : {}),
    affiliation: aff || null
  };
}

export function normalizeValue(value: any) {
  return value ? String(value).replace(/\s+/g, ' ').trim() : '';
}

export function normalizeDoi(value: any) {
  const raw = normalizeValue(value);
  if (!raw) return '';
  return raw.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '');
}

export { SITE_ORIGIN } from './site';

export function buildAccessUrl(id: string | number | null | undefined) {
  if (id === null || id === undefined) return '';
  const value = String(id).trim();
  return value ? `${SITE_ORIGIN}/works/${encodeURIComponent(value)}` : '';
}

export function buildDoiUrl(doi: string | null | undefined) {
  const clean = normalizeDoi(doi);
  return clean ? `https://doi.org/${clean}` : '';
}

export function normalizeIssue(value: any) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return '';
  const raw = String(value).trim();
  if (!raw || raw.toLowerCase() === 'true' || raw.toLowerCase() === 'false') return '';
  return raw;
}

export function getIsbn(raw: any) {
  const direct = raw?.isbn;
  if (Array.isArray(direct)) return direct.map((item: any) => normalizeValue(item)).filter(Boolean).join(' ');
  if (direct) return normalizeValue(direct);
  const identifiers = raw?.identifiers;
  if (Array.isArray(identifiers?.isbn)) return identifiers.isbn.map((item: any) => normalizeValue(item)).filter(Boolean).join(' ');
  if (identifiers?.isbn) return normalizeValue(identifiers.isbn);
  return '';
}

export function getFilesList(raw: any) {
  const files = raw?.files;
  if (Array.isArray(files)) return files;
  if (files && typeof files === 'object') {
    if (Array.isArray(files.data)) return files.data;
    if (Array.isArray(files.items)) return files.items;
    if (Array.isArray(files.results)) return files.results;
  }
  return [];
}

export function buildFileOpenAccessUrl(file: any): string {
  if (!file) return '';
  if (file.best_oa_url) return String(file.best_oa_url);
  if (file?.best_oa?.url) return String(file.best_oa.url);
  if (file.url) return String(file.url);
  const oid = file.openacess_id || file.openaccess_id;
  if (oid && typeof oid === 'string') {
    const match = oid.trim().match(/^doi:\s*(.+)$/i);
    if (match && match[1]) return `https://doi.org/${match[1].trim()}`;
  }
  return '';
}

export function pickOpenAccessFile(files: any[]) {
  if (!Array.isArray(files) || !files.length) return null;
  const direct = files.find((file: any) => buildFileOpenAccessUrl(file));
  return direct || null;
}

export function pickLibgenFile(files: any[]) {
  if (!Array.isArray(files) || !files.length) return null;
  return files.find((file: any) => file?.libgen_id && file?.md5) || null;
}

export function pickScimagFile(files: any[]) {
  if (!Array.isArray(files) || !files.length) return null;
  return files.find((file: any) => file?.scimag_id) || null;
}

export function normWork(source: any) {
  if (!source) return null;
  const needsNormalization = (Array.isArray(source?.publications) && source.publications.length)
    || (source?.primary_publication && typeof source.primary_publication === 'object');
  const raw = needsNormalization ? normalizeWorkDetail(source) : source;
  const contributorEntries = pickContributorEntries(raw);
  const groups = contributorEntries.length ? groupContributorsByRole(contributorEntries) : [];
  const byRole = (role: string) => (groups.find((group) => group.role === role)?.contributors || []).map(normAuthor).filter(Boolean);
  const editors = byRole('EDITOR');
  const translators = byRole('TRANSLATOR');
  const reviewers = [...byRole('REVIEWER'), ...byRole('OTHER')];
  let authors = byRole('AUTHOR');
  if (!authors.length && !groups.length) {
    let names: any[] = Array.isArray(raw.authors_preview) ? raw.authors_preview : [];
    if (!names.length) {
      const authorString = (raw.authors && typeof raw.authors === 'object' && !Array.isArray(raw.authors) ? raw.authors.author_string : '')
        || raw.author_string || '';
      if (authorString) names = String(authorString).split(/[;|]/).map((part: string) => part.trim()).filter(Boolean);
    }
    if (!names.length && raw.first_author) {
      const first = raw.first_author;
      const name = typeof first === 'string' ? first : (first?.name || first?.preferred_name || '');
      if (name) names = [name];
    }
    authors = names.map(normAuthor).filter(Boolean);
  }
  const publication = raw.publication || {};
  const venue = raw.venue || {};
  const publisher = raw.publisher || {};
  const files = getFilesList(raw);
  const md5 = raw.md5 || files.map((file: any) => file?.md5 || file?.md5_hash || file?.md5sum || file?.md5Hash || file?.checksum).find(Boolean) || null;
  const isbn = getIsbn(raw);
  const oaFile = pickOpenAccessFile(files);
  const oaUrl = oaFile ? buildFileOpenAccessUrl(oaFile) : '';
  const pickId = (...keys: string[]) => {
    for (const key of keys) {
      const scalar = raw[key];
      if (scalar) return normalizeValue(Array.isArray(scalar) ? scalar.find(Boolean) : scalar);
      const fromObj = raw.identifiers?.[key];
      if (fromObj) return normalizeValue(Array.isArray(fromObj) ? fromObj.find(Boolean) : fromObj);
    }
    return null;
  };
  const identifiers = {
    pmid: pickId('pmid'),
    pmcid: pickId('pmcid'),
    arxiv: pickId('arxiv', 'arxiv_id'),
    openalex: pickId('openalex_id', 'openalex'),
    wikidata: pickId('wikidata_id', 'wikidata'),
    handle: pickId('handle'),
    openlibrary: pickId('openlibrary_id', 'openlibrary')
  };
  const subjects = Array.isArray(raw.subjects)
    ? Array.from(new Set(raw.subjects
        .map((s: any) => (typeof s === 'string' ? s : (s?.term || s?.display_name || s?.name || '')))
        .map((s: string) => String(s).trim())
        .filter(Boolean)))
    : (Array.isArray(raw.keywords)
        ? Array.from(new Set(raw.keywords.map((k: any) => String(k).trim()).filter(Boolean)))
        : []);
  return {
    id: raw.id,
    url: buildAccessUrl(raw.id),
    oa_url: oaUrl || null,
    work_type: raw.work_type || raw.type || null,
    title: raw.title || null,
    subtitle: raw.subtitle || null,
    abstract: raw.abstract || null,
    language: raw.language || null,
    doi: raw.doi || publication.doi || null,
    md5,
    isbn,
    identifiers,
    subjects,
    series: raw.series || raw.series_name || null,
    publication: {
      year: publication.year || raw.publication_year || raw.year || null,
      date: publication.publication_date || raw.publication_date || null,
      volume: publication.volume || raw.volume || null,
      issue: publication.issue || raw.issue || null,
      pages: publication.pages || raw.pages || null,
      license_url: publication.license_url || raw.license_url || null
    },
    venue: {
      id: venue.id || null,
      name: venue.name || raw.venue_name || null,
      issn: venue.issn || null,
      eissn: venue.eissn || null,
      scopus_id: venue.scopus_id || null,
      wikidata_id: venue.wikidata_id || null,
      openalex_id: venue.openalex_id || null
    },
    publisher: {
      id: publisher.id || null,
      name: publisher.name || raw.publisher_name || null,
      type: publisher.type || null,
      country: publisher.country || null,
      ror_id: publisher.ror_id || null,
      wikidata_id: publisher.wikidata_id || null,
      openalex_id: publisher.openalex_id || null,
      url: publisher.url || null
    },
    authors,
    editors,
    translators,
    reviewers
  };
}

function escBibTeX(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([{}])/g, '\\$1')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\^/g, '\\^{}')
    .replace(/~/g, '\\~{}');
}

function escBibVerbatim(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\\/g, '\\textbackslash{}').replace(/([{}])/g, '\\$1');
}

function leadContributor(nw: any) {
  const lists = [nw.authors, nw.editors, nw.translators, nw.reviewers];
  for (const list of lists) {
    if (Array.isArray(list) && list[0]) return list[0];
  }
  return null;
}

function bibKey(nw: any): string {
  const lead = leadContributor(nw);
  const first = lead ? (lead.family_name || lead.preferred_name || 'work') : 'work';
  const slug = String(first).toLowerCase().replace(/[^a-z0-9]/g, '') || 'ref';
  const year = nw.publication?.year ? String(nw.publication.year) : '';
  const idPart = nw.id !== null && nw.id !== undefined ? String(nw.id) : '';
  return [slug, year, idPart].filter(Boolean).join('-') || 'ref';
}

function bibAuthors(authors: any[]): string {
  return authors.map((a: any) => {
    const fam = a.family_name || '';
    const giv = a.given_names || '';
    const p = a.preferred_name || '';
    return fam && giv ? `${fam}, ${giv}` : (p || fam || giv);
  }).filter(Boolean).join(' and ');
}

export function toRIS(nw: any): string {
  const risType = workTypeFormats(nw.work_type).ris;
  const lines: string[] = [];
  lines.push(`TY  - ${risType}`);
  if (nw.title) lines.push(`TI  - ${nw.title}`);
  if (nw.subtitle) lines.push(`T2  - ${nw.subtitle}`);
  const risNames = (list: any) => (Array.isArray(list) ? list : []).map((a: any) => {
    const fam = a.family_name || '';
    const giv = a.given_names || '';
    const p = a.preferred_name || '';
    return fam && giv ? `${fam}, ${giv}` : (p || fam || giv);
  }).filter(Boolean);
  risNames(nw.authors).forEach((v: string) => lines.push(`AU  - ${v}`));
  risNames(nw.editors).forEach((v: string) => lines.push(`A2  - ${v}`));
  risNames(nw.translators).forEach((v: string) => lines.push(`A4  - ${v}`));
  risNames(nw.reviewers).forEach((v: string) => lines.push(`A3  - ${v}`));
  if (nw.publication?.year) lines.push(`PY  - ${nw.publication.year}`);
  if (nw.publication?.date) {
    const da = String(nw.publication.date).slice(0, 10).replace(/-/g, '/');
    if (/^\d{4}(\/\d{2}){0,2}$/.test(da)) lines.push(`DA  - ${da}`);
  }
  if (nw.venue?.name) {
    const venueTag = risType === 'JOUR' ? 'JF' : (risType === 'CPAPER' || risType === 'CHAP') ? 'BT' : 'T2';
    lines.push(`${venueTag}  - ${nw.venue.name}`);
  }
  if (nw.publisher?.name) lines.push(`PB  - ${nw.publisher.name}`);
  if (nw.publication?.volume) lines.push(`VL  - ${nw.publication.volume}`);
  const issue = normalizeIssue(nw.publication?.issue);
  if (issue) lines.push(`IS  - ${issue}`);
  if (nw.publication?.pages) {
    const parts = String(nw.publication.pages).split(/[-–—]/);
    const sp = parts[0] && parts[0].trim();
    const ep = parts[1] && parts[1].trim();
    if (sp) lines.push(`SP  - ${sp}`);
    if (ep) lines.push(`EP  - ${ep}`);
  }
  const doi = normalizeDoi(nw.doi);
  if (doi) lines.push(`DO  - ${doi}`);
  if (nw.isbn) lines.push(`SN  - ${nw.isbn}`);
  if (nw.language) lines.push(`LA  - ${nw.language}`);
  const abstract = normalizeValue(nw.abstract);
  if (abstract) lines.push(`AB  - ${abstract}`);
  const url = nw.url || buildAccessUrl(nw.id);
  if (url) lines.push(`UR  - ${url}`);
  const doiUrl = buildDoiUrl(nw.doi);
  if (doiUrl && doiUrl !== url) lines.push(`UR  - ${doiUrl}`);
  const oaUrl = nw.oa_url ? String(nw.oa_url) : '';
  if (oaUrl && oaUrl !== url && oaUrl !== doiUrl) {
    lines.push(`UR  - ${oaUrl}`);
    lines.push(`L1  - ${oaUrl}`);
  }
  const ids = nw.identifiers || {};
  if (ids.pmid) lines.push(`AN  - PMID:${ids.pmid}`);
  const seenUrls = new Set([url, doiUrl, oaUrl].filter(Boolean));
  ([['arxiv', ids.arxiv], ['openalex', ids.openalex], ['handle', ids.handle], ['pmcid', ids.pmcid], ['openlibrary', ids.openlibrary], ['wikidata', ids.wikidata]] as Array<[string, any]>)
    .forEach(([key, value]) => {
      const href = buildIdentifierHref(key, value, 'work');
      if (href && !seenUrls.has(href)) {
        seenUrls.add(href);
        lines.push(`UR  - ${href}`);
      }
    });
  if (Array.isArray(nw.subjects)) nw.subjects.forEach((subject: string) => { if (subject) lines.push(`KW  - ${subject}`); });
  lines.push('ER  - ');
  return lines.join('\n');
}

export function toBibTeX(nw: any): string {
  const bt = workTypeFormats(nw.work_type).bibtex;
  const key = bibKey(nw);
  const lines: string[] = [`@${bt}{${key},`];
  const fields: Array<[string, string, boolean]> = [];

  const pushNames = (field: string, list: any) => {
    if (!Array.isArray(list) || !list.length) return;
    const s = bibAuthors(list);
    if (s) fields.push([field, s, false]);
  };
  pushNames('author', nw.authors);
  pushNames('editor', nw.editors);
  pushNames('translator', nw.translators);
  const fullTitle = nw.subtitle ? `${nw.title || ''}: ${nw.subtitle}` : (nw.title || '');
  if (fullTitle) fields.push(['title', fullTitle, false]);
  if (nw.publication?.year) fields.push(['year', String(nw.publication.year), false]);
  if (nw.venue?.name) {
    if (bt === 'article') fields.push(['journal', nw.venue.name, false]);
    else if (bt === 'inproceedings' || bt === 'incollection') fields.push(['booktitle', nw.venue.name, false]);
  }
  if (nw.publication?.volume) fields.push(['volume', String(nw.publication.volume), false]);
  const issue = normalizeIssue(nw.publication?.issue);
  if (issue) fields.push(['number', issue, false]);
  if (nw.publication?.pages) fields.push(['pages', String(nw.publication.pages), false]);
  if (nw.publisher?.name) fields.push(['publisher', nw.publisher.name, false]);
  if (nw.series) fields.push(['series', String(nw.series), false]);
  if (nw.isbn) fields.push(['isbn', String(nw.isbn), false]);
  if (nw.language) fields.push(['language', String(nw.language), false]);
  const doi = normalizeDoi(nw.doi);
  if (doi) fields.push(['doi', doi, true]);
  const url = nw.url || buildAccessUrl(nw.id);
  if (url) fields.push(['url', url, true]);
  const oaUrl = nw.oa_url ? String(nw.oa_url) : '';
  if (oaUrl && oaUrl !== url) fields.push(['pdf_url', oaUrl, true]);
  const ids = nw.identifiers || {};
  if (ids.pmid) fields.push(['pmid', String(ids.pmid), true]);
  if (ids.arxiv) {
    fields.push(['eprint', String(ids.arxiv), true]);
    fields.push(['archivePrefix', 'arXiv', true]);
  }
  if (Array.isArray(nw.subjects) && nw.subjects.length) fields.push(['keywords', nw.subjects.join(', '), false]);
  const abstract = normalizeValue(nw.abstract);
  if (abstract) fields.push(['abstract', abstract, false]);
  if (nw.md5) fields.push(['note', `MD5: ${nw.md5}`, false]);

  fields.forEach(([k, v, verbatim]) => {
    const escaped = verbatim ? escBibVerbatim(v) : escBibTeX(v);
    lines.push(`  ${k} = {${escaped}},`);
  });
  lines.push('}');
  return lines.join('\n');
}

