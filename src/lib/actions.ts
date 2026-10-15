'use server';

import { fetchJson, unwrapData } from './api';
import {
  getEntityExportWorks,
  getEntityRecord,
  getVenuesPage,
  loadWork,
  searchWorks
} from './endpoints';
import type { EntityExportWorks, EntityKind } from './entity-export';
import { toVenueListPage } from './venues';
import { toRelatedWorkRow, toWorkListRow } from './works';

export type WorksSearchPage = {
  items: ReturnType<typeof toWorkListRow>[];
  page: number;
  hasNext: boolean;
  total: number | null;
  totalPages: number | null;
};

export async function actSearchWorks(params: Record<string, string>): Promise<WorksSearchPage> {
  const res = await searchWorks(params);
  if (res?.meta?.page_degraded) throw new Error('Degraded page');
  const pagination = res?.pagination || {};
  const exact = res?.meta?.pagination_total_exact !== false;
  return {
    items: (Array.isArray(res?.data) ? res.data : []).map(toWorkListRow),
    page: Number(pagination.page) || 1,
    hasNext: pagination.hasNext === true,
    total: exact ? Number(pagination.total) || 0 : null,
    totalPages: exact ? Number(pagination.totalPages) || 0 : null
  };
}

export type AutocompleteSuggestion = {
  text: string;
  type: 'title' | 'author' | 'venue';
};

export async function actAutocompleteSuggest(query: string): Promise<AutocompleteSuggestion[]> {
  const q = String(query || '').trim().slice(0, 200);
  if (q.length < 2) return [];
  try {
    const res = await fetchJson<any>(`/search/autocomplete?q=${encodeURIComponent(q)}&limit=8`, { attempts: 1, timeoutMs: 4000 });
    const suggestions: any[] = Array.isArray(res?.data?.suggestions) ? res.data.suggestions : [];
    return suggestions
      .map((s): AutocompleteSuggestion => ({
        text: String(s?.text ?? '').trim(),
        type: s?.type === 'author' || s?.type === 'venue' ? s.type : 'title'
      }))
      .filter((s) => s.text);
  } catch {
    return [];
  }
}

export type GlobalSearchResult = {
  works: { total: number; results: ReturnType<typeof toWorkListRow>[] };
  persons: { total: number; results: Array<{ id: number; name: string; worksCount: number }> };
};

export async function actSearchGlobal(query: string): Promise<GlobalSearchResult> {
  const q = String(query || '').trim().slice(0, 200);
  const data = unwrapData(await fetchJson<any>(`/search/global?q=${encodeURIComponent(q)}&limit=10`, { attempts: 1 }));
  const works: any[] = Array.isArray(data?.works?.results) ? data.works.results : [];
  const persons: any[] = Array.isArray(data?.persons?.results) ? data.persons.results : [];
  return {
    works: { total: Number(data?.works?.total) || 0, results: works.map(toWorkListRow) },
    persons: {
      total: Number(data?.persons?.total) || 0,
      results: persons.map((p) => ({ id: p.id, name: p.preferred_name, worksCount: Number(p.metrics?.works_count) || 0 }))
    }
  };
}

export async function actGetWorkFull(id: string, slim = false) {
  try {
    if (!slim) return await loadWork(id);
    return unwrapData(await fetchJson<any>(`/works/${encodeURIComponent(id)}?include_citations=false&include_references=false`, { attempts: 1 }));
  } catch {
    return null;
  }
}

function relatedQuery(page: number) {
  return `page=${Math.max(1, Math.floor(Number(page)) || 1)}&limit=100`;
}

export async function actGetWorkCitations(id: string, page = 1) {
  const env: any = await fetchJson<any>(`/works/${encodeURIComponent(id)}/citations?${relatedQuery(page)}`, { attempts: 1, timeoutMs: 10000 });
  const rows = Array.isArray(env?.data?.citing_works) ? env.data.citing_works : [];
  return { items: rows.map(toRelatedWorkRow), hasNext: env?.pagination?.hasNext === true };
}

export async function actGetWorkReferences(id: string, page = 1) {
  const env: any = await fetchJson<any>(`/works/${encodeURIComponent(id)}/references?${relatedQuery(page)}`, { attempts: 1, timeoutMs: 10000 });
  const rows = Array.isArray(env?.data?.referenced_works) ? env.data.referenced_works : [];
  return { items: rows.map(toRelatedWorkRow), hasNext: env?.pagination?.hasNext === true };
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

export async function actGetVenuesPage(page: number) {
  return toVenueListPage(await getVenuesPage(page));
}
