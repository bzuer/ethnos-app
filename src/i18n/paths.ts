import { defaultLocale, type Locale } from './config';

export function localizedPath(locale: Locale, path: string): string {
  if (!path.startsWith('/')) path = `/${path}`;
  if (locale === defaultLocale) return path;
  if (path === '/') return `/${locale}`;
  return `/${locale}${path}`;
}
