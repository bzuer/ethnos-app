'use server';

import { fetchJson } from './api';
import {
  getVenuesPage,
  searchWorks,
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
  const qv = base.get('q') || '';
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
  } catch {}

  const qs = new URLSearchParams(base);
  if (qs.has('work_type') && !qs.has('type')) {
    qs.set('type', String(qs.get('work_type')));
    qs.delete('work_type');
  }
  try {
    return await fetchJson(`/search/works?${qs.toString()}`, { retries: 1, timeoutMs: 8000 });
  } catch {}

  return await fetchJson(
    `/works?search=${encodeURIComponent(qv)}&page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`,
    { retries: 1, timeoutMs: 8000 }
  );
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
