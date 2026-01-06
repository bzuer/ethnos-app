import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { locales, type Locale } from './config';
import { localizedPath } from './paths';

const safeTranslate = (translate: (path: string) => string, path: string) => {
  try {
    return translate(path);
  } catch {
    return undefined;
  }
};

export async function buildPageMetadata(params: Promise<{ locale: string }>, key: string, path?: string): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const normalizedKey = key.startsWith('metadata.') ? key.slice('metadata.'.length) : key;
  const title = safeTranslate(t, `${normalizedKey}.title`) || safeTranslate(t, normalizedKey);
  const description = safeTranslate(t, `${normalizedKey}.description`);
  const keywordsRaw = safeTranslate(t, `${normalizedKey}.keywords`);
  const keywords = keywordsRaw
    ? keywordsRaw.split(',').map((kw) => kw.trim()).filter(Boolean)
    : undefined;
  const safeLocale = locale as Locale;
  const alternates = path
    ? {
        canonical: localizedPath(safeLocale, path),
        languages: locales.reduce<Record<string, string>>((acc, code) => {
          acc[code] = localizedPath(code, path);
          return acc;
        }, {})
      }
    : undefined;

  return {
    title,
    description,
    keywords: keywords && keywords.length > 0 ? keywords : undefined,
    alternates
  };
}
