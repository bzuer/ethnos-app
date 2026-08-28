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
  return Math.min(Math.max(parsed, min), max);
}

export async function getHomeRecentWorks(limit = 20) {
  const safeLimit = normalizeLimit(limit, 20);
  const init = { cache: 'force-cache' as RequestCache };
  try {
    const r: any = await fetchJson(`/works/showcase?limit=${encodeURIComponent(String(safeLimit))}`, init);
    const data = r?.data || r?.results || r || [];
    if (Array.isArray(data) && data.length > 0) return data;
  } catch {}
  try {
    const r: any = await fetchJson(`/works?limit=${encodeURIComponent(String(safeLimit))}`, init);
    return r?.data || r?.results || r || [];
  } catch {
    return [];
  }
}

export async function getHomeTopVenues(limit = 25, page = 1) {
  const safeLimit = normalizeLimit(limit, 100);
  const safePage = Math.max(1, Number(page) || 1);
  const init = { cache: 'force-cache' as RequestCache };
  try {
    const r: any = await fetchJson(`/venues?limit=${encodeURIComponent(String(safeLimit))}&page=${encodeURIComponent(String(safePage))}`, init);
    const data = r?.data || r?.results || r?.items || [];
    return Array.isArray(data) ? data.map(normalizeVenue) : [];
  } catch {
    return [];
  }
}

const SEARCH_FILTER_KEYS = ['type', 'work_type', 'author', 'venue', 'venue_name', 'subject', 'language', 'year_from', 'year_to', 'peer_reviewed', 'open_access', 'cited_by_min', 'cited_by_max'] as const;

