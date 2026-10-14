'use server';

import { fetchJson, unwrapData } from './api';
import {
  getEntityExportWorks,
  getEntityRecord,
  getVenuesPage,
  loadWork,
  searchWorks,
  type VenuesListSort,
  type VenuesListSortOrder
} from './endpoints';
import type { EntityExportWorks, EntityKind } from './entity-export';
import { toVenueListPage } from './venues';

export async function actSearchWorks(params: Record<string, string>) {
  return await searchWorks(params);
}

export type AutocompleteSuggestion = {
  text: string;
  type: 'title' | 'author' | 'venue';
  workCount?: number;
};

export async function actAutocompleteSuggest(query: string): Promise<AutocompleteSuggestion[]> {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  try {
    const res = await fetchJson<any>(`/search/autocomplete?q=${encodeURIComponent(q)}&limit=8`, { retries: 1, timeoutMs: 4000 });
    const suggestions: any[] = Array.isArray(res?.data?.suggestions) ? res.data.suggestions : [];
    return suggestions
      .map((s) => {
        const count = Number(s?.work_count);
        return {
          text: String(s?.text ?? '').trim(),
          type: s?.type === 'author' || s?.type === 'venue' ? s.type : 'title',
          workCount: Number.isFinite(count) && count > 0 ? count : undefined
        } as AutocompleteSuggestion;
      })
      .filter((s) => s.text)
      .slice(0, 8);
  } catch {
    return [];
  }
}

export type GlobalSearchResult = {
  works: { total: number; results: any[] };
  persons: { total: number; results: any[] };
};

const EMPTY_GLOBAL: GlobalSearchResult = { works: { total: 0, results: [] }, persons: { total: 0, results: [] } };

export async function actSearchGlobal(query: string): Promise<GlobalSearchResult> {
  const q = String(query || '').trim();
  if (q.length < 2) return EMPTY_GLOBAL;
  try {
    const data = unwrapData(await fetchJson<any>(`/search/global?q=${encodeURIComponent(q)}&limit=10`, { retries: 1 }));
    const bucket = (b: any) => ({
      total: Number(b?.total) || 0,
      results: Array.isArray(b?.results) ? b.results : []
    });
    return { works: bucket(data?.works), persons: bucket(data?.persons) };
  } catch {
    return EMPTY_GLOBAL;
  }
}

export async function actGetWorkFull(id: string, slim = false) {
  try {
    if (!slim) return await loadWork(id);
    return unwrapData(await fetchJson<any>(`/works/${encodeURIComponent(id)}`, { retries: 1 }));
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
  authors_count: number | null;
};

function mapRelatedRow(raw: any): RelatedWorkRow {
  return {
    id: raw?.citing_work_id ?? raw?.cited_work_id ?? null,
    title: raw?.title ?? null,
    publication_year: raw?.publication_year ?? null,
    type: raw?.type ?? null,
    doi: raw?.doi ?? null,
    venue_name: raw?.venue_name ?? raw?.venue_abbreviated_name ?? null,
    authors_count: typeof raw?.authors_count === 'number' ? raw.authors_count : null
  };
}

function relatedQuery(page: number) {
  return `page=${Math.max(1, Math.floor(Number(page)) || 1)}&limit=100`;
}

export async function actGetWorkCitations(id: string, page = 1) {
  const env: any = await fetchJson<any>(`/works/${encodeURIComponent(id)}/citations?${relatedQuery(page)}`, { retries: 1, timeoutMs: 10000 });
  const rows = Array.isArray(env?.data?.citing_works) ? env.data.citing_works : [];
  return { items: rows.map(mapRelatedRow), hasNext: env?.pagination?.hasNext === true };
}

export async function actGetWorkReferences(id: string, page = 1) {
  const env: any = await fetchJson<any>(`/works/${encodeURIComponent(id)}/references?${relatedQuery(page)}`, { retries: 1, timeoutMs: 10000 });
  const rows = Array.isArray(env?.data?.referenced_works) ? env.data.referenced_works : [];
  return { items: rows.map(mapRelatedRow), hasNext: env?.pagination?.hasNext === true };
}

const ENTITY_KINDS: EntityKind[] = ['person', 'venue', 'institution', 'subject'];

export async function actGetEntityExportWorks(kind: EntityKind, id: string): Promise<EntityExportWorks> {
  if (!ENTITY_KINDS.includes(kind)) throw new Error('Unknown entity kind');
  return await getEntityExportWorks(kind, String(id));
}

export async function actGetEntityRecord(kind: EntityKind, id: string) {
  if (!ENTITY_KINDS.includes(kind)) return null;
  try {
    return await getEntityRecord(kind, String(id));
  } catch {
    return null;
  }
}

export async function actGetVenuesPage(page: number, limit: number, sortBy?: VenuesListSort, sortOrder?: VenuesListSortOrder) {
  return toVenueListPage(await getVenuesPage(page, limit, { sortBy, sortOrder }));
}
