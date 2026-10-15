import { cache } from 'react';
import { fetchJson, isMissingEntityError, unwrapData } from './api';
import { normalizeVenue } from './venues';
import { normalizeInstitution, normalizeInstitutionWorkItem } from './institutions';
import { normalizeSubject, normalizeSubjectWorkItem } from './subjects';
import { normalizePersonDetail, normalizePersonWorkItem } from './works';
import { mergeWorkLists, type EntityExportWorks, type EntityKind } from './entity-export';

function normalizeLimit(limit: number, max: number, min = 1) {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(Math.max(Math.floor(parsed), min), max);
}

function listOf(envelope: any): any[] {
  return Array.isArray(envelope?.data) ? envelope.data : [];
}

export async function getHomeRecentWorks(limit = 20) {
  return listOf(await fetchJson(`/works/showcase?limit=${normalizeLimit(limit, 20)}`));
}

export async function getHomeTopVenues(limit = 15) {
  return listOf(await fetchJson(`/venues?limit=${normalizeLimit(limit, 100)}`)).map(normalizeVenue);
}

export type RecentlyAddedWork = { id: number; addedAt: Date | null };

const RECENT_WORKS_PAGE_SIZE = 100;
const RECENT_WORKS_CONCURRENCY = 4;

function readAddedAt(row: any): Date | null {
  if (!row?.added_to_database) return null;
  const date = new Date(row.added_to_database);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function listRecentlyAddedWorks(options: { limit: number; since?: Date }): Promise<RecentlyAddedWork[]> {
  const limit = Math.max(0, Math.floor(options.limit));
  const since = options.since ? options.since.getTime() : 0;
  const works: RecentlyAddedWork[] = [];
  const seen = new Set<number>();
  let nextPage = 1;
  let done = limit === 0;
  while (!done) {
    const pages = Array.from({ length: RECENT_WORKS_CONCURRENCY }, (_, offset) => nextPage + offset);
    nextPage += pages.length;
    const envelopes = await Promise.all(
      pages.map((page) =>
        fetchJson<any>(`/works?limit=${RECENT_WORKS_PAGE_SIZE}&page=${page}&sort_by=id&sort_order=DESC`, { timeoutMs: 15000 })
      )
    );
    for (const envelope of envelopes) {
      const rows = listOf(envelope);
      for (const row of rows) {
        const id = Number(row?.id);
        if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
        const addedAt = readAddedAt(row);
        if (addedAt && addedAt.getTime() < since) {
          done = true;
          break;
        }
        seen.add(id);
        works.push({ id, addedAt });
        if (works.length >= limit) {
          done = true;
          break;
        }
      }
      if (rows.length < RECENT_WORKS_PAGE_SIZE || envelope?.pagination?.hasNext === false) done = true;
      if (done) break;
    }
  }
  return works;
}

const SEARCH_FILTER_KEYS = ['type', 'author', 'venue', 'venue_name', 'subject', 'language', 'year_from', 'year_to', 'peer_reviewed', 'open_access', 'cited_by_min', 'cited_by_max'] as const;

export async function searchWorks(params: Record<string, string | number | boolean | undefined | null>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && String(v) !== '') qs.set(k, String(v)); });
  const query = qs.get('q') || '';
  const page = qs.get('page') || '1';
  const limit = String(normalizeLimit(Number(qs.get('limit') || '25'), 100));
  qs.set('limit', limit);
  const workType = qs.get('work_type');
  qs.delete('work_type');
  if (workType && !qs.has('type')) qs.set('type', workType);
  qs.delete('scope');

  const hasFilters = SEARCH_FILTER_KEYS.some((k) => qs.get(k));
  const init = { retries: 1 };

  if (!query || query === '*') {
    qs.delete('q');
    if (hasFilters) return await fetchJson(`/search/works?${qs.toString()}`, init);
    const showcase = new URLSearchParams({ page, limit });
    const sortBy = qs.get('sort_by');
    const sortOrder = qs.get('sort_order');
    if (sortBy) showcase.set('sort_by', sortBy);
    if (sortOrder) showcase.set('sort_order', sortOrder);
    return await fetchJson(`/works/showcase?${showcase.toString()}`, init);
  }

  try {
    return await fetchJson(`/search/works?${qs.toString()}`, init);
  } catch (error) {
    if (hasFilters) throw error;
    const fallback = new URLSearchParams({ search: query, page, limit });
    return await fetchJson(`/works?${fallback.toString()}`, init);
  }
}

