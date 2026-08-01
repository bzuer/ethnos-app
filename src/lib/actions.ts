'use server';

import { fetchJson } from './api';
import {
  getInstitutionsPage,
  getSubjectWorksPage,
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

export async function actSearchWorks(params: ParamRecord) {
  return await searchWorks(params as Record<string, string | number | boolean | undefined>);
}

export type AutocompleteSuggestion = {
  text: string;
  type: 'title' | 'author' | 'venue';
  preview?: string;
  workCount?: number;
};

export async function actAutocompleteSuggest(query: string): Promise<AutocompleteSuggestion[]> {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  const enc = encodeURIComponent(q);
  try {
    const res = await fetchJson<any>(`/search/autocomplete?q=${enc}&limit=8`, { retries: 1, timeoutMs: 4000 });
    const suggestions = res?.data?.suggestions ?? res?.suggestions ?? [];
    if (!Array.isArray(suggestions)) return [];
    const mapped: AutocompleteSuggestion[] = [];
    for (const s of suggestions) {
      const text = String(s?.text ?? s?.name ?? '').trim();
      if (!text) continue;
      const type: AutocompleteSuggestion['type'] = s?.type === 'author' ? 'author' : s?.type === 'venue' ? 'venue' : 'title';
      const rawCount = Number(s?.work_count ?? s?.works_count);
      mapped.push({
        text,
        type,
        preview: s?.preview ? String(s.preview) : undefined,
        workCount: Number.isFinite(rawCount) && rawCount > 0 ? rawCount : undefined
      });
      if (mapped.length >= 8) break;
    }
    return mapped;
  } catch {
    return [];
  }
}

export type GlobalSearchBucket = { total: number; results: any[] };
export type GlobalSearchResult = {
  works: GlobalSearchBucket;
  persons: GlobalSearchBucket;
  institutions: GlobalSearchBucket;
};

export async function actSearchGlobal(query: string, limit = 10): Promise<GlobalSearchResult> {
  const q = String(query || '').trim();
  const empty: GlobalSearchResult = {
    works: { total: 0, results: [] },
    persons: { total: 0, results: [] },
    institutions: { total: 0, results: [] }
  };
  if (q.length < 2) return empty;
  try {
    const res = await fetchJson<any>(
      `/search/global?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(String(limit))}`,
      { retries: 1, timeoutMs: 8000 }
    );
    const data = res?.data ?? res ?? {};
    const bucket = (b: any): GlobalSearchBucket => ({
      total: Number(b?.total) || 0,
      results: Array.isArray(b?.results) ? b.results : (Array.isArray(b) ? b : [])
    });
    return { works: bucket(data.works), persons: bucket(data.persons), institutions: bucket(data.institutions) };
  } catch {
    return empty;
  }
}

export async function actGetSubjectWorksPage(id: string | number, page = 1, limit = 25) {
  return await getSubjectWorksPage(id, page, limit);
}

export async function actGetWorkFull(id: string | number, slim = false) {
  const safeId = encodeURIComponent(String(id));
  const query = slim ? '' : '?include_citations=true&include_references=true';
  try {
    const envelope: any = await fetchJson<any>(
      `/works/${safeId}${query}`,
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
