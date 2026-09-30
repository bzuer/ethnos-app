import { NextRequest, NextResponse } from 'next/server';
import { defaultLocale, locales, type Locale } from './i18n/config';

const MAINTENANCE_RETRY_AFTER = '3600';

function isMaintenanceMode() {
  const flag = process.env.MAINTENANCE_MODE;
  if (!flag) return false;
  const normalized = flag.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes';
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (shouldBypassIntl(pathname)) return NextResponse.next();
  const pathLocale = extractLocaleFromPath(pathname);
  const resolvedLocale = pathLocale ?? detectPreferredLocale(request);
  if (isMaintenanceMode() && !isMaintenanceTarget(pathname)) {
    return buildMaintenanceResponse(request, resolvedLocale);
  }
  const barePath = pathLocale ? stripLocale(pathname) : pathname;
  if (pathLocale === defaultLocale) {
    return canonicalRedirect(request, barePath);
  }
  if (!pathLocale && resolvedLocale !== defaultLocale && isReadRequest(request)) {
    return negotiatedRedirect(request, resolvedLocale);
  }
  const locale = pathLocale ?? resolvedLocale;
  const internalPath = `/${locale}${barePath}`.replace(/\/$/, '');
  const target = internalPath || `/${locale}`;
  const response = target === pathname
    ? NextResponse.next()
    : NextResponse.rewrite(rewriteUrl(request, target));
  setLocaleHeaders(response, locale, !pathLocale);
  return response;
}

function isReadRequest(request: NextRequest) {
  return request.method === 'GET' || request.method === 'HEAD';
}

function rewriteUrl(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return url;
}

function prefixPath(locale: Locale | undefined, path: string) {
  if (!locale || locale === defaultLocale) return path;
  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}

function stripLocale(pathname: string) {
  const rest = pathname.replace(/^\/[^/]+/, '');
  return rest || '/';
}

function canonicalRedirect(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  const response = NextResponse.redirect(url, 308);
  response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return response;
}

function negotiatedRedirect(request: NextRequest, locale: Locale) {
  const url = request.nextUrl.clone();
  url.pathname = prefixPath(locale, request.nextUrl.pathname);
  const response = NextResponse.redirect(url, 307);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Vary', 'Cookie, Accept-Language');
  return response;
}

function isMaintenanceTarget(pathname: string) {
  if (pathname === '/maintenance' || pathname.startsWith('/maintenance/')) return true;
  return locales.some((locale) => pathname === `/${locale}/maintenance` || pathname.startsWith(`/${locale}/maintenance/`));
}

function buildMaintenanceResponse(request: NextRequest, locale: Locale) {
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}/maintenance`;
  url.search = '';
  const response = NextResponse.rewrite(url, { status: 503 });
  response.headers.set('Retry-After', MAINTENANCE_RETRY_AFTER);
  response.headers.set('Cache-Control', 'no-store');
  setLocaleHeaders(response, locale, false);
  return response;
}

function detectPreferredLocale(request: NextRequest): Locale {
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  if (cookieLocale && locales.includes(cookieLocale as Locale)) return cookieLocale as Locale;
  const headerLocale = resolveLocaleFromHeader(request.headers.get('accept-language'));
  if (headerLocale) return headerLocale;
  return defaultLocale;
}

function resolveLocaleFromHeader(value: string | null): Locale | undefined {
  if (!value) return undefined;
  const preferences = value
    .split(',')
    .map((part) => {
      const [tag, weight] = part.trim().split(';q=');
      const score = weight ? parseFloat(weight) : 1;
      return { tag: tag.toLowerCase(), score: Number.isFinite(score) ? score : 0 };
    })
    .sort((a, b) => b.score - a.score);
  for (const preference of preferences) {
    const base = preference.tag.split('-')[0];
    if (locales.includes(base as Locale)) return base as Locale;
  }
  return undefined;
}

function extractLocaleFromPath(pathname: string): Locale | undefined {
  const segment = pathname.split('/')[1];
  if (segment && locales.includes(segment as Locale)) return segment as Locale;
  return undefined;
}

function setLocaleHeaders(response: NextResponse, locale: Locale, negotiated: boolean) {
  response.headers.set('x-next-intl-locale', locale);
  if (!negotiated) return;
  const existingVary = response.headers.get('vary');
  const values = new Set((existingVary ? existingVary.split(',') : []).map((entry) => entry.trim()).filter(Boolean));
  values.add('accept-language');
  values.add('cookie');
  response.headers.set('vary', Array.from(values).join(', '));
}

function shouldBypassIntl(pathname: string) {
  const normalized = pathname.toLowerCase();
  if (normalized === '/robots.txt' || normalized === '/sitemap.xml' || normalized === '/site.webmanifest') return true;
  if (normalized.startsWith('/sitemaps/')) return true;
  if (normalized.startsWith('/icons/') || normalized.startsWith('/screenshots/')) return true;
  if (normalized.startsWith('/css/')) return true;
  if (normalized.startsWith('/android-chrome-') || normalized.startsWith('/apple-touch-icon') || normalized.startsWith('/favicon')) return true;
  if (/\.(png|jpg|jpeg|svg|ico|json|webmanifest|xml|txt|css)$/i.test(normalized)) return true;
  return false;
}

export const config = {
  matcher: ['/', '/((?!_next/static|_next/image|favicon.ico).*)']
};
