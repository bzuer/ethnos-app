import { AlignmentType, Paragraph, TextRun } from 'docx';

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

export function formatAccessLink(id: string | number | null | undefined) {
  if (id === null || id === undefined) return '';
  const value = String(id).trim();
  return value ? `ethnos.app/works/${encodeURIComponent(value)}` : '';
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

export function normWork(raw: any) {
  if (!raw) return null;
  const authors = Array.isArray(raw.authors) ? raw.authors.map(normAuthor).filter(Boolean) : [];
  const publication = raw.publication || {};
  const venue = raw.venue || {};
  const publisher = raw.publisher || {};
  const files = getFilesList(raw);
  const md5 = raw.md5 || files.map((file: any) => file?.md5 || file?.md5_hash || file?.md5sum || file?.md5Hash || file?.checksum).find(Boolean) || null;
  const isbn = getIsbn(raw);
  return {
    id: raw.id,
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

export function formatEid(id: string | number | null | undefined) {
  if (id === null || id === undefined) return '';
  const value = String(id).trim();
  return value ? `e-id ${value}` : '';
}

export function attachEid<T extends Record<string, any>>(item: T, overrideId?: string | number | null) {
  const eid = formatEid(overrideId ?? item?.id ?? null);
  if (!eid) return item;
  return { ...item, 'e-id': eid };
}

export function toRIS(nw: any): string {
  const ty = nw.work_type && String(nw.work_type).toUpperCase();
  const risType = ty === 'ARTICLE' ? 'JOUR' : ty === 'BOOK' ? 'BOOK' : ty === 'INPROCEEDINGS' ? 'CPAPER' : 'GEN';
  const lines: string[] = [];
  lines.push(`TY  - ${risType}`);
  if (nw.title) lines.push(`TI  - ${nw.title}`);
  if (Array.isArray(nw.authors)) {
    nw.authors.forEach((a: any) => {
      const fam = a.family_name || '';
      const giv = a.given_names || '';
      const p = a.preferred_name || '';
      lines.push(`AU  - ${fam && giv ? `${fam}, ${giv}` : (p || fam || giv)}`);
    });
  }
  if (nw.publication?.year) lines.push(`PY  - ${nw.publication.year}`);
  if (nw.venue?.name) lines.push(`JF  - ${nw.venue.name}`);
  if (nw.publication?.volume) lines.push(`VL  - ${nw.publication.volume}`);
  if (nw.publication?.issue) lines.push(`IS  - ${nw.publication.issue}`);
  if (nw.publication?.pages) {
    const sp = String(nw.publication.pages).split('-')[0];
    const ep = String(nw.publication.pages).split('-')[1];
    if (sp) lines.push(`SP  - ${sp}`);
    if (ep) lines.push(`EP  - ${ep}`);
  }
  const doi = normalizeDoi(nw.doi);
  if (doi) lines.push(`DO  - ${doi}`);
  if (nw.language) lines.push(`LA  - ${nw.language}`);
  const eid = formatEid(nw.id);
  if (eid) lines.push(`N1  - ${eid}`);
  lines.push('ER  - ');
  return lines.join('\n');
}

export function toBibTeX(nw: any): string {
  const ty = nw.work_type && String(nw.work_type).toLowerCase();
  const bt = ty === 'article' ? 'article' : ty === 'book' ? 'book' : 'misc';
  const keyAuthor = nw.authors && nw.authors[0] ? (nw.authors[0].family_name || nw.authors[0].preferred_name || 'work') : 'work';
  const key = `${String(keyAuthor).toLowerCase().replace(/[^a-z0-9]/g, '')}${nw.publication?.year || ''}` || 'ref';
  const lines: string[] = [];
  lines.push(`@${bt}{${key},`);
  const accessLink = formatAccessLink(nw.id);
  const doi = normalizeDoi(nw.doi);
  const annoteParts = [];
  if (accessLink) annoteParts.push(`Access: ${accessLink}`);
  if (nw.md5) {
    const abstract = normalizeValue(nw.abstract);
    const fileInfo = `File: pdf \\textbar MD5: ${nw.md5}`;
    annoteParts.push(abstract ? `${fileInfo} \\textbar Abstract: ${abstract}` : fileInfo);
  }
  const annote = annoteParts.join(' \\textbar ');
  if (Array.isArray(nw.authors)) {
    const s = nw.authors.map((a: any) => {
      const fam = a.family_name || '';
      const giv = a.given_names || '';
      const p = a.preferred_name || '';
      return fam && giv ? `${fam}, ${giv}` : p || fam || giv;
    }).filter(Boolean).join(' and ');
    if (s) lines.push(`  author = {${s}},`);
  }
  if (nw.title) lines.push(`  title = {${nw.title}},`);
  if (nw.publication?.year) lines.push(`  year = {${nw.publication.year}},`);
  if (annote) lines.push(`  annote = {${annote}},`);
  if (nw.publisher?.name) lines.push(`  publisher = {${nw.publisher.name}},`);
  if (nw.language) lines.push(`  language = {${nw.language}},`);
  if (nw.isbn) lines.push(`  isbn = {${nw.isbn}},`);
  if (nw.series) lines.push(`  series = {${nw.series}},`);
  if (nw.venue?.name && bt === 'article') lines.push(`  journal = {${nw.venue.name}},`);
  if (nw.publication?.volume) lines.push(`  volume = {${nw.publication.volume}},`);
  if (nw.publication?.issue) lines.push(`  number = {${nw.publication.issue}},`);
  if (nw.publication?.pages) lines.push(`  pages = {${nw.publication.pages}},`);
  if (doi) lines.push(`  doi = {${doi}},`);
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
  const doi = normalizeDoi(work?.doi || work?.publication?.doi);
  const accessLink = formatAccessLink(work?.id);
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
  if (doi) children.push(new TextRun({ text: ` DOI: ${doi}.` }));
  if (accessLink) children.push(new TextRun({ text: ` Access: ${accessLink}.` }));
  if (!children.length) return null;
  return new Paragraph({ children, ...(options?.spacing ? { spacing: { after: 240 } } : {}), alignment: AlignmentType.JUSTIFIED });
}
