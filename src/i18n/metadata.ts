import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { defaultLocale, locales, type Locale } from './config';
import { localizedPath } from './paths';

const safeTranslate = (translate: (path: string) => string, path: string) => {
  try {
    return translate(path);
  } catch {
    return undefined;
  }
};

export const metadataBase = new URL('https://ethnos.app');

export const openGraphLocales: Record<Locale, string> = {
  en: 'en_US',
  pt: 'pt_BR',
  es: 'es_ES'
};

const toKeywords = (value?: string) => (value ? value.split(',').map((kw) => kw.trim()).filter(Boolean) : undefined);

export const buildLanguageAlternates = (path: string) => {
  const languages: Record<string, string> = {
    'x-default': new URL(localizedPath(defaultLocale, path), metadataBase).toString()
  };
  locales.forEach((code) => {
    languages[code] = new URL(localizedPath(code, path), metadataBase).toString();
  });
  return languages;
};

export async function buildPageMetadata(params: Promise<{ locale: string }>, key: string, path?: string): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const normalizedKey = key.startsWith('metadata.') ? key.slice('metadata.'.length) : key;
  const title = safeTranslate(t, `${normalizedKey}.title`) || safeTranslate(t, normalizedKey);
  const description = safeTranslate(t, `${normalizedKey}.description`);
  const keywords = toKeywords(safeTranslate(t, `${normalizedKey}.keywords`));
  const safeLocale = locale as Locale;
  const canonical = path ? new URL(localizedPath(safeLocale, path), metadataBase).toString() : undefined;
  const alternates = path
    ? {
        canonical,
        languages: buildLanguageAlternates(path)
      }
    : undefined;
  const imageUrl = new URL('/og-default.png', metadataBase).toString();
  const ogLocale = openGraphLocales[safeLocale] || openGraphLocales[defaultLocale];
  const alternateLocale = locales.filter((code) => code !== safeLocale).map((code) => openGraphLocales[code]);

  return {
    metadataBase,
    title,
    description,
    keywords: keywords && keywords.length > 0 ? keywords : undefined,
    alternates,
    openGraph: canonical
      ? {
          type: 'website',
          locale: ogLocale,
          alternateLocale,
          url: canonical,
          title: title || undefined,
          description,
          siteName: 'Ethnos Bibliography',
          images: [
            {
              url: imageUrl,
              width: 1200,
              height: 630,
              alt: 'Ethnos Bibliography catalog interface'
            }
          ]
        }
      : undefined,
    twitter: {
      card: 'summary_large_image',
      title: title || undefined,
      description,
      images: [imageUrl]
    }
  };
}
