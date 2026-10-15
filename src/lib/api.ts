import 'server-only';

const API_BASE = 'http://127.0.0.1:1211';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function isMissingEntityError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 400);
}

async function buildApiError(res: Response) {
  let message = `HTTP ${res.status}`;
  try {
    const body: any = await res.json();
    if (typeof body?.message === 'string' && body.message) message = body.message;
  } catch {}
  return new ApiError(message, res.status);
}

export function unwrapData<T = any>(envelope: any): T | null {
  if (envelope === null || envelope === undefined) return null;
  if (typeof envelope === 'object' && 'data' in envelope) return (envelope.data as T) ?? null;
  return envelope as T;
}

export async function fetchJson<T>(path: string, init?: RequestInit & { timeoutMs?: number; attempts?: number }): Promise<T> {
  const { timeoutMs = 8000, attempts = 2, ...request } = init ?? {};
  const headers = new Headers(request.headers);
  headers.set('Accept', 'application/json');
  const key = process.env.ETHNOS_API_KEY;
  if (key) headers.set('x-access-key', key);
  for (let attempt = 1; ; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store', ...request, headers, signal: controller.signal });
      if (res.ok) return (await res.json()) as T;
      const error = await buildApiError(res);
      if (res.status !== 502 || attempt >= attempts) throw error;
    } catch (error) {
      if (error instanceof ApiError || attempt >= attempts) throw error;
    } finally {
      clearTimeout(timeout);
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}
