import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { defaultLocale, localePrefix, locales, type Locale } from './src/i18n/config';

const intlMiddleware = createMiddleware({
  defaultLocale,
  locales,
  localePrefix
});

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (shouldBypassIntl(pathname)) return NextResponse.next();
  const prefixed = hasLocalePrefix(pathname);
  const resolvedLocale = prefixed ? extractLocaleFromPath(pathname) ?? defaultLocale : detectPreferredLocale(request);
  if (!prefixed) {
    const url = request.nextUrl.clone();
    url.pathname = `/${resolvedLocale}${pathname === '/' ? '' : pathname}`;
    const response = NextResponse.rewrite(url);
    setLocaleHeaders(response, resolvedLocale);
    return response;
  }
  const response = intlMiddleware(request);
  setLocaleHeaders(response, resolvedLocale);
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

function hasLocalePrefix(pathname: string) {
  return locales.some((locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`));
}

function extractLocaleFromPath(pathname: string): Locale | undefined {
  const segment = pathname.split('/')[1];
  if (segment && locales.includes(segment as Locale)) return segment as Locale;
  return undefined;
}

function setLocaleHeaders(response: NextResponse, locale: Locale) {
  response.headers.set('x-next-intl-locale', locale);
  const existingVary = response.headers.get('vary');
  const values = new Set((existingVary ? existingVary.split(',') : []).map((entry) => entry.trim()).filter(Boolean));
  values.add('accept-language');
  values.add('cookie');
  response.headers.set('vary', Array.from(values).join(', '));
}

function shouldBypassIntl(pathname: string) {
  const normalized = pathname.toLowerCase();
  if (normalized === '/robots.txt' || normalized === '/sitemap.xml' || normalized === '/site.webmanifest') return true;
  if (normalized.startsWith('/icons/') || normalized.startsWith('/screenshots/')) return true;
  if (normalized.startsWith('/css/')) return true;
  if (normalized.startsWith('/android-chrome-') || normalized.startsWith('/apple-touch-icon') || normalized.startsWith('/favicon')) return true;
  if (/\.(png|jpg|jpeg|svg|ico|json|webmanifest|txt|css)$/i.test(normalized)) return true;
  return false;
}

export const config = {
  matcher: ['/', '/((?!api|_next/static|_next/image|favicon.ico).*)']
};
