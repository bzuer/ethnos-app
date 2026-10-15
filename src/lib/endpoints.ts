import { cache } from 'react';
import { fetchJson, isMissingEntityError, unwrapData } from './api';
import { VENUES_MAX_PAGE, VENUES_PAGE_SIZE, normalizeVenue } from './venues';
import { normalizeInstitution } from './institutions';
import { normalizeSubjectWorkItem } from './subjects';
import { normalizePersonWorkItem } from './works';
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
  return listOf(await fetchJson(`/venues?limit=${normalizeLimit(limit, 100)}`));
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

const SEARCH_PARAMS = ['q', 'author', 'venue', 'subject', 'work_type', 'language', 'year_from', 'year_to', 'open_access', 'cited_by_min', 'cited_by_max', 'sort_by', 'sort_order'] as const;

export async function searchWorks(params: Record<string, string | number | undefined | null>) {
  const qs = new URLSearchParams();
  SEARCH_PARAMS.forEach((key) => {
    const value = String(params[key] ?? '').trim();
    if (value) qs.set(key, value);
  });
  qs.set('page', String(normalizeLimit(Number(params.page) || 1, Number.MAX_SAFE_INTEGER)));
  qs.set('limit', String(normalizeLimit(Number(params.limit) || 20, 100)));
  return await fetchJson<any>(`/works?${qs.toString()}`, { attempts: 1 });
}

export type VenuesListFilters = {
  sortBy?: 'cited_by_count' | 'newest' | 'oldest';
  type?: 'JOURNAL';
};

export async function getVenuesPage(page = 1, filters: VenuesListFilters = {}) {
  const params = new URLSearchParams({
    page: String(normalizeLimit(page, VENUES_MAX_PAGE)),
    limit: String(VENUES_PAGE_SIZE)
  });
  if (filters.sortBy) params.set('sort_by', filters.sortBy);
  if (filters.type) params.set('type', filters.type);
  const r: any = await fetchJson(`/venues?${params.toString()}`);
  return { ...r, data: listOf(r).map(normalizeVenue) };
}

export const getVenue = cache(async (id: string) => {
  try {
    const venue = unwrapData(await fetchJson(`/venues/${encodeURIComponent(id)}?include_yearly=false&include_top_authors=false&include_recent_works=false`));
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

export const getPersonsWorks = cache(async (personId: string, page = 1, limit = 25) => {
  const id = encodeURIComponent(personId);
  const [personResult, worksResult] = await Promise.allSettled([
    fetchJson<any>(`/persons/${id}`),
    fetchJson<any>(`/persons/${id}/works?page=${page}&limit=${normalizeLimit(limit, 100)}`)
  ]);
  if (personResult.status === 'rejected' && !isMissingEntityError(personResult.reason)) throw personResult.reason;
  const envelope: any = worksResult.status === 'fulfilled' ? worksResult.value : null;
  return {
    person: personResult.status === 'fulfilled' ? unwrapData(personResult.value) : null,
    works: listOf(envelope).map(normalizePersonWorkItem),
    pagination: envelope?.pagination ?? null
  };
});

async function getPersonsWorksSorted(personId: string, limit: number, opts: WorksListOptions) {
  const id = encodeURIComponent(personId);
  try {
    const envelope = await fetchJson<any>(`/persons/${id}/works?limit=${normalizeLimit(limit, 100)}${worksListQuery(opts)}`);
    return listOf(envelope).map(normalizePersonWorkItem);
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
    const raw = unwrapData(await fetchJson<any>(`/institutions/${encodeURIComponent(id)}?include_works=false&include_authors=false&include_relationships=false`));
    return raw ? normalizeInstitution(raw) : null;
  } catch (error) {
    if (isMissingEntityError(error)) return null;
    throw error;
  }
});

export async function getInstitutionWorks(id: string, page = 1, limit = 25, opts?: WorksListOptions & { funded?: boolean }) {
  const segment = opts?.funded ? 'funded-works' : 'works';
  return await fetchJson<any>(`/institutions/${encodeURIComponent(id)}/${segment}?page=${page}&limit=${normalizeLimit(limit, 100)}${worksListQuery(opts)}`);
}

export const getSubject = cache(async (id: string) => {
  try {
    return unwrapData(await fetchJson<any>(`/subjects/${encodeURIComponent(id)}`));
  } catch (error) {
    if (isMissingEntityError(error)) return null;
    throw error;
  }
});

export async function getSubjectWorksPage(id: string, page = 1, limit = 25) {
  const r: any = await fetchJson(`/subjects/${encodeURIComponent(id)}/works?page=${page}&limit=${normalizeLimit(limit, 100)}`);
  return { ...r, data: listOf(r).map(normalizeSubjectWorkItem) };
}

export async function resolveDoi(doi: string) {
  const clean = String(doi || '').trim().replace(/^(?:doi:\s*|(?:https?:\/+)?(?:dx\.)?doi\.org\/)/i, '');
  if (!clean.includes('/')) return null;
  const encoded = clean.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  try {
    return unwrapData(await fetchJson<any>(`/${encoded}?include_citations=false&include_references=false`));
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
    const [venue, collected] = await Promise.all([
      getVenue(id),
      collectAllPages((page) => fetchJson<any>(`/venues/${safeId}/works?page=${page}&limit=${EXPORT_PAGE_SIZE}&year=${year}`))
    ]);
    const stamp = venue ? {
      venue: { id: venue.id, name: venue.name, issn: venue.issn, eissn: venue.eissn },
      publisher: venue.publisher ? { id: venue.publisher.id, name: venue.publisher.name } : null
    } : {};
    return {
      works: collected.works.map((work) => ({ ...work, ...stamp })),
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
  const segment = { person: 'persons', venue: 'venues', institution: 'institutions', subject: 'subjects' }[kind];
  return unwrapData(await fetchJson<any>(`/${segment}/${encodeURIComponent(id)}`));
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