export type VenuesListSort =
  | 'id' | 'name' | 'type'
  | 'score' | 'ranking' | 'works_count' | 'cited_by_count'
  | 'impact_factor' | 'citescore' | 'sjr' | 'snip'
  | 'h_index' | 'i10_index' | 'two_yr_mean_citedness'
  | 'overton' | 'female_share'
  | 'coverage_start_year' | 'coverage_end_year' | 'oldest' | 'newest'
  | 'created_at' | 'updated_at';
export type VenuesListSortOrder = 'ASC' | 'DESC';
export type VenuesListQuartile = 'Q1' | 'Q2' | 'Q3' | 'Q4';
export type VenuesListValidationStatus = 'PENDING' | 'VALIDATED' | 'NOT_FOUND' | 'FAILED';
export type VenuesListFilters = {
  sortBy?: VenuesListSort;
  sortOrder?: VenuesListSortOrder;
  type?: string;
  coverageFrom?: number;
  coverageTo?: number;
  activeInYear?: number;
  country?: string;
  language?: string;
  aggregationType?: string;
  publisherId?: number;
  sjrBestQuartile?: VenuesListQuartile;
  validationStatus?: VenuesListValidationStatus;
  openAccess?: boolean;
  isInDoaj?: boolean;
  isInScielo?: boolean;
  isIndexedInScopus?: boolean;
  isOaDiamond?: boolean;
  hasIssn?: boolean;
  hasIsbn13?: boolean;
  hasSummary?: boolean;
  worksMin?: number;
  worksMax?: number;
  citedByMin?: number;
  citedByMax?: number;
  impactFactorMin?: number;
  impactFactorMax?: number;
  hIndexMin?: number;
  scoreMin?: number;
};

const VENUES_FILTER_PARAMS: Array<[keyof VenuesListFilters, string]> = [
  ['sortBy', 'sort_by'],
  ['sortOrder', 'sort_order'],
  ['type', 'type'],
  ['country', 'country'],
  ['language', 'language'],
  ['aggregationType', 'aggregation_type'],
  ['sjrBestQuartile', 'sjr_best_quartile'],
  ['validationStatus', 'validation_status'],
  ['coverageFrom', 'coverage_from'],
  ['coverageTo', 'coverage_to'],
  ['activeInYear', 'active_in_year'],
  ['publisherId', 'publisher_id'],
  ['worksMin', 'works_min'],
  ['worksMax', 'works_max'],
  ['citedByMin', 'cited_by_min'],
  ['citedByMax', 'cited_by_max'],
  ['impactFactorMin', 'impact_factor_min'],
  ['impactFactorMax', 'impact_factor_max'],
  ['hIndexMin', 'h_index_min'],
  ['scoreMin', 'score_min'],
  ['openAccess', 'open_access'],
  ['isInDoaj', 'is_in_doaj'],
  ['isInScielo', 'is_in_scielo'],
  ['isIndexedInScopus', 'is_indexed_in_scopus'],
  ['isOaDiamond', 'is_oa_diamond'],
  ['hasIssn', 'has_issn'],
  ['hasIsbn13', 'has_isbn13'],
  ['hasSummary', 'has_summary']
];

export async function getVenuesPage(page = 1, limit = 25, opts?: VenuesListFilters) {
  const params = new URLSearchParams({
    page: String(normalizeLimit(page, Number.MAX_SAFE_INTEGER)),
    limit: String(normalizeLimit(limit, 100))
  });
  VENUES_FILTER_PARAMS.forEach(([key, param]) => {
    const value = opts?.[key];
    if (value === undefined || value === null || value === '') return;
    if (typeof value === 'number' && !Number.isFinite(value)) return;
    params.set(param, String(value));
  });
  const r: any = await fetchJson(`/venues?${params.toString()}`);
  return { ...r, data: listOf(r).map(normalizeVenue) };
}

export const getVenue = cache(async (id: string) => {
  try {
    const venue = unwrapData(await fetchJson(`/venues/${encodeURIComponent(id)}`));
    return venue ? normalizeVenue(venue) : null;
  } catch (error) {
    if (isMissingEntityError(error)) return null;
    throw error;
  }
});

export type WorksListOptions = {
  sortBy?: 'cited_by_count' | 'publication_year';
  sortOrder?: 'asc' | 'desc';
  citedByMin?: number;
};