export async function searchWorks(params: Record<string, string | number | boolean | undefined>) {
  const base = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && String(v) !== '') base.set(k, String(v)); });
  const qv = base.get('q') || '';
  const page = base.get('page') || '1';
  const limit = String(normalizeLimit(Number(base.get('limit') || '25'), 100));

  const qs = new URLSearchParams(base);
  qs.set('limit', limit);
  if (qs.has('work_type') && !qs.has('type')) {
    qs.set('type', String(qs.get('work_type')));
    qs.delete('work_type');
  }
  qs.delete('scope');

  const hasFilters = SEARCH_FILTER_KEYS.some((k) => qs.get(k));

  if (!qv || qv === '*') {
    if (!hasFilters) {
      const showcaseParams = [`page=${encodeURIComponent(page)}`, `limit=${encodeURIComponent(limit)}`];
      const sortBy = qs.get('sort_by');
      const sortOrder = qs.get('sort_order');
      if (sortBy) showcaseParams.push(`sort_by=${encodeURIComponent(sortBy)}`);
      if (sortOrder) showcaseParams.push(`sort_order=${encodeURIComponent(sortOrder)}`);
      return await fetchJson(
        `/works/showcase?${showcaseParams.join('&')}`,
        { retries: 1, timeoutMs: 8000 }
      );
    }
    qs.delete('q');
    return await fetchJson(`/search/works?${qs.toString()}`, { retries: 1, timeoutMs: 8000 });
  }

  try {
    return await fetchJson(`/search/works?${qs.toString()}`, { retries: 1, timeoutMs: 8000 });
  } catch (error) {
    if (hasFilters) throw error;
    return await fetchJson(
      `/works?search=${encodeURIComponent(qv)}&page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`,
      { retries: 1, timeoutMs: 8000 }
    );
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

export async function getVenuesPage(page = 1, limit = 50, opts?: VenuesListFilters) {
  const params = [
    `page=${encodeURIComponent(String(page))}`,
    `limit=${encodeURIComponent(String(limit))}`
  ];
  if (opts?.sortBy) params.push(`sortBy=${encodeURIComponent(opts.sortBy)}`);
  if (opts?.sortOrder) params.push(`sortOrder=${encodeURIComponent(opts.sortOrder)}`);
  VENUES_FILTER_PARAMS.forEach(([key, param]) => {
    const value = opts?.[key];
    if (value === undefined || value === null || value === '') return;
    if (typeof value === 'number' && !Number.isFinite(value)) return;
    params.push(`${param}=${encodeURIComponent(String(value))}`);
  });
  const r: any = await fetchJson(
    `/venues?${params.join('&')}`,
    { cache: 'force-cache' as RequestCache }
  );
  if (r && Array.isArray(r.data)) r.data = r.data.map(normalizeVenue);
  return r;
}

export type WorksListOptions = {
  sortBy?: 'cited_by_count' | string;
  sortOrder?: 'asc' | 'desc';
  citedByMin?: number;
  citedByMax?: number;
};

function worksListQuery(opts?: WorksListOptions): string {
  if (!opts) return '';
  const params: string[] = [];
  if (opts.sortBy) params.push(`sort_by=${encodeURIComponent(opts.sortBy)}`);
  if (opts.sortOrder) params.push(`sort_order=${encodeURIComponent(opts.sortOrder)}`);
  if (typeof opts.citedByMin === 'number' && Number.isFinite(opts.citedByMin)) params.push(`cited_by_min=${encodeURIComponent(String(opts.citedByMin))}`);
  if (typeof opts.citedByMax === 'number' && Number.isFinite(opts.citedByMax)) params.push(`cited_by_max=${encodeURIComponent(String(opts.citedByMax))}`);
  return params.length ? `&${params.join('&')}` : '';
}

export async function getVenueWorksPage(id: string | number, page = 1, limit = 25, opts?: WorksListOptions) {
  const r: any = await fetchJson(`/venues/${encodeURIComponent(String(id))}/works?page=${encodeURIComponent(String(page))}&limit=${encodeURIComponent(String(limit))}${worksListQuery(opts)}`);
  return r;
}

export async function getVenueWorksByOffset(id: string | number, offset: number, limit = 25, opts?: WorksListOptions) {
  const safeOffset = Math.max(0, Math.floor(offset));
  const r: any = await fetchJson(`/venues/${encodeURIComponent(String(id))}/works?offset=${encodeURIComponent(String(safeOffset))}&limit=${encodeURIComponent(String(limit))}${worksListQuery(opts)}`);
  return r;
}

export const getPersonsWorks = cache(async (personId: string | number, page = 1, limit = 25, opts?: WorksListOptions) => {
  const id = encodeURIComponent(String(personId));
  const [personResult, worksResult] = await Promise.allSettled([
    fetchJson<any>(`/persons/${id}`),
    fetchJson<any>(`/persons/${id}/works?page=${encodeURIComponent(String(page))}&limit=${encodeURIComponent(String(limit))}${worksListQuery(opts)}`)
  ]);
  if (personResult.status === 'rejected' && !isMissingEntityError(personResult.reason)) throw personResult.reason;
  const p: any = personResult.status === 'fulfilled' ? personResult.value : null;
  const personRaw = p?.data || p?.person || p || null;
  const person = personRaw ? normalizePersonDetail(personRaw) : null;
  const worksRaw: any = worksResult.status === 'fulfilled' ? worksResult.value : null;
  let works: any = worksRaw;
  if (worksRaw && typeof worksRaw === 'object') {
    const items = Array.isArray(worksRaw.data)
      ? worksRaw.data
      : (Array.isArray(worksRaw.results) ? worksRaw.results : (Array.isArray(worksRaw.items) ? worksRaw.items : null));
    if (items) {
      const normalized = dedupeByWorkId(items.map((entry: any) => normalizePersonWorkItem(entry)));
      works = { ...worksRaw };
      if (Array.isArray(worksRaw.data)) works.data = normalized;
      else if (Array.isArray(worksRaw.results)) works.results = normalized;
      else if (Array.isArray(worksRaw.items)) works.items = normalized;
    }
  }
  return { person, works };
});

function dedupeByWorkId(items: any[]): any[] {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const item of items) {
    const id = item?.id ?? item?.work_id;
    const key = id != null ? String(id) : '';
    if (!key) { out.push(item); continue; }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

async function getPersonsWorksSorted(personId: string | number, limit: number, opts: WorksListOptions) {
  const id = encodeURIComponent(String(personId));
  const fetchLimit = normalizeLimit(limit, 100);
  const qs = `limit=${encodeURIComponent(String(fetchLimit))}${worksListQuery(opts)}`;
  try {
    const raw: any = await fetchJson<any>(`/persons/${id}/works?${qs}`);
    const items = Array.isArray(raw?.data)
      ? raw.data
      : (Array.isArray(raw?.results) ? raw.results : (Array.isArray(raw?.items) ? raw.items : []));
    const normalized = items.map((entry: any) => normalizePersonWorkItem(entry));
    return dedupeByWorkId(normalized).slice(0, limit);
  } catch {
    return [];
  }
}

export async function getPersonsWorksProminent(personId: string | number, limit = 25) {
  return getPersonsWorksSorted(personId, limit, { sortBy: 'cited_by_count', sortOrder: 'desc', citedByMin: 1 });
}

export async function getPersonsWorksFirst(personId: string | number, limit = 25) {
  return getPersonsWorksSorted(personId, limit, { sortBy: 'publication_year', sortOrder: 'asc' });
}

export const getInstitution = cache(async (id: string | number) => {
  let envelope: any = null;
  try {
    envelope = await fetchJson<any>(`/institutions/${encodeURIComponent(String(id))}`);
  } catch (error) {
    if (isMissingEntityError(error)) return null;
    throw error;
  }
  const raw = unwrapData(envelope);
  return raw ? normalizeInstitution(raw) : null;
});

export async function getInstitutionWorks(id: string | number, page = 1, limit = 25, opts?: { funded?: boolean; sortBy?: string; sortOrder?: 'ASC' | 'DESC' }) {
  const segment = opts?.funded ? 'funded-works' : 'works';
  const params = [
    `page=${encodeURIComponent(String(page))}`,
    `limit=${encodeURIComponent(String(normalizeLimit(limit, 100)))}`
  ];
  if (opts?.sortBy) params.push(`sort_by=${encodeURIComponent(opts.sortBy)}`);
  if (opts?.sortOrder) params.push(`sort_order=${encodeURIComponent(opts.sortOrder)}`);
  const r: any = await fetchJson(`/institutions/${encodeURIComponent(String(id))}/${segment}?${params.join('&')}`);
  if (r && Array.isArray(r.data)) r.data = r.data.map(normalizeInstitutionWorkItem);
  return r;
}

export const getSubject = cache(async (id: string | number) => {
  let envelope: any = null;
  try {
    envelope = await fetchJson<any>(`/subjects/${encodeURIComponent(String(id))}`);
  } catch (error) {
    if (isMissingEntityError(error)) return null;
    throw error;
  }
  const raw = unwrapData(envelope);
  return raw ? normalizeSubject(raw) : null;
});

export async function getSubjectWorksPage(id: string | number, page = 1, limit = 25) {
  const params = [
    `page=${encodeURIComponent(String(page))}`,
    `limit=${encodeURIComponent(String(normalizeLimit(limit, 100)))}`
  ];
  const r: any = await fetchJson(`/subjects/${encodeURIComponent(String(id))}/works?${params.join('&')}`);
  if (r && Array.isArray(r.data)) r.data = r.data.map(normalizeSubjectWorkItem);
  return r;
}

export async function getSubjectWorksByTerm(term: string, limit = 25, opts?: WorksListOptions) {
  const clean = String(term || '').trim();
  if (!clean) return [];
  try {
    const r: any = await searchWorks({
      subject: clean,
      limit: normalizeLimit(limit, 100),
      sort_by: opts?.sortBy,
      sort_order: opts?.sortOrder,
      cited_by_min: opts?.citedByMin
    });
    const items = r?.data || r?.results || r?.items || [];
    return Array.isArray(items) ? items.slice(0, limit) : [];
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
  let envelope: any = null;
  try {
    envelope = await fetchJson<any>(`/${encoded}`);
  } catch (error) {
    if (isMissingEntityError(error)) return null;
    throw error;
  }
  return unwrapData(envelope) || null;
}

const EXPORT_PAGE_SIZE = 100;
const EXPORT_MAX_PAGES = 50;

function pickItems(raw: any): any[] {
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.results)) return raw.results;
  if (Array.isArray(raw?.items)) return raw.items;
  return [];
}

async function collectAllPages(loadPage: (page: number) => Promise<any>) {
  const pages: any[][] = [];
  let total = 0;
  let truncated = false;
  for (let page = 1; page <= EXPORT_MAX_PAGES; page += 1) {
    const raw = await loadPage(page);
    const items = pickItems(raw);
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

export async function getEntityExportWorks(kind: EntityKind, id: string | number): Promise<EntityExportWorks> {
  if (kind === 'person') {
    const safeId = encodeURIComponent(String(id));
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
    const safeId = encodeURIComponent(String(id));
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
  const items = pickItems(raw);
  const reported = Number(raw?.pagination?.total);
  return {
    works: items,
    total: Number.isFinite(reported) && reported > 0 ? reported : items.length,
    scope: { works: 'first_page', year: null, limit: EXPORT_PAGE_SIZE, truncated: items.length < (Number.isFinite(reported) ? reported : items.length) }
  };
}
