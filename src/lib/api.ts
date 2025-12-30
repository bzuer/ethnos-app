export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const DEFAULT_LOCAL_API_BASE = process.env.NEXT_PUBLIC_DEV_API || 'http://127.0.0.1:3000';

const API_BASE =
  process.env.ETHNOS_UPSTREAM_API ||
  process.env.NEXT_PUBLIC_DEV_API ||
  process.env.BACKEND_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  DEFAULT_LOCAL_API_BASE;

export async function fetchJson<T>(path: string, init?: RequestInit & { timeoutMs?: number; retries?: number; method?: HttpMethod }) {
  const attempts = Math.max(1, init?.retries ?? 2);
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), init?.timeoutMs ?? 12000);
    try {
      const url = normalize(API_BASE, path);
      const headers = new Headers({ Accept: 'application/json', ...(init?.headers || {}) });
      const key = process.env.ETHNOS_API_KEY;
      if (key) headers.set('x-access-key', key);
      const res = await fetch(url, {
        cache: init?.cache ?? 'no-store',
        ...init,
        headers,
        signal: controller.signal,
        next: init?.next ?? { revalidate: 0 }
      });
      if (!res.ok) {
        const statusError: any = new Error(`HTTP ${res.status}`);
        statusError.status = res.status;
        if ((res.status === 429 || res.status >= 500) && attempt < attempts - 1) {
          lastError = statusError;
          await wait((attempt + 1) * 500);
          continue;
        }
        throw statusError;
      }
      return (await res.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt >= attempts - 1) throw error;
      await wait((attempt + 1) * 250);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Request failed');
}

function normalize(base: string, path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const joined = `${(base || '').replace(/\/$/, '')}/${String(path || '').replace(/^\//, '')}`;
  return joined;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface Venue {
  id: string | number;
  name?: string;
  type?: string;
  issn?: string;
  eissn?: string;
  works_count?: number;
  coverage_start_year?: number;
  coverage_end_year?: number;
  country_code?: string;
  publisher?: { name?: string; country_code?: string } | null;
  metrics?: { sjr?: number | string; snip?: number | string; citescore?: number | string } | null;
  legacy_metrics?: { sjr?: number | string; snip?: number | string; citescore?: number | string } | null;
  sjr?: number | string | null;
  snip?: number | string | null;
  citescore?: number | string | null;
  summary_snapshot?: {
    summary?: string;
    description?: string;
    focus?: string;
    subjects?: Array<string | { name?: string; display_name?: string; label?: string }>;
    subjects_string?: string;
  } | null;
  subjects?: Array<string | { name?: string; display_name?: string; label?: string }>;
  subjects_string?: string | null;
  description?: string | null;
  summary?: string | null;
}

export interface VenueWorkItem {
  id: string | number;
  title?: string;
  year?: number;
  work_type?: string;
  authors?: Array<{ person_id?: string | number; name: string } | string>;
}

type ApiEnvelope<T> = { data?: T } | { venue?: T } | T;

export async function getVenue(id: string | number): Promise<Venue | null> {
  try {
    const res = await fetchJson<ApiEnvelope<Venue>>(`/venues/${id}`);
    const v: any = (res as any)?.data ?? (res as any)?.venue ?? res;
    return (v as Venue) || null;
  } catch {
    return null;
  }
}

export async function getVenueWorks(
  venueId: string | number,
  limit = 25,
  cursor?: string
): Promise<{ items: VenueWorkItem[]; total?: number; nextCursor?: string | null }> {
  const tryPaths = [
    `/venues/${venueId}/works?limit=${encodeURIComponent(String(limit))}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
    `/works?venue_id=${encodeURIComponent(String(venueId))}&limit=${encodeURIComponent(String(limit))}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
  ];

  for (const path of tryPaths) {
    try {
      const res = await fetchJson<any>(path);
      const items = (res?.results ?? res?.data ?? res?.items ?? res) as VenueWorkItem[];
      const total = res?.total ?? res?.meta?.total ?? res?.pagination?.total;
      const next = res?.next_cursor ?? res?.pagination?.nextCursor ?? null;
      if (Array.isArray(items)) {
        return { items, total, nextCursor: next ?? null };
      }
    } catch {
    }
  }
  return { items: [], total: 0, nextCursor: null };
}

import 'server-only';
