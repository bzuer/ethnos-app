import { cache } from 'react';
import { fetchJson } from './api';

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
    return r?.data || r?.results || r || [];
  } catch {
    try {
      const r: any = await fetchJson(`/search/works?q=${encodeURIComponent('*')}&limit=${encodeURIComponent(String(safeLimit))}&sort=recent`, init);
      return r?.data || r?.results || r || [];
    } catch {
      return [];
    }
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

export async function searchWorks(params: Record<string, string | number | boolean | undefined>) {
  const base = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && String(v) !== '') base.set(k, String(v)); });
  const qv = base.get('q') || '';
  const page = base.get('page') || '1';
  const limit = base.get('limit') || '25';

  const qs = new URLSearchParams(base as any);
  if (qs.has('work_type') && !qs.has('type')) {
    qs.set('type', String(qs.get('work_type')));
    qs.delete('work_type');
  }

  if (!qv || qv === '*') {
    return await fetchJson(
      `/works/showcase?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`,
      { retries: 1, timeoutMs: 8000 }
    );
  }

  try {
    return await fetchJson(`/search/works?${qs.toString()}`, { retries: 1, timeoutMs: 8000 });
  } catch {
    return await fetchJson(
      `/works?q=${encodeURIComponent(qv)}&page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`,
      { retries: 1, timeoutMs: 8000 }
    );
  }
}

export async function getVenuesPage(page = 1, limit = 50) {
  const r: any = await fetchJson(
    `/venues?page=${encodeURIComponent(String(page))}&limit=${encodeURIComponent(String(limit))}`,
    { cache: 'force-cache' as RequestCache }
  );
  return r;
}

export async function getVenueWorksPage(id: string | number, page = 1, limit = 25) {
  const r: any = await fetchJson(`/venues/${encodeURIComponent(String(id))}/works?page=${encodeURIComponent(String(page))}&limit=${encodeURIComponent(String(limit))}`);
  return r;
}

export const getPersonsWorks = cache(async (personId: string | number, page = 1, limit = 25) => {
  const id = encodeURIComponent(String(personId));
  const [personResult, worksResult] = await Promise.allSettled([
    fetchJson<any>(`/persons/${id}`),
    fetchJson<any>(`/persons/${id}/works?page=${encodeURIComponent(String(page))}&limit=${encodeURIComponent(String(limit))}`)
  ]);
  const p: any = personResult.status === 'fulfilled' ? personResult.value : null;
  const person = p?.data || p?.person || p || null;
  const works = worksResult.status === 'fulfilled' ? worksResult.value : null;
  return { person, works };
});
