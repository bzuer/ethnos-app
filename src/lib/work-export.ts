import { AlignmentType, Paragraph, TextRun } from 'docx';
import { normalizeWorkDetail } from './works';

export function normAuthor(a: any) {
  if (!a) return null;
  if (typeof a === 'string') {
    const parts = a.trim().split(/\s+/);
    const family = parts.length ? parts[parts.length - 1] : '';
    const given = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
    return { family_name: family || null, given_names: given || null, preferred_name: a, identifiers: {}, affiliation: null };
  }
  const aff = a.affiliation && typeof a.affiliation === 'object' ? a.affiliation.name : a.affiliation || null;
  return { family_name: a.family_name || null, given_names: a.given_names || null, preferred_name: a.preferred_name || a.full_name || a.name || null, identifiers: a.identifiers || (a.orcid ? { orcid: a.orcid } : {}), affiliation: aff || null };
}

export function normalizeValue(value: any) {
  return value ? String(value).replace(/\s+/g, ' ').trim() : '';
}

export function normalizeDoi(value: any) {
  const raw = normalizeValue(value);
  if (!raw) return '';
  return raw.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '');
}

export function buildAccessUrl(id: string | number | null | undefined) {
  if (id === null || id === undefined) return '';
  const value = String(id).trim();
  return value ? `https://ethnos.app/works/${encodeURIComponent(value)}` : '';
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
  const authors = Array.isArray(raw.authors) ? raw.authors.map(normAuthor).filter(Boolean) : [];
  const publication = raw.publication || {};
  const venue = raw.venue || {};
  const publisher = raw.publisher || {};
  const files = getFilesList(raw);
  const md5 = raw.md5 || files.map((file: any) => file?.md5 || file?.md5_hash || file?.md5sum || file?.md5Hash || file?.checksum).find(Boolean) || null;
  const isbn = getIsbn(raw);
  const oaFile = pickOpenAccessFile(files);
  const oaUrl = oaFile ? buildFileOpenAccessUrl(oaFile) : '';
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
    series: raw.series || raw.series_name || raw.series_title || raw.series_title_name || raw.series_title_value || raw.series_title_text || null,
    publication: {
      year: publication.year || raw.publication_year || raw.year || null,
      volume: publication.volume || raw.volume || null,
      issue: publication.issue || raw.issue || null,
      pages: publication.pages || raw.pages || null
    },
    venue: {
      id: venue.id || null,
      name: venue.name || raw.venue_name || null,
      issn: venue.issn || null,
      eissn: venue.eissn || null,
      scopus_id: venue.scopus_id || null,
      wikidata_id: venue.wikidata_id || null,
      openalex_id: venue.openalex_id || null,
      mag_id: venue.mag_id || null
    },
    publisher: {
      id: publisher.id || null,
      name: publisher.name || raw.publisher_name || null,
      type: publisher.type || null,
      country: publisher.country || null,
      ror_id: publisher.ror_id || null,
      wikidata_id: publisher.wikidata_id || null,
      openalex_id: publisher.openalex_id || null,
      mag_id: publisher.mag_id || null,
      url: publisher.url || null
    },
    authors
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

function bibKey(nw: any): string {
  const first = Array.isArray(nw.authors) && nw.authors[0]
    ? (nw.authors[0].family_name || nw.authors[0].preferred_name || 'work')
    : 'work';
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
  const ty = nw.work_type && String(nw.work_type).toUpperCase();
  const risType = ty === 'ARTICLE' ? 'JOUR' : ty === 'BOOK' ? 'BOOK' : ty === 'INPROCEEDINGS' ? 'CPAPER' : 'GEN';
  const lines: string[] = [];
  lines.push(`TY  - ${risType}`);
  if (nw.title) lines.push(`TI  - ${nw.title}`);
  if (nw.subtitle) lines.push(`T2  - ${nw.subtitle}`);
  if (Array.isArray(nw.authors)) {
    nw.authors.forEach((a: any) => {
      const fam = a.family_name || '';
      const giv = a.given_names || '';
      const p = a.preferred_name || '';
      const v = fam && giv ? `${fam}, ${giv}` : (p || fam || giv);
      if (v) lines.push(`AU  - ${v}`);
    });
  }
  if (nw.publication?.year) lines.push(`PY  - ${nw.publication.year}`);
  if (nw.venue?.name) {
    const venueTag = risType === 'JOUR' ? 'JF' : risType === 'CPAPER' ? 'BT' : 'T2';
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
  lines.push('ER  - ');
  return lines.join('\n');
}

export function toBibTeX(nw: any): string {
  const ty = nw.work_type && String(nw.work_type).toLowerCase();
  const bt = ty === 'article' ? 'article'
    : ty === 'book' ? 'book'
    : ty === 'inproceedings' ? 'inproceedings'
    : ty === 'incollection' ? 'incollection'
    : ty === 'phdthesis' ? 'phdthesis'
    : ty === 'mastersthesis' ? 'mastersthesis'
    : 'misc';
  const key = bibKey(nw);
  const lines: string[] = [`@${bt}{${key},`];
  const fields: Array<[string, string, boolean]> = [];

  if (Array.isArray(nw.authors) && nw.authors.length) {
    const s = bibAuthors(nw.authors);
    if (s) fields.push(['author', s, false]);
  }
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

export function toApaParagraph(work: any, fallbackAuthor: string, options?: { spacing?: boolean }) {
  const typeRaw = (work?.work_type || work?.type || '').toString().toLowerCase();
  const isBook = typeRaw === 'book';
  const isArticle = typeRaw === 'article' || typeRaw === 'journal';
  const authors = Array.isArray(work?.authors) ? work.authors.map((item: any) => {
    if (!item) return '';
    if (typeof item === 'string') return item;
    const family = item?.family_name || item?.name || '';
    const given = item?.given_names || '';
    const initials = given
      ? given.split(/\s+/).filter(Boolean).map((part: string) => part.charAt(0).toUpperCase() + '.').join(' ')
      : '';
    const name = family ? `${family}${initials ? `, ${initials}` : ''}` : (item?.preferred_name || '');
    return name;
  }).filter(Boolean) : [];
  let authorText = '';
  if (authors.length === 1) authorText = authors[0];
  else if (authors.length === 2) authorText = `${authors[0]} & ${authors[1]}`;
  else if (authors.length > 2) authorText = `${authors.slice(0, -1).join(', ')}, & ${authors[authors.length - 1]}`;
  if (!authorText) authorText = fallbackAuthor;
  const year = work?.publication?.year || work?.publication_year || work?.year || '';
  const title = work?.title || '';
  const subtitle = work?.subtitle || '';
  const titleText = title ? `${title}${subtitle ? `: ${subtitle}` : ''}` : '';
  const venue = work?.venue?.name || work?.venue_name || '';
  const volume = work?.publication?.volume || '';
  const issue = normalizeIssue(work?.publication?.issue || '');
  const pages = work?.publication?.pages || '';
  const publisher = work?.publisher?.name || work?.publisher_name || '';
  const isbn = work?.isbn || '';
  const doiUrl = buildDoiUrl(work?.doi || work?.publication?.doi);
  const accessUrl = work?.url || buildAccessUrl(work?.id);
  const children: TextRun[] = [];
  if (authorText) children.push(new TextRun({ text: authorText }));
  if (year) children.push(new TextRun({ text: ` (${year}).` }));
  if (titleText) children.push(new TextRun({ text: ` ${titleText}.`, italics: isBook }));
  if (isArticle && venue) {
    children.push(new TextRun({ text: ` ${venue}`, italics: true }));
    if (volume) children.push(new TextRun({ text: `, ${volume}`, italics: true }));
    if (issue) children.push(new TextRun({ text: `(${issue})` }));
    if (pages) children.push(new TextRun({ text: `, ${pages}` }));
    children.push(new TextRun({ text: '.' }));
  } else {
    if (venue) children.push(new TextRun({ text: ` ${venue}.`, italics: true }));
    if (publisher) children.push(new TextRun({ text: ` ${publisher}.` }));
    if (volume || issue || pages) {
      const volIssue = `${volume ? ` ${volume}` : ''}${issue ? `(${issue})` : ''}`;
      if (volIssue.trim()) children.push(new TextRun({ text: volIssue, italics: true }));
      if (pages) children.push(new TextRun({ text: `${volIssue.trim() ? ', ' : ' '}${pages}.` }));
      else if (volIssue.trim()) children.push(new TextRun({ text: '.' }));
    }
  }
  if (isbn) children.push(new TextRun({ text: ` ISBN: ${isbn}.` }));
  const oaUrl = work?.oa_url ? String(work.oa_url) : '';
  if (doiUrl) children.push(new TextRun({ text: ` ${doiUrl}` }));
  else if (accessUrl) children.push(new TextRun({ text: ` ${accessUrl}` }));
  if (oaUrl && oaUrl !== doiUrl && oaUrl !== accessUrl) children.push(new TextRun({ text: ` ${oaUrl}` }));
  if (!children.length) return null;
  return new Paragraph({ children, ...(options?.spacing ? { spacing: { after: 240 } } : {}), alignment: AlignmentType.JUSTIFIED });
}
