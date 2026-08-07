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

export interface VenueMetrics {
  impact_factor?: number | string | null;
  citescore?: number | string | null;
  sjr?: number | string | null;
  sjr_best_quartile?: string | null;
  snip?: number | string | null;
  h_index?: number | null;
  i10_index?: number | null;
  two_yr_mean_citedness?: number | null;
  overton?: number | null;
  female_share?: number | null;
}

export interface VenueIdentifiers {
  issn?: string | null;
  eissn?: string | null;
  isbn13?: string | null;
  scopus_id?: string | null;
  wikidata_id?: string | null;
  openalex_id?: string | null;
  scielo_id?: string | null;
  mag_id?: string | null;
  openlibrary_work?: string | null;
}

export interface VenueIndexing {
  is_in_doaj?: boolean | null;
  is_in_scielo?: boolean | null;
  is_indexed_in_scopus?: boolean | null;
  is_oa_diamond?: boolean | null;
  validation_status?: string | null;
}

export interface VenuePublisher {
  id?: string | number;
  name?: string;
  type?: string;
  country_code?: string;
  url?: string | null;
  identifiers?: { ror_id?: string | null; grid_id?: string | null; wikidata_id?: string | null; openalex_id?: string | null } | null;
  _links?: { self?: string | null } | null;
}

export interface Venue {
  id: string | number;
  name?: string;
  abbreviated_name?: string;
  type?: string;
  aggregation_type?: string | null;
  language?: string | null;
  open_access?: boolean | null;
  issn?: string;
  eissn?: string;
  isbn13?: string | null;
  openlibrary_work?: string | null;
  mag_id?: string | null;
  works_count?: number;
  cited_by_count?: number;
  coverage_start_year?: number;
  coverage_end_year?: number;
  country_code?: string;
  homepage_url?: string | null;
  publisher?: VenuePublisher | null;
  identifiers?: VenueIdentifiers | null;
  indexing?: VenueIndexing | null;
  metrics?: VenueMetrics | null;
  legacy_metrics?: VenueMetrics | null;
  ranking?: { score?: number | null; components?: Record<string, number | null>; llm?: { relevance?: number | null; justification?: string | null } | null } | null;
  sjr?: number | string | null;
  snip?: number | string | null;
  citescore?: number | string | null;
  impact_factor?: number | string | null;
  sjr_best_quartile?: string | null;
  h_index?: number | null;
  i10_index?: number | null;
  two_yr_mean_citedness?: number | null;
  overton?: number | null;
  female_share?: number | null;
  is_in_doaj?: boolean | null;
  is_in_scielo?: boolean | null;
  is_indexed_in_scopus?: boolean | null;
  is_oa_diamond?: boolean | null;
  validation_status?: string | null;
  summary_snapshot?: {
    name?: string;
    abbreviated_name?: string;
    summary?: string;
    description?: string;
    focus?: string;
    subjects?: Array<string | { name?: string; display_name?: string; label?: string }>;
    subjects_string?: string;
  } | null;
  subjects?: Array<string | { subject_id?: number; term?: string; score?: number; vocabulary?: string; lang?: string; name?: string; display_name?: string; label?: string }>;
  subjects_string?: string | null;
  description?: string | null;
  summary?: string | null;
  summary_truncated?: boolean | null;
  summary_updated_at?: string | null;
  publication_summary?: {
    first_publication_year?: number | null;
    latest_publication_year?: number | null;
    total_works_count?: number;
    open_access_works_count?: number;
    open_access_percentage?: number | null;
    publication_trend?: Array<{ year?: number | null; works_count?: number; oa_works_count?: number }>;
  } | null;
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