function worksListQuery(opts?: WorksListOptions): string {
  if (!opts) return '';
  const params = new URLSearchParams();
  if (opts.sortBy) params.set('sort_by', opts.sortBy);
  if (opts.sortOrder) params.set('sort_order', opts.sortOrder);
  if (typeof opts.citedByMin === 'number' && Number.isFinite(opts.citedByMin)) params.set('cited_by_min', String(opts.citedByMin));
  const serialized = params.toString();
  return serialized ? `&${serialized}` : '';
}

export const getVenueWorksPage = cache(async (id: string, page = 1, limit = 25, opts?: WorksListOptions) => {
  return await fetchJson<any>(`/venues/${encodeURIComponent(id)}/works?page=${page}&limit=${normalizeLimit(limit, 100)}${worksListQuery(opts)}`);
});

function dedupeByWorkId(items: any[]): any[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item?.id != null ? String(item.id) : '';
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const getPersonsWorks = cache(async (personId: string, page = 1, limit = 25) => {
  const id = encodeURIComponent(personId);
  const [personResult, worksResult] = await Promise.allSettled([
    fetchJson<any>(`/persons/${id}`),
    fetchJson<any>(`/persons/${id}/works?page=${page}&limit=${normalizeLimit(limit, 100)}`)
  ]);
  if (personResult.status === 'rejected' && !isMissingEntityError(personResult.reason)) throw personResult.reason;
  const raw = personResult.status === 'fulfilled' ? unwrapData(personResult.value) : null;
  const person = raw ? normalizePersonDetail(raw) : null;
  const envelope: any = worksResult.status === 'fulfilled' ? worksResult.value : null;
  return {
    person,
    works: dedupeByWorkId(listOf(envelope).map(normalizePersonWorkItem)),
    pagination: envelope?.pagination ?? null
  };
});

async function getPersonsWorksSorted(personId: string, limit: number, opts: WorksListOptions) {
  const id = encodeURIComponent(personId);
  try {
    const envelope = await fetchJson<any>(`/persons/${id}/works?limit=${normalizeLimit(limit, 100)}${worksListQuery(opts)}`);
    return dedupeByWorkId(listOf(envelope).map(normalizePersonWorkItem));
  } catch {
    return [];
  }
}

export async function getPersonsWorksProminent(personId: string, limit = 25) {
  return getPersonsWorksSorted(personId, limit, { sortBy: 'cited_by_count', sortOrder: 'desc', citedByMin: 1 });
}

export async function getPersonsWorksFirst(personId: string, limit = 25) {
  return getPersonsWorksSorted(personId, limit, { sortBy: 'publication_year', sortOrder: 'asc' });
}

export const getInstitution = cache(async (id: string) => {
  try {
    const raw = unwrapData(await fetchJson<any>(`/institutions/${encodeURIComponent(id)}`));
    return raw ? normalizeInstitution(raw) : null;
  } catch (error) {
    if (isMissingEntityError(error)) return null;
    throw error;
  }
});

export async function getInstitutionWorks(id: string, page = 1, limit = 25, opts?: { funded?: boolean; sortBy?: string; sortOrder?: 'ASC' | 'DESC' }) {
  const segment = opts?.funded ? 'funded-works' : 'works';
  const params = new URLSearchParams({ page: String(page), limit: String(normalizeLimit(limit, 100)) });
  if (opts?.sortBy) params.set('sort_by', opts.sortBy);
  if (opts?.sortOrder) params.set('sort_order', opts.sortOrder);
  const r: any = await fetchJson(`/institutions/${encodeURIComponent(id)}/${segment}?${params.toString()}`);
  return { ...r, data: listOf(r).map(normalizeInstitutionWorkItem) };
}

export const getSubject = cache(async (id: string) => {
  try {
    const raw = unwrapData(await fetchJson<any>(`/subjects/${encodeURIComponent(id)}`));
    return raw ? normalizeSubject(raw) : null;
  } catch (error) {
    if (isMissingEntityError(error)) return null;
    throw error;
  }
});

export async function getSubjectWorksPage(id: string, page = 1, limit = 25) {
  const r: any = await fetchJson(`/subjects/${encodeURIComponent(id)}/works?page=${page}&limit=${normalizeLimit(limit, 100)}`);
  return { ...r, data: listOf(r).map(normalizeSubjectWorkItem) };
}

export async function getSubjectWorksByTerm(term: string, limit = 25, opts?: WorksListOptions) {
  const clean = String(term || '').trim();
  if (!clean) return [];
  try {
    return listOf(await searchWorks({
      subject: clean,
      limit: normalizeLimit(limit, 100),
      sort_by: opts?.sortBy,
      sort_order: opts?.sortOrder,
      cited_by_min: opts?.citedByMin
    }));
  } catch {
    return [];
  }
}

export async function resolveDoi(doi: string) {
  const clean = String(doi || '').trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '');
  if (!clean || !clean.includes('/')) return null;
  const encoded = clean.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  try {
    return unwrapData(await fetchJson<any>(`/${encoded}`));
  } catch (error) {
    if (isMissingEntityError(error)) return null;
    throw error;
  }
}

