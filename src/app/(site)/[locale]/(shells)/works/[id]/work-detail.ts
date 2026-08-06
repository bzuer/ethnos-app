import 'server-only';
import { cache } from 'react';
import type { Locale } from '@/i18n/config';
import { localizedPath } from '@/i18n/paths';
import { fetchJson, isNotFoundError } from '@/lib/api';
import {
  formatContributorName,
  formatMetadataAuthors,
  groupContributorsByRole,
  normalizeWorkDetail,
  pickPrimaryContributors,
  sanitizeWorkAbstract,
  type ContributorRole
} from '@/lib/works';

const workDetailQuery = 'include_citations=true&include_references=true';

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

function pickIssueValue(...values: any[]) {
  return values.find((value) => value !== undefined && value !== null && value !== '' && typeof value !== 'boolean') ?? null;
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

function fileOaUrl(file: any): string {
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

function pickBestOaUrl(work: any) {
  const files = getFilesList(work);
  const best = files.find((file: any) => fileOaUrl(file));
  return best ? fileOaUrl(best) : '';
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
    url: fileOaUrl(file) || file?.pdf_url || file?.file_url || file?.download_url || file?.link || '',
    file
  })).filter((entry: any) => entry.url && typeof entry.url === 'string');
  const pdf = urls.find((entry: any) => looksLikePdf(entry.url, entry.file))?.url || '';
  const fulltext = urls[0]?.url || '';
  return { pdf, fulltext };
}

function normalizeAuthorKey(name: string) {
  const parts = name.split(/\s+/).map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return '';
  const last = parts[parts.length - 1].replace(/[^a-zA-Z]/g, '').toLowerCase();
  const first = parts[0].replace(/[^a-zA-Z]/g, '').toLowerCase();
  if (!last) return '';
  const initial = first ? first[0] : '';
  return `${last}-${initial}`;
}

function uniqueAuthorNames(names: string[]) {
  const byKey = new Map<string, string>();
  const extras: string[] = [];
  names.forEach((name) => {
    const key = normalizeAuthorKey(name);
    if (!key) {
      extras.push(name);
      return;
    }
    const existing = byKey.get(key);
    if (!existing || name.length > existing.length) byKey.set(key, name);
  });
  return [...byKey.values(), ...extras];
}

function pickAuthorNames(authors: any[]) {
  return uniqueAuthorNames(pickPrimaryContributors(authors).map(formatContributorName).filter(Boolean));
}

function pickRoleNames(authors: any[], ...roles: ContributorRole[]) {
  const groups = groupContributorsByRole(authors);
  const names = roles.flatMap((role) => (groups.find((group) => group.role === role)?.contributors || []).map(formatContributorName));
  return uniqueAuthorNames(names.filter(Boolean));
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
  const editors = pickRoleNames(work?.authors, 'EDITOR');
  const translators = pickRoleNames(work?.authors, 'TRANSLATOR');
  const otherContributors = pickRoleNames(work?.authors, 'REVIEWER', 'OTHER');
  const year = publication?.year || work?.publication_year || work?.year;
  const publicationDate = publication?.publication_date || work?.publication_date;
  const volume = publication?.volume || work?.volume;
  const issue = pickIssueValue(publication?.issue, publication?.number, work?.issue, work?.number);
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
  const bestOaUrl = pickBestOaUrl(work);
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
  const cleanedAbstract = sanitizeWorkAbstract(work?.abstract);
  if (cleanedAbstract) other.citation_abstract = cleanedAbstract;
  if (publicUrl) {
    other.citation_public_url = publicUrl;
    if (cleanedAbstract) other.citation_abstract_html_url = publicUrl;
  }
  if (bestOaUrl || pdf) {
    other.citation_pdf_url = bestOaUrl || pdf;
    other.citation_fulltext_html_url = bestOaUrl || pdf;
  }
  if (fullTitle) other['dc.title'] = fullTitle;
  if (authors.length) other['dc.creator'] = authors;
  const dcContributors = [...editors, ...translators, ...otherContributors];
  if (dcContributors.length) other['dc.contributor'] = uniqueList(dcContributors);
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
  const issue = pickIssueValue(publication?.issue, publication?.number, work?.issue, work?.number);
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
  return formatMetadataAuthors(item);
}

export const loadWork = cache(async (id: string) => {
  const safeId = encodeURIComponent(id);
  const [workResult, metricsResult] = await Promise.allSettled([
    fetchJson<any>(`/works/${safeId}?${workDetailQuery}`),
    fetchJson<any>(`/works/${safeId}/metrics`)
  ]);
  if (workResult.status === 'rejected') {
    if (isNotFoundError(workResult.reason)) return null;
    throw workResult.reason;
  }
  const envelope: any = workResult.value;
  const raw = envelope?.data || envelope?.work || envelope || null;
  if (!raw) return null;
  const work = normalizeWorkDetail(raw);
  if (work && typeof work === 'object' && metricsResult.status === 'fulfilled') {
    const md: any = metricsResult.value?.data || metricsResult.value || null;
    if (md && typeof md === 'object') (work as any).authoritative_metrics = md;
  }
  return work;
});
