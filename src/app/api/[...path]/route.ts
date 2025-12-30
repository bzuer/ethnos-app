const DEFAULT_LOCAL_API_BASE = process.env.NEXT_PUBLIC_DEV_API || 'http://127.0.0.1:3000';

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
