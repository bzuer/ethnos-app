import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

const safeTranslate = (translate: (path: string) => string, path: string) => {
  try {
    return translate(path);
  } catch {
    return undefined;
  }
};

export async function buildPageMetadata(params: Promise<{ locale: string }>, key: string): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const normalizedKey = key.startsWith('metadata.') ? key.slice('metadata.'.length) : key;
  const title = safeTranslate(t, `${normalizedKey}.title`) || safeTranslate(t, normalizedKey);
  const description = safeTranslate(t, `${normalizedKey}.description`);
  const keywordsRaw = safeTranslate(t, `${normalizedKey}.keywords`);
  const keywords = keywordsRaw
    ? keywordsRaw.split(',').map((kw) => kw.trim()).filter(Boolean)
    : undefined;

  return {
    title,
    description,
    keywords: keywords && keywords.length > 0 ? keywords : undefined
  };
}
