import { cache } from 'react';
import { fetchJson } from './api';
import { normalizePersonDetail, normalizePersonWorkItem, normalizeWorkDetail } from './works';

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

export async function getVitrinePage(page = 1, limit = 25) {
  const r: any = await fetchJson(`/works/showcase?page=${encodeURIComponent(String(page))}&limit=${encodeURIComponent(String(limit))}`);
  return r;
}

export async function getHomeTopVenues(limit = 25, page = 1) {
  const safeLimit = normalizeLimit(limit, 100);
  const safePage = Math.max(1, Number(page) || 1);
  const init = { cache: 'force-cache' as RequestCache };
  try {
    const r: any = await fetchJson(`/venues?limit=${encodeURIComponent(String(safeLimit))}&page=${encodeURIComponent(String(safePage))}`, init);
    const data = r?.data || r?.results || r?.items || [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

const SEARCH_FILTER_KEYS = ['type', 'work_type', 'author', 'venue', 'venue_name', 'subject', 'language', 'year_from', 'year_to', 'peer_reviewed', 'open_access'] as const;

export async function searchWorks(params: Record<string, string | number | boolean | undefined>) {
  const base = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && String(v) !== '') base.set(k, String(v)); });
  const qv = base.get('q') || '';
  const page = base.get('page') || '1';
  const limit = base.get('limit') || '25';

  const qs = new URLSearchParams(base);
  if (qs.has('work_type') && !qs.has('type')) {
    qs.set('type', String(qs.get('work_type')));
    qs.delete('work_type');
  }
  qs.delete('scope');

  const hasFilters = SEARCH_FILTER_KEYS.some((k) => qs.get(k));

  if (!qv || qv === '*') {
    if (!hasFilters) {
      return await fetchJson(
        `/works/showcase?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`,
        { retries: 1, timeoutMs: 8000 }
      );
    }
    qs.delete('q');
    return await fetchJson(`/search/works?${qs.toString()}`, { retries: 1, timeoutMs: 8000 });
  }

  try {
    return await fetchJson(`/search/works?${qs.toString()}`, { retries: 1, timeoutMs: 8000 });
  } catch {
    return await fetchJson(
      `/works?search=${encodeURIComponent(qv)}&page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`,
      { retries: 1, timeoutMs: 8000 }
    );
  }
}

export const getWork = cache(async (id: string | number, opts?: { includeCitations?: boolean; includeReferences?: boolean }) => {
  const includeCitations = opts?.includeCitations ?? true;
  const includeReferences = opts?.includeReferences ?? true;
  const qs = new URLSearchParams({
    include_citations: includeCitations ? 'true' : 'false',
    include_references: includeReferences ? 'true' : 'false'
  });
  let envelope: any = null;
  try {
    envelope = await fetchJson<any>(`/works/${encodeURIComponent(String(id))}?${qs.toString()}`);
  } catch {
    return null;
  }
  const raw = envelope?.data || envelope?.work || envelope || null;
  return raw ? normalizeWorkDetail(raw) : null;
});

export const getPublication = cache(async (id: string | number, opts?: { includeCitations?: boolean; includeReferences?: boolean }) => {
  const includeCitations = opts?.includeCitations ?? false;
  const includeReferences = opts?.includeReferences ?? false;
  const qs = new URLSearchParams({
    include_citations: includeCitations ? 'true' : 'false',
    include_references: includeReferences ? 'true' : 'false'
  });
  try {
    const envelope: any = await fetchJson<any>(`/publications/${encodeURIComponent(String(id))}?${qs.toString()}`);
    return envelope?.data || envelope?.publication || envelope || null;
  } catch {
    return null;
  }
});

export type VenuesListSort =
  | 'id' | 'name' | 'type'
  | 'impact_factor' | 'works_count'
  | 'score' | 'ranking' | 'h_index' | 'cited_by_count'
  | 'oldest' | 'newest';
export type VenuesListSortOrder = 'ASC' | 'DESC';
export type VenuesListFilters = {
  sortBy?: VenuesListSort;
  sortOrder?: VenuesListSortOrder;
  type?: string;
  coverageFrom?: number;
  coverageTo?: number;
  activeInYear?: number;
};

export async function getVenuesPage(page = 1, limit = 50, opts?: VenuesListFilters) {
  const params = [
    `page=${encodeURIComponent(String(page))}`,
    `limit=${encodeURIComponent(String(limit))}`
  ];
  if (opts?.sortBy) params.push(`sortBy=${encodeURIComponent(opts.sortBy)}`);
  if (opts?.sortOrder) params.push(`sortOrder=${encodeURIComponent(opts.sortOrder)}`);
  if (opts?.type) params.push(`type=${encodeURIComponent(opts.type)}`);
  if (typeof opts?.coverageFrom === 'number' && Number.isFinite(opts.coverageFrom)) params.push(`coverage_from=${encodeURIComponent(String(opts.coverageFrom))}`);
  if (typeof opts?.coverageTo === 'number' && Number.isFinite(opts.coverageTo)) params.push(`coverage_to=${encodeURIComponent(String(opts.coverageTo))}`);
  if (typeof opts?.activeInYear === 'number' && Number.isFinite(opts.activeInYear)) params.push(`active_in_year=${encodeURIComponent(String(opts.activeInYear))}`);
  const r: any = await fetchJson(
    `/venues?${params.join('&')}`,
    { cache: 'force-cache' as RequestCache }
  );
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
  if (opts.sortOrder) params.push(`sortOrder=${encodeURIComponent(opts.sortOrder)}`);
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

export async function getPersonsWorksProminent(personId: string | number, limit = 25) {
  const id = encodeURIComponent(String(personId));
  // oversample to survive backend duplicates (one row per authorship record)
  const fetchLimit = Math.min(100, limit * 4);
  const qs = `limit=${encodeURIComponent(String(fetchLimit))}${worksListQuery({ sortBy: 'cited_by_count', sortOrder: 'desc', citedByMin: 1 })}`;
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
