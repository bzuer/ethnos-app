'use server';

import { ApiError, fetchJson } from './api';
import {
  getInstitutionsPage,
  getVenuesPage,
  searchWorks,
  type InstitutionsListOptions,
  type InstitutionsListSort,
  type VenuesListFilters,
  type VenuesListSort,
  type VenuesListSortOrder
} from './endpoints';

export type Primitive = string | number | boolean;
export type ParamRecord = Record<string, Primitive | undefined | null>;

function buildQuery(params: ParamRecord): URLSearchParams {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    qs.set(key, String(value));
  }
  return qs;
}

export async function actSearchWorks(params: ParamRecord) {
  return await searchWorks(params as Record<string, string | number | boolean | undefined>);
}

export async function actSearchSphinx(params: ParamRecord) {
  const base = buildQuery(params);
  const page = base.get('page') || '1';
  const limit = base.get('limit') || '25';

  const sphinx = new URLSearchParams(base);
  const offset = base.has('offset')
    ? Number(base.get('offset') || '0')
    : Math.max(0, (Number(page) - 1) * Number(limit));
  sphinx.set('limit', String(limit));
  sphinx.delete('page');
  if (!sphinx.has('offset')) sphinx.set('offset', String(offset));

  try {
    return await fetchJson(`/search/advanced?${sphinx.toString()}`, { retries: 1, timeoutMs: 12000 });
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) throw error;
  }

  const qs = new URLSearchParams(base);
  if (qs.has('work_type') && !qs.has('type')) {
    qs.set('type', String(qs.get('work_type')));
    qs.delete('work_type');
  }
  return await fetchJson(`/search/works?${qs.toString()}`, { retries: 1, timeoutMs: 8000 });
}

export type AutocompletePayload = {
  works: any[];
  venues: any[];
  persons: any[];
};

export async function actAutocomplete(query: string): Promise<AutocompletePayload> {
  const q = String(query || '').trim();
  if (q.length < 2) return { works: [], venues: [], persons: [] };
  const enc = encodeURIComponent(q);
  const init = { retries: 1, timeoutMs: 4000 };

  const [worksRes, venuesRes, personsRes] = await Promise.allSettled([
    fetchJson<any>(`/search/works?q=${enc}&limit=3`, init),
    fetchJson<any>(`/venues/search?q=${enc}&limit=2`, init),
    fetchJson<any>(`/search/persons?q=${enc}&limit=2`, init)
  ]);

  const pickList = (r: PromiseSettledResult<any>): any[] => {
    if (r.status !== 'fulfilled' || !r.value) return [];
    const items = r.value?.data ?? r.value?.results ?? r.value?.items ?? r.value;
    return Array.isArray(items) ? items : [];
  };

  return {
    works: pickList(worksRes).slice(0, 3),
    venues: pickList(venuesRes).slice(0, 2),
    persons: pickList(personsRes).slice(0, 2)
  };
}

export async function actGetWorkFull(id: string | number) {
  const safeId = encodeURIComponent(String(id));
  try {
    const envelope: any = await fetchJson<any>(
      `/works/${safeId}?include_citations=true&include_references=true`,
      { retries: 1, timeoutMs: 8000 }
    );
    return envelope?.data ?? envelope?.work ?? envelope ?? null;
  } catch {
    return null;
  }
}

type RelatedWorkRow = {
  id: number | null;
  title: string | null;
  publication_year: number | null;
  type: string | null;
  doi: string | null;
  venue_name: string | null;
  venue: { name: string } | null;
  authors_count: number | null;
  citation_type: string | null;
};

function mapRelatedRow(raw: any): RelatedWorkRow {
  return {
    id: raw?.citing_work_id ?? raw?.cited_work_id ?? raw?.work_id ?? raw?.id ?? null,
    title: raw?.title ?? null,
    publication_year: raw?.publication_year ?? null,
    type: raw?.type ?? null,
    doi: raw?.doi ?? null,
    venue_name: raw?.venue_name ?? raw?.venue_abbreviated_name ?? null,
    venue: raw?.venue_name ? { name: raw.venue_name } : null,
    authors_count: typeof raw?.authors_count === 'number' ? raw.authors_count : null,
    citation_type: raw?.citation?.type ?? raw?.citation_type ?? null
  };
}

export async function actGetWorkCitations(id: string | number, page = 1, type?: string) {
  const qs = new URLSearchParams();
  qs.set('page', String(Math.max(1, Number(page) || 1)));
  qs.set('limit', '100');
  if (type && type !== 'all') qs.set('type', type);
  const env: any = await fetchJson<any>(`/works/${encodeURIComponent(String(id))}/citations?${qs.toString()}`, { retries: 1, timeoutMs: 10000 });
  const data = env?.data || {};
  const rows = Array.isArray(data.citing_works) ? data.citing_works : [];
  const pagination = env?.pagination || {};
  return {
    items: rows.map(mapRelatedRow),
    total: Number(pagination.total) || rows.length,
    page: Number(pagination.page) || 1,
    hasNext: !!pagination.hasNext
  };
}

export async function actGetWorkReferences(id: string | number, page = 1) {
  const qs = new URLSearchParams();
  qs.set('page', String(Math.max(1, Number(page) || 1)));
  qs.set('limit', '100');
  const env: any = await fetchJson<any>(`/works/${encodeURIComponent(String(id))}/references?${qs.toString()}`, { retries: 1, timeoutMs: 10000 });
  const data = env?.data || {};
  const resolved = Array.isArray(data.referenced_works) ? data.referenced_works : [];
  const unresolvedRaw = Array.isArray(data.unresolved_references) ? data.unresolved_references : [];
  const counts = data.counts || {};
  const pagination = env?.pagination || {};
  return {
    items: resolved.map(mapRelatedRow),
    unresolved: unresolvedRaw.map((r: any) => ({ doi: r?.cited_doi ?? null, status: r?.status ?? null })),
    counts: { total: Number(counts.total) || 0, resolved: Number(counts.resolved) || 0, unresolved: Number(counts.unresolved) || 0 },
    total: Number(counts.total ?? pagination.total) || resolved.length,
    page: Number(pagination.page) || 1,
    hasNext: !!pagination.hasNext
  };
}

export type VenuesPageActionOptions = {
  sortBy?: VenuesListSort;
  sortOrder?: VenuesListSortOrder;
  type?: string;
  coverageFrom?: number;
  coverageTo?: number;
  activeInYear?: number;
};

export async function actGetVenuesPage(page: number, limit: number, opts?: VenuesPageActionOptions) {
  const filters: VenuesListFilters | undefined = opts ? { ...opts } : undefined;
  return await getVenuesPage(page, limit, filters);
}

export type InstitutionsPageActionOptions = {
  sortBy?: InstitutionsListSort;
  sortOrder?: 'ASC' | 'DESC';
  type?: string;
  country?: string;
  q?: string;
};

export async function actGetInstitutionsPage(page: number, limit: number, opts?: InstitutionsPageActionOptions) {
  const filters: InstitutionsListOptions | undefined = opts ? { ...opts } : undefined;
  return await getInstitutionsPage(page, limit, filters);
}
