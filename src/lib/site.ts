import { defaultLocale, locales, type Locale } from '@/i18n/config';
import { localizedPath } from '@/i18n/paths';

export const SITE_ORIGIN = 'https://ethnos.app';
export const SITE_NAME = 'Ethnos Bibliography';
export const SITE_PUBLISHER = 'Ethnos Research Lab';
export const SITE_REPOSITORY = 'https://github.com/bzuer/ethnos-app';
export const SITE_OG_IMAGE_PATH = '/og-default.png';
export const SITE_OG_IMAGE_WIDTH = 1200;
export const SITE_OG_IMAGE_HEIGHT = 630;
export const SITE_LOGO_PATH = '/android-chrome-512x512.png';
export const SITE_THEME_COLOR = '#f5f5f4';
export const SITE_THEME_COLOR_DARK = '#121212';

export function absoluteUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

export function localeUrl(locale: Locale, path: string) {
  return absoluteUrl(localizedPath(locale, path));
}

export function withQuery(path: string, query?: Record<string, string | number | undefined | null>) {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `${path}?${serialized}` : path;
}

export function alternateUrls(path: string) {
  const languages: Record<string, string> = {};
  for (const code of locales) {
    languages[code] = localeUrl(code, path);
  }
  languages['x-default'] = localeUrl(defaultLocale, path);
  return languages;
}

export function resolvePageParam(value?: string | string[] | null) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

export function paginatedPath(path: string, page: number) {
  return page > 1 ? withQuery(path, { page }) : path;
}
