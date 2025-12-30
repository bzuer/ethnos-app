import { fetchJson } from './api';

function normalizeLimit(limit: number, max: number, min = 1) {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(Math.max(parsed, min), max);
}

export async function getHomeRecentWorks(limit = 20) {
  const safeLimit = normalizeLimit(limit, 20);
  try {
    const r: any = await fetchJson(`/works/vitrine?limit=${encodeURIComponent(String(safeLimit))}`);
    return r?.data || r?.results || r || [];
  } catch {
    try {
      const r: any = await fetchJson(`/search/works?q=${encodeURIComponent('*')}&limit=${encodeURIComponent(String(safeLimit))}&sort=recent`);
      return r?.data || r?.results || r || [];
    } catch {
      return [];
    }
  }
}

export async function getVitrinePage(page = 1, limit = 25) {
  const r: any = await fetchJson(`/works/vitrine?page=${encodeURIComponent(String(page))}&limit=${encodeURIComponent(String(limit))}`);
  return r;
}

export async function getHomeTopVenues(limit = 25, page = 1) {
  const safeLimit = normalizeLimit(limit, 100);
  const safePage = Math.max(1, Number(page) || 1);
  try {
    const r: any = await fetchJson(`/venues?limit=${encodeURIComponent(String(safeLimit))}&page=${encodeURIComponent(String(safePage))}`);
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

  const fallbackList = async () => fetchJson(`/works?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`);

  if (!qv || qv === '*') return fallbackList();

  const tryPaths: string[] = [];
  const sphinx = new URLSearchParams(base as any);
  const offset = base.has('offset') ? Number(base.get('offset') || '0') : Math.max(0, (Number(page) - 1) * Number(limit));
  sphinx.set('limit', String(limit));
  sphinx.delete('page');
  if (!sphinx.has('offset')) sphinx.set('offset', String(offset));
  if (sphinx.has('include_facets') && !sphinx.has('facets')) sphinx.set('facets', String(sphinx.get('include_facets')));
  tryPaths.push(`/search/sphinx?${sphinx.toString()}`);

  const qs = new URLSearchParams(base as any);
  if (qs.has('work_type') && !qs.has('type')) qs.set('type', String(qs.get('work_type')));
  if (qs.has('year') && !qs.has('year_from')) qs.set('year_from', String(qs.get('year')));
  if (qs.has('facets') && !qs.has('include_facets')) qs.set('include_facets', String(qs.get('facets')));
  tryPaths.push(`/search/works?${qs.toString()}`);

  tryPaths.push(`/works?q=${encodeURIComponent(qv)}&page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`);

  let lastError: unknown;
  for (const path of tryPaths) {
    try {
      return await fetchJson(path, { retries: 3, timeoutMs: 15000 });
    } catch (err) {
      lastError = err;
      continue;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Search failed');
}

export async function getVenuesPage(page = 1, limit = 50) {
  const r: any = await fetchJson(`/venues?page=${encodeURIComponent(String(page))}&limit=${encodeURIComponent(String(limit))}`);
  return r;
}

export async function getVenueWorksPage(id: string | number, page = 1, limit = 25) {
  const r: any = await fetchJson(`/venues/${encodeURIComponent(String(id))}/works?page=${encodeURIComponent(String(page))}&limit=${encodeURIComponent(String(limit))}`);
  return r;
}

export async function getPersonsWorks(personId: string | number, page = 1, limit = 25) {
  const p: any = await fetchJson<any>(`/persons/${encodeURIComponent(String(personId))}`);
  const w: any = await fetchJson<any>(`/persons/${encodeURIComponent(String(personId))}/works?page=${encodeURIComponent(String(page))}&limit=${encodeURIComponent(String(limit))}`);
  return { person: p?.data || p?.person || p, works: w };
}
