import 'server-only';

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

function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.code === 'NOT_FOUND');
}

function isInvalidEntityIdError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.status !== 400 && error.code !== 'VALIDATION_ERROR') return false;
  const details = Array.isArray(error.errors) ? error.errors : [];
  if (details.length === 0) return true;
  return details.some((entry) => {
    const location = (entry as { location?: unknown })?.location;
    return location === 'params' || location === 'param' || location === 'path';
  });
}

export function isMissingEntityError(error: unknown): boolean {
  return isNotFoundError(error) || isInvalidEntityIdError(error);
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

export function unwrapData<T = any>(envelope: any): T | null {
  if (envelope === null || envelope === undefined) return null;
  if (typeof envelope === 'object' && 'data' in envelope) return (envelope.data as T) ?? null;
  return envelope as T;
}

export async function fetchJson<T>(path: string, init?: RequestInit & { timeoutMs?: number; retries?: number }) {
  const { timeoutMs = 8000, retries = 2, ...request } = init ?? {};
  const attempts = Math.max(1, retries);
  const headers = new Headers(request.headers);
  headers.set('Accept', 'application/json');
  const key = process.env.ETHNOS_API_KEY;
  if (key) headers.set('x-access-key', key);
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        cache: 'no-store',
        ...request,
        headers,
        signal: controller.signal
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
      if (attempt >= attempts - 1 || error instanceof ApiError) throw error;
      await wait(150);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
