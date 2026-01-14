import 'server-only';
import type { Locale } from '@/i18n/config';
import { localizedPath } from '@/i18n/paths';
import { fetchJson } from '@/lib/api';

const workIncludes = 'metrics,references,files,venue,authors';

function toStringList(raw: any): string[] {
  const list = Array.isArray(raw) ? raw : (raw || raw === 0 ? [raw] : []);
  return list.map((value: any) => {
    if (value && typeof value === 'object') {
      const picked = value?.id || value?.identifier || value?.value || value?.code;
      return picked ? String(picked).trim() : '';
    }
    return value === 0 ? '0' : (value ? String(value).trim() : '');
  }).filter((value: string) => value);
}

function uniqueList(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function splitPages(pagesRaw: any) {
  const text = pagesRaw ? String(pagesRaw).trim() : '';
  if (!text) return { first: '', last: '' };
  const parts = text.split(/[-–—]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return { first: parts[0], last: parts[parts.length - 1] };
  return { first: parts[0], last: '' };
}

function formatPublicationDate(publicationDate: any, year: any) {
  if (publicationDate) return String(publicationDate).slice(0, 10);
  if (year) return String(year);
  return '';
}

function getFilesList(work: any) {
  const files = work?.files;
  if (Array.isArray(files)) return files;
  if (files && typeof files === 'object') {
    if (Array.isArray(files.data)) return files.data;
    if (Array.isArray(files.items)) return files.items;
    if (Array.isArray(files.results)) return files.results;
  }
  return [];
}

function looksLikePdf(url: string, file: any) {
  const suffix = url.toLowerCase();
  const mime = String(file?.mime_type || file?.content_type || '').toLowerCase();
  const type = String(file?.file_type || file?.type || '').toLowerCase();
  if (mime.includes('pdf') || type.includes('pdf')) return true;
  return suffix.endsWith('.pdf') || suffix.includes('.pdf?') || suffix.includes('.pdf#');
}

function pickFulltextUrls(work: any) {
  const files = getFilesList(work);
  const urls = files.map((file: any) => ({
    url: file?.best_oa_url || file?.best_oa?.url || file?.url || file?.pdf_url || file?.file_url || file?.download_url || file?.link || '',
    file
  })).filter((entry: any) => entry.url && typeof entry.url === 'string');
  const pdf = urls.find((entry: any) => looksLikePdf(entry.url, entry.file))?.url || '';
  const fulltext = urls[0]?.url || '';
  return { pdf, fulltext };
}

function toAuthorName(author: any) {
  if (!author) return '';
  if (typeof author === 'string') return author.trim();
  return author?.preferred_name || author?.name || [author?.given_names, author?.family_name].filter(Boolean).join(' ');
}

function pickAuthorNames(authors: any[]) {
  const list = Array.isArray(authors) ? authors : [];
  const onlyAuthors = list.filter((a: any) => (a?.role || '').toString().toUpperCase() === 'AUTHOR' || !a?.role);
  const names = onlyAuthors.map(toAuthorName).filter(Boolean);
  return names.length ? names : list.map(toAuthorName).filter(Boolean);
}

function pickEditorNames(authors: any[]) {
  const list = Array.isArray(authors) ? authors : [];
  return list.filter((a: any) => (a?.role || '').toString().toUpperCase() === 'EDITOR')
    .map(toAuthorName)
    .filter(Boolean);
}

export function buildCitationMeta(work: any, locale: string, id: string) {
  const publication = work?.publication || {};
  const venue = work?.venue || {};
  const publisher = work?.publisher || {};
  const workType = work?.formatted_type || work?.work_type || work?.type;
  const isBookType = String(workType || '').toUpperCase().includes('BOOK');
  const title = work?.title || '';
  const subtitle = work?.subtitle ? String(work.subtitle) : '';
  const fullTitle = subtitle ? `${title}: ${subtitle}` : title;
  const authors = pickAuthorNames(work?.authors);
  const editors = pickEditorNames(work?.authors);
  const year = publication?.year || work?.publication_year || work?.year;
  const publicationDate = publication?.publication_date || work?.publication_date;
  const volume = publication?.volume || work?.volume;
  const issueRaw = publication?.issue || publication?.number || work?.issue || work?.number;
  const issue = typeof issueRaw === 'boolean' ? null : issueRaw;
  const pages = publication?.pages || work?.pages;
  const pageParts = splitPages(pages);
  const doi = work?.doi || publication?.doi;
  const language = work?.language;
  const venueName = venue?.name || work?.venue_name;
  const publisherName = publisher?.name || work?.publisher_name;
  const seriesName = work?.series || work?.series_title || work?.series_name;
  const issnValues = uniqueList([
    ...toStringList(venue?.issn || work?.venue_issn),
    ...toStringList(venue?.eissn || work?.venue_eissn)
  ]);
  const identifierIsbn = work?.identifiers?.isbn || work?.identifiers?.ISBN;
  const isbnValues = uniqueList([
    ...toStringList(work?.isbn),
    ...toStringList(identifierIsbn)
  ]);
  const publicationDateFormatted = formatPublicationDate(publicationDate, year);
  const publicUrl = `https://ethnos.app${localizedPath(locale as Locale, `/works/${id}`)}`;
  const { pdf, fulltext } = pickFulltextUrls(work);
  const other: Record<string, string | string[]> = {};
  if (fullTitle) other.citation_title = fullTitle;
  if (authors.length) other.citation_author = authors;
  if (editors.length) other.citation_editor = editors;
  if (publicationDateFormatted) other.citation_publication_date = publicationDateFormatted;
  if (year) other.citation_year = String(year);
  if (doi) other.citation_doi = String(doi);
  if (volume) other.citation_volume = String(volume);
  if (issue) other.citation_issue = String(issue);
  if (pageParts.first) other.citation_firstpage = pageParts.first;
  if (pageParts.last) other.citation_lastpage = pageParts.last;
  if (pages && !pageParts.first) other.citation_pages = String(pages);
  if (language) other.citation_language = String(language);
  if (venueName && !isBookType) other.citation_journal_title = String(venueName);
  if (venueName && isBookType) other.citation_book_title = String(venueName);
  if (publisherName) other.citation_publisher = String(publisherName);
  if (seriesName) other.citation_series_title = String(seriesName);
  if (isbnValues.length) other.citation_isbn = isbnValues;
  if (issnValues.length) other.citation_issn = issnValues;
  if (work?.abstract) other.citation_abstract = String(work.abstract);
  if (publicUrl) {
    other.citation_public_url = publicUrl;
    other.citation_fulltext_html_url = fulltext || publicUrl;
  }
  if (pdf) other.citation_pdf_url = pdf;
  if (fullTitle) other['dc.title'] = fullTitle;
  if (authors.length) other['dc.creator'] = authors;
  if (publicationDateFormatted) other['dc.date'] = publicationDateFormatted;
  if (doi) other['dc.identifier'] = `https://doi.org/${encodeURIComponent(String(doi))}`;
  if (publisherName) other['dc.publisher'] = String(publisherName);
  if (workType) other['dc.type'] = String(workType);
  if (language) other['dc.language'] = String(language);
  if (venueName) other['dc.source'] = String(venueName);
  return other;
}

export function buildCoins(work: any, locale: string, id: string) {
  const publication = work?.publication || {};
  const venue = work?.venue || {};
  const title = work?.title || '';
  const subtitle = work?.subtitle ? String(work.subtitle) : '';
  const fullTitle = subtitle ? `${title}: ${subtitle}` : title;
  const authors = pickAuthorNames(work?.authors);
  const year = publication?.year || work?.publication_year || work?.year;
  const publicationDate = publication?.publication_date || work?.publication_date;
  const volume = publication?.volume || work?.volume;
  const issueRaw = publication?.issue || publication?.number || work?.issue || work?.number;
  const issue = typeof issueRaw === 'boolean' ? null : issueRaw;
  const pages = publication?.pages || work?.pages;
  const pageParts = splitPages(pages);
  const doi = work?.doi || publication?.doi;
  const language = work?.language;
  const venueName = venue?.name || work?.venue_name;
  const publisherName = work?.publisher?.name || work?.publisher_name;
  const identifierIsbn = work?.identifiers?.isbn || work?.identifiers?.ISBN;
  const isbnValues = uniqueList([
    ...toStringList(work?.isbn),
    ...toStringList(identifierIsbn)
  ]);
  const issnValues = uniqueList([
    ...toStringList(venue?.issn || work?.venue_issn),
    ...toStringList(venue?.eissn || work?.venue_eissn)
  ]);
  const publicationDateFormatted = formatPublicationDate(publicationDate, year);
  const publicUrl = `https://ethnos.app${localizedPath(locale as Locale, `/works/${id}`)}`;
  const typeRaw = String(work?.work_type || work?.type || '').toLowerCase();
  const isBook = typeRaw.includes('book');
  const isChapter = typeRaw.includes('chapter');
  const params = new URLSearchParams();
  params.set('ctx_ver', 'Z39.88-2004');
  params.set('rft_val_fmt', isBook ? 'info:ofi/fmt:kev:mtx:book' : 'info:ofi/fmt:kev:mtx:journal');
  params.set('rft.genre', isChapter ? 'bookitem' : isBook ? 'book' : 'article');
  if (fullTitle) {
    if (isBook && !isChapter) params.set('rft.btitle', fullTitle);
    else params.set('rft.atitle', fullTitle);
  }
  if (venueName && isBook && isChapter) params.set('rft.btitle', String(venueName));
  if (venueName && !isBook) params.set('rft.jtitle', String(venueName));
  if (publisherName) params.set('rft.publisher', String(publisherName));
  if (publicationDateFormatted) params.set('rft.date', publicationDateFormatted);
  if (year) params.set('rft.year', String(year));
  if (volume) params.set('rft.volume', String(volume));
  if (issue) params.set('rft.issue', String(issue));
  if (pageParts.first) params.set('rft.spage', pageParts.first);
  if (pageParts.last) params.set('rft.epage', pageParts.last);
  if (pages && !pageParts.first) params.set('rft.pages', String(pages));
  if (language) params.set('rft.language', String(language));
  authors.forEach((author) => params.append('rft.au', author));
  if (doi) params.append('rft_id', `info:doi/${String(doi)}`);
  if (publicUrl) params.append('rft_id', publicUrl);
  isbnValues.forEach((isbn) => params.append('rft.isbn', isbn));
  issnValues.forEach((issn) => params.append('rft.issn', issn));
  return params.toString();
}

export function pickReferenceAuthors(item: any) {
  const arr = Array.isArray(item?.authors) ? item.authors : (Array.isArray(item?.authors_preview) ? item.authors_preview : []);
  if (arr.length) {
    const base = arr.slice(0, 2).map((a: any) => {
      if (!a) return '';
      if (typeof a === 'string') return a;
      const p = a.preferred_name || a.name;
      const given = a.given_names;
      const family = a.family_name;
      return p || [given, family].filter(Boolean).join(' ');
    }).filter(Boolean).join(', ');
    if (base && arr.length > 2 && item?.author_count && item.author_count > 2) return `${base} et al.`;
    return base;
  }
  const s = typeof item?.authors === 'string' ? item.authors : (typeof item?.authors_preview === 'string' ? item.authors_preview : (item?.formatted_authors || item?.author_string || ''));
  if (!s) return '';
  const parts = String(s).split(';').map((x) => x.trim()).filter(Boolean);
  const firstTwo = parts.slice(0, 2).join(', ');
  if (firstTwo && parts.length > 2 && item?.author_count && item.author_count > 2) return `${firstTwo} et al.`;
  return firstTwo || s;
}

export async function loadWork(id: string) {
  let envelope: any = null;
  let work: any = null;
  try {
    envelope = await fetchJson<any>(
      `/works/${encodeURIComponent(id)}?include=${encodeURIComponent(workIncludes)}`,
      { cache: 'no-store', next: { revalidate: 0 } }
    );
  } catch {}
  try { work = envelope?.data || envelope?.work || envelope || null; } catch {}
  return work;
}
