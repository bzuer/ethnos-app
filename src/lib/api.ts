import 'server-only';
import { normalizeVenue } from './venues';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const API_BASE = 'http://127.0.0.1:1211';

export class ApiError extends Error {
  status: number;
  code?: string;
  errors?: unknown[];
  constructor(message: string, status: number, code?: string, errors?: unknown[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

export function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.code === 'NOT_FOUND');
}

async function buildApiError(res: Response) {
  let code: string | undefined;
  let message = `HTTP ${res.status}`;
  let errors: unknown[] | undefined;
  try {
    const body: any = await res.json();
    if (body && typeof body === 'object') {
      if (typeof body.code === 'string') code = body.code;
      if (typeof body.message === 'string' && body.message) message = body.message;
      if (Array.isArray(body.errors)) errors = body.errors;
    }
  } catch {}
  return new ApiError(message, res.status, code, errors);
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  totalExact: boolean;
}

export function unwrapData<T = any>(envelope: any): T | null {
  if (envelope === null || envelope === undefined) return null;
  if (typeof envelope === 'object' && 'data' in envelope) return (envelope.data as T) ?? null;
  return envelope as T;
}

export function unwrapList<T = any>(envelope: any): T[] {
  const source = envelope && typeof envelope === 'object' && 'data' in envelope ? envelope.data : envelope;
  return Array.isArray(source) ? (source as T[]) : [];
}

export function readPagination(envelope: any, fallback?: { page?: number; limit?: number }): Pagination {
  const raw = envelope?.pagination || {};
  const page = Math.max(1, Number(raw.page) || fallback?.page || 1);
  const limit = Math.max(1, Number(raw.limit) || fallback?.limit || 10);
  const total = Number.isFinite(Number(raw.total)) ? Number(raw.total) : 0;
  const totalPages = Number.isFinite(Number(raw.totalPages)) ? Number(raw.totalPages) : Math.ceil(total / limit);
  const hasNext = typeof raw.hasNext === 'boolean' ? raw.hasNext : page < totalPages;
  const hasPrev = typeof raw.hasPrev === 'boolean' ? raw.hasPrev : page > 1;
  const totalExact = envelope?.meta?.pagination_total_exact !== false;
  return { page, limit, total, totalPages, hasNext, hasPrev, totalExact };
}

export async function fetchJson<T>(path: string, init?: RequestInit & { timeoutMs?: number; retries?: number; method?: HttpMethod }) {
  const attempts = Math.max(1, init?.retries ?? 2);
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), init?.timeoutMs ?? 8000);
    try {
      const url = normalize(API_BASE, path);
      const headers = new Headers({ Accept: 'application/json', ...(init?.headers || {}) });
      const key = process.env.ETHNOS_API_KEY;
      if (key) headers.set('x-access-key', key);
      const { next, ...rest } = init || {};
      const res = await fetch(url, {
        cache: rest?.cache ?? 'no-store',
        ...rest,
        headers,
        signal: controller.signal,
        ...(next ? { next } : {})
      });
      if (!res.ok) {
        const apiError = await buildApiError(res);
        if ((res.status === 429 || res.status >= 500) && attempt < attempts - 1) {
          lastError = apiError;
          await wait(300);
          continue;
        }
        throw apiError;
      }
      return (await res.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt >= attempts - 1) throw error;
      await wait(150);
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
  abbreviated_name?: string;
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
    name?: string;
    abbreviated_name?: string;
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
  let res: any;
  try {
    res = await fetchJson<ApiEnvelope<Venue>>(`/venues/${id}`);
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
  const v: any = unwrapData(res);
  return v ? (normalizeVenue(v) as Venue) : null;
}

export async function getVenueWorks(
  venueId: string | number,
  limit = 25,
  cursor?: string
): Promise<{ items: VenueWorkItem[]; total?: number; nextCursor?: string | null }> {
  const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
  const limitParam = encodeURIComponent(String(limit));
  const parse = (res: any) => {
    const items = (res?.results ?? res?.data ?? res?.items ?? res) as VenueWorkItem[];
    const total = res?.total ?? res?.meta?.total ?? res?.pagination?.total;
    const next = res?.next_cursor ?? res?.pagination?.nextCursor ?? null;
    if (Array.isArray(items)) return { items, total, nextCursor: next ?? null };
    return null;
  };

  try {
    const res = await fetchJson<any>(`/venues/${venueId}/works?limit=${limitParam}${cursorParam}`, { retries: 1 });
    const parsed = parse(res);
    if (parsed) return parsed;
  } catch {}

  try {
    const res = await fetchJson<any>(`/works?venue_id=${encodeURIComponent(String(venueId))}&limit=${limitParam}${cursorParam}`, { retries: 1 });
    const parsed = parse(res);
    if (parsed) return parsed;
  } catch {}

  return { items: [], total: 0, nextCursor: null };
}
