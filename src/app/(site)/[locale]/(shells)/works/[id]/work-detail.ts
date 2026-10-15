import 'server-only';
import type { Locale } from '@/i18n/config';
import { localeUrl } from '@/lib/site';
import { buildFileOpenAccessUrl, pickOpenAccessFile } from '@/lib/work-export';
import {
  formatContributorName,
  groupContributorsByRole,
  pickContributorEntries,
  pickPrimaryContributors,
  sanitizeWorkAbstract,
  workDoi,
  type ContributorRole
} from '@/lib/works';

export type WorkKind = 'book' | 'chapter' | 'article';

export function workKind(type: any): WorkKind {
  const value = String(type || '').toUpperCase();
  if (value === 'BOOK') return 'book';
  if (value === 'CHAPTER') return 'chapter';
  return 'article';
}

export function splitPages(pagesRaw: any) {
  const text = pagesRaw ? String(pagesRaw).trim() : '';
  if (!text) return { first: '', last: '' };
  const parts = text.split(/[-–—]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return { first: parts[0], last: parts[parts.length - 1] };
  return { first: parts[0], last: '' };
}

export function formatPublicationDate(publicationDate: any, year: any) {
  if (publicationDate) return String(publicationDate).slice(0, 10);
  if (year) return String(year);
  return '';
}

function uniqueList(items: any[]) {
  return Array.from(new Set(items.map((item) => (item ? String(item).trim() : '')).filter(Boolean)));
}

function pickRoleNames(entries: any[], ...roles: ContributorRole[]) {
  const groups = groupContributorsByRole(entries);
  return roles.flatMap((role) => (groups.find((group) => group.role === role)?.contributors || []).map(formatContributorName)).filter(Boolean);
}

function describeWork(work: any, locale: string, id: string) {
  const publication = work?.primary_publication || {};
  const venue = work?.venue || {};
  const title = work?.title || '';
  const fullTitle = work?.subtitle ? `${title}: ${work.subtitle}` : title;
  const year = work?.publication_year;
  const pages = publication.pages;
  return {
    kind: workKind(work?.type),
    fullTitle,
    authors: pickPrimaryContributors(pickContributorEntries(work)).map(formatContributorName).filter(Boolean),
    year,
    date: formatPublicationDate(publication.publication_date, year),
    volume: publication.volume,
    issue: publication.issue,
    pages,
    pageParts: splitPages(pages),
    doi: workDoi(work),
    language: work?.language,
    venueName: venue.name,
    publisherName: publication.publisher?.name,
    isbnValues: uniqueList(Array.isArray(work?.identifiers?.isbn) ? work.identifiers.isbn : []),
    issnValues: uniqueList([venue.issn, venue.eissn]),
    publicUrl: localeUrl(locale as Locale, `/works/${id}`)
  };
}

export function buildCitationMeta(work: any, locale: string, id: string) {
  const d = describeWork(work, locale, id);
  const entries = pickContributorEntries(work);
  const editors = pickRoleNames(entries, 'EDITOR');
  const translators = pickRoleNames(entries, 'TRANSLATOR');
  const otherContributors = pickRoleNames(entries, 'REVIEWER', 'OTHER');
  const bestOaUrl = buildFileOpenAccessUrl(pickOpenAccessFile(Array.isArray(work?.files) ? work.files : []));
  const cleanedAbstract = sanitizeWorkAbstract(work?.abstract);
  const other: Record<string, string | string[]> = {};
  if (d.fullTitle) other.citation_title = d.fullTitle;
  if (d.authors.length) other.citation_author = d.authors;
  if (editors.length) other.citation_editor = editors;
  if (d.date) other.citation_publication_date = d.date;
  if (d.year) other.citation_year = String(d.year);
  if (d.doi) other.citation_doi = String(d.doi);
  if (d.volume) other.citation_volume = String(d.volume);
  if (d.issue) other.citation_issue = String(d.issue);
  if (d.pageParts.first) other.citation_firstpage = d.pageParts.first;
  if (d.pageParts.last) other.citation_lastpage = d.pageParts.last;
  if (d.language) other.citation_language = String(d.language);
  if (d.venueName && d.kind === 'article') other.citation_journal_title = String(d.venueName);
  if (d.venueName && d.kind === 'chapter') other.citation_inbook_title = String(d.venueName);
  if (d.publisherName) other.citation_publisher = String(d.publisherName);
  if (d.isbnValues.length) other.citation_isbn = d.isbnValues;
  if (d.issnValues.length) other.citation_issn = d.issnValues;
  if (cleanedAbstract) other.citation_abstract = cleanedAbstract;
  other.citation_public_url = d.publicUrl;
  if (cleanedAbstract) other.citation_abstract_html_url = d.publicUrl;
  if (bestOaUrl) {
    other.citation_pdf_url = bestOaUrl;
    other.citation_fulltext_html_url = bestOaUrl;
  }
  if (d.fullTitle) other['dc.title'] = d.fullTitle;
  if (d.authors.length) other['dc.creator'] = d.authors;
  const dcContributors = uniqueList([...editors, ...translators, ...otherContributors]);
  if (dcContributors.length) other['dc.contributor'] = dcContributors;
  if (d.date) other['dc.date'] = d.date;
  if (d.doi) other['dc.identifier'] = `https://doi.org/${encodeURIComponent(String(d.doi))}`;
  if (d.publisherName) other['dc.publisher'] = String(d.publisherName);
  if (work?.type) other['dc.type'] = String(work.type);
  if (d.language) other['dc.language'] = String(d.language);
  if (d.venueName) other['dc.source'] = String(d.venueName);
  return other;
}

export function buildCoins(work: any, locale: string, id: string) {
  const d = describeWork(work, locale, id);
  const params = new URLSearchParams();
  params.set('ctx_ver', 'Z39.88-2004');
  params.set('rft_val_fmt', d.kind === 'article' ? 'info:ofi/fmt:kev:mtx:journal' : 'info:ofi/fmt:kev:mtx:book');
  params.set('rft.genre', d.kind === 'chapter' ? 'bookitem' : d.kind === 'book' ? 'book' : 'article');
  if (d.fullTitle) params.set(d.kind === 'book' ? 'rft.btitle' : 'rft.atitle', d.fullTitle);
  if (d.venueName && d.kind === 'chapter') params.set('rft.btitle', String(d.venueName));
  if (d.venueName && d.kind === 'article') params.set('rft.jtitle', String(d.venueName));
  if (d.publisherName) params.set('rft.publisher', String(d.publisherName));
  if (d.date) params.set('rft.date', d.date);
  if (d.year) params.set('rft.year', String(d.year));
  if (d.volume) params.set('rft.volume', String(d.volume));
  if (d.issue) params.set('rft.issue', String(d.issue));
  if (d.pageParts.first) params.set('rft.spage', d.pageParts.first);
  if (d.pageParts.last) params.set('rft.epage', d.pageParts.last);
  if (d.language) params.set('rft.language', String(d.language));
  d.authors.forEach((author) => params.append('rft.au', author));
  if (d.doi) params.append('rft_id', `info:doi/${String(d.doi)}`);
  params.append('rft_id', d.publicUrl);
  d.isbnValues.forEach((isbn) => params.append('rft.isbn', isbn));
  d.issnValues.forEach((issn) => params.append('rft.issn', issn));
  return params.toString();
}