const EXPORT_PAGE_SIZE = 100;
const EXPORT_MAX_PAGES = 50;

async function collectAllPages(loadPage: (page: number) => Promise<any>) {
  const pages: any[][] = [];
  let total = 0;
  let truncated = false;
  for (let page = 1; page <= EXPORT_MAX_PAGES; page += 1) {
    const raw = await loadPage(page);
    const items = listOf(raw);
    const pagination = raw?.pagination || {};
    const reported = Number(pagination.total);
    if (Number.isFinite(reported) && reported > 0) total = reported;
    if (items.length) pages.push(items);
    const totalPages = Number(pagination.totalPages);
    const hasNext = pagination.hasNext === true || (Number.isFinite(totalPages) && totalPages > page);
    if (!items.length || !hasNext) break;
    if (page === EXPORT_MAX_PAGES) truncated = true;
  }
  const works = mergeWorkLists(...pages);
  return { works, total: total || works.length, truncated };
}

export async function getEntityExportWorks(kind: EntityKind, id: string): Promise<EntityExportWorks> {
  const safeId = encodeURIComponent(id);
  if (kind === 'person') {
    const collected = await collectAllPages((page) => fetchJson<any>(
      `/persons/${safeId}/works?page=${page}&limit=${EXPORT_PAGE_SIZE}`
    ));
    return {
      works: collected.works.map(normalizePersonWorkItem),
      total: collected.total,
      scope: { works: 'all', year: null, limit: null, truncated: collected.truncated }
    };
  }

  if (kind === 'venue') {
    const year = new Date().getFullYear();
    const collected = await collectAllPages((page) => fetchJson<any>(
      `/venues/${safeId}/works?page=${page}&limit=${EXPORT_PAGE_SIZE}&year=${year}`
    ));
    return {
      works: collected.works,
      total: collected.total,
      scope: { works: 'current_year', year, limit: null, truncated: collected.truncated }
    };
  }

  const raw = kind === 'institution'
    ? await getInstitutionWorks(id, 1, EXPORT_PAGE_SIZE)
    : await getSubjectWorksPage(id, 1, EXPORT_PAGE_SIZE);
  const items = listOf(raw);
  const reported = Number(raw?.pagination?.total);
  const total = Number.isFinite(reported) && reported > 0 ? reported : items.length;
  return {
    works: items,
    total,
    scope: { works: 'first_page', year: null, limit: EXPORT_PAGE_SIZE, truncated: items.length < total }
  };
}

export async function getEntityRecord(kind: EntityKind, id: string) {
  if (kind === 'venue') return getVenue(id);
  if (kind === 'institution') return getInstitution(id);
  if (kind === 'subject') return getSubject(id);
  const raw = unwrapData(await fetchJson<any>(`/persons/${encodeURIComponent(id)}`));
  return raw ? normalizePersonDetail(raw) : null;
}

export const loadWork = cache(async (id: string) => {
  const safeId = encodeURIComponent(id);
  const [workResult, metricsResult] = await Promise.allSettled([
    fetchJson<any>(`/works/${safeId}?include_citations=true&include_references=true`),
    fetchJson<any>(`/works/${safeId}/metrics`)
  ]);
  if (workResult.status === 'rejected') {
    if (isMissingEntityError(workResult.reason)) return null;
    throw workResult.reason;
  }
  const work = unwrapData(workResult.value);
  if (!work) return null;
  const metrics = metricsResult.status === 'fulfilled' ? unwrapData(metricsResult.value) : null;
  return metrics ? { ...work, authoritative_metrics: metrics } : work;
});
