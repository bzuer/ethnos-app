import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { defaultLocale, locales, type Locale } from './config';
import { localizedPath } from './paths';
import {
  SITE_NAME,
  SITE_OG_IMAGE_HEIGHT,
  SITE_OG_IMAGE_PATH,
  SITE_OG_IMAGE_WIDTH,
  SITE_ORIGIN,
  absoluteUrl,
  alternateUrls,
  localeUrl,
  withQuery
} from '@/lib/site';

export type PageMetadataOptions = {
  robots?: Metadata['robots'];
  query?: Record<string, string | number | undefined | null>;
  ogType?: 'website' | 'article' | 'profile' | 'book';
  absoluteTitle?: boolean;
};

const safeTranslate = (translate: (path: string) => string, path: string) => {
  try {
    return translate(path);
  } catch {
    return undefined;
  }
};

export const metadataBase = new URL(SITE_ORIGIN);

export const openGraphLocales: Record<Locale, string> = {
  en: 'en_US',
  pt: 'pt_BR',
  es: 'es_ES'
};

export const INDEXABLE_ROBOTS: Metadata['robots'] = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
    'max-video-preview': -1
  }
};

export const NON_INDEXABLE_ROBOTS: Metadata['robots'] = {
  index: false,
  follow: true,
  googleBot: {
    index: false,
    follow: true
  }
};

export const siteIcons: Metadata['icons'] = {
  icon: [
    { url: '/favicon.ico', sizes: 'any' },
    { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
    { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' }
  ],
  shortcut: ['/favicon.ico'],
  apple: [{ url: '/apple-touch-icon.png', type: 'image/png', sizes: '180x180' }]
};

export function siteOpenGraphImage(alt = 'Ethnos Bibliography catalog interface') {
  return {
    url: absoluteUrl(SITE_OG_IMAGE_PATH),
    width: SITE_OG_IMAGE_WIDTH,
    height: SITE_OG_IMAGE_HEIGHT,
    type: 'image/png',
    alt
  };
}

export function manifestPath(locale: Locale) {
  return localizedPath(locale, '/site.webmanifest');
}

export function siteVerification(): Metadata['verification'] | undefined {
  const google = process.env.SEO_GOOGLE_SITE_VERIFICATION?.trim();
  const yandex = process.env.SEO_YANDEX_SITE_VERIFICATION?.trim();
  const bing = process.env.SEO_BING_SITE_VERIFICATION?.trim();
  const verification: Metadata['verification'] = {};
  if (google) verification.google = google;
  if (yandex) verification.yandex = yandex;
  if (bing) verification.other = { 'msvalidate.01': bing };
  return Object.keys(verification).length ? verification : undefined;
}

export function alternateOpenGraphLocales(locale: Locale) {
  return locales.filter((code) => code !== locale).map((code) => openGraphLocales[code]);
}

export function resolveLocale(locale: string): Locale {
  return locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
}

const toKeywords = (value?: string) => (value ? value.split(',').map((kw) => kw.trim()).filter(Boolean) : undefined);

export const buildLanguageAlternates = (path: string) => alternateUrls(path);

export async function buildPageMetadata(
  params: Promise<{ locale: string }>,
  key: string,
  path?: string,
  options?: PageMetadataOptions
): Promise<Metadata> {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const t = await getTranslations({ locale: safeLocale, namespace: 'metadata' });
  const normalizedKey = key.startsWith('metadata.') ? key.slice('metadata.'.length) : key;
  const rawTitle = safeTranslate(t, `${normalizedKey}.title`) || safeTranslate(t, normalizedKey);
  const description = safeTranslate(t, `${normalizedKey}.description`);
  const keywords = toKeywords(safeTranslate(t, `${normalizedKey}.keywords`));
  const canonicalPath = path ? withQuery(path, options?.query) : undefined;
  const canonical = canonicalPath ? localeUrl(safeLocale, canonicalPath) : undefined;
  const alternates = canonicalPath
    ? {
        canonical,
        languages: buildLanguageAlternates(canonicalPath)
      }
    : undefined;
  const ogLocale = openGraphLocales[safeLocale];
  const image = siteOpenGraphImage();
  const title = rawTitle && options?.absoluteTitle ? { absolute: rawTitle } : rawTitle;

  return {
    metadataBase,
    title,
    description,
    keywords: keywords && keywords.length > 0 ? keywords : undefined,
    alternates,
    icons: siteIcons,
    manifest: manifestPath(safeLocale),
    robots: options?.robots ?? INDEXABLE_ROBOTS,
    verification: siteVerification(),
    openGraph: canonical
      ? {
          type: options?.ogType ?? 'website',
          locale: ogLocale,
          alternateLocale: alternateOpenGraphLocales(safeLocale),
          url: canonical,
          title: rawTitle || undefined,
          description,
          siteName: SITE_NAME,
          images: [image]
        }
      : undefined,
    twitter: {
      card: 'summary_large_image',
      title: rawTitle || undefined,
      description,
      images: [image.url]
    }
  };
}
