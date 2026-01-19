const DEFAULT_LOCAL_API_BASE = process.env.NEXT_PUBLIC_DEV_API || 'http://127.0.0.1:1211';
const RATE_LIMIT_WINDOW_MS = Number(process.env.ETHNOS_RATE_LIMIT_WINDOW_MS || 60000);
const RATE_LIMIT_MAX = Number(process.env.ETHNOS_RATE_LIMIT_MAX || 1200);
const RATE_LIMIT_SUSPICIOUS_MAX = Number(process.env.ETHNOS_RATE_LIMIT_SUSPICIOUS_MAX || 120);
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

const API_BASE =
  process.env.ETHNOS_UPSTREAM_API ||
  process.env.NEXT_PUBLIC_DEV_API ||
  process.env.BACKEND_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  DEFAULT_LOCAL_API_BASE;

function normalize(base: string, path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const joined = `${(base || '').replace(/\/$/, '')}/${String(path || '').replace(/^\//, '')}`;
  return joined;
}

import { NextRequest } from 'next/server';

export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const rate = checkRateLimit(request);
  if (!rate.allowed) {
    const headers = new Headers();
    headers.set('content-type', 'application/json');
    headers.set('retry-after', String(rate.retryAfter));
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers });
  }
  const { path = [] } = await ctx.params;
  const parts = path || [];
  const pathname = `/${parts.join('/')}`;
  const srcUrl = new URL(request.url);
  const targetUrl = normalize(API_BASE, `${pathname}${srcUrl.search}`);
  const headers = new Headers();
  headers.set('accept', 'application/json');
  const key = process.env.ETHNOS_API_KEY;
  if (key) headers.set('x-access-key', key);
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), 98000);
  const res = await fetch(targetUrl, { method: 'GET', headers, cache: 'no-store', signal: controller.signal });
  clearTimeout(to);
  const body = await res.arrayBuffer();
  const outHeaders = new Headers();
  const ct = res.headers.get('content-type') || 'application/json';
  outHeaders.set('content-type', ct);
  return new Response(body, { status: res.status, headers: outHeaders });
}

function checkRateLimit(request: NextRequest) {
  const now = Date.now();
  const key = getClientKey(request);
  const bucket = rateBuckets.get(key);
  const limit = isSuspiciousRequest(request, key) ? RATE_LIMIT_SUSPICIOUS_MAX : RATE_LIMIT_MAX;
  if (!bucket || now >= bucket.resetAt) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    rateBuckets.set(key, { count: 1, resetAt });
    return { allowed: true, retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000) };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return { allowed: false, retryAfter };
  }
  return { allowed: true, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
}

function getClientKey(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for') || '';
  const realIp = request.headers.get('x-real-ip') || '';
  const ip = forwarded.split(',')[0].trim() || realIp || '';
  return ip || 'unknown';
}

function isSuspiciousRequest(request: NextRequest, key: string) {
  const userAgent = request.headers.get('user-agent') || '';
  if (!userAgent || userAgent.length < 8) return true;
  if (key === 'unknown') return true;
  return false;
}
