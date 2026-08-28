import { locales, type Locale } from '@/i18n/config';
import { buildWebManifest, manifestResponse } from '@/lib/manifest';

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function GET(_request: Request, context: { params: Promise<{ locale: string }> }) {
  const { locale } = await context.params;
  if (!locales.includes(locale as Locale)) {
    return new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  return manifestResponse(await buildWebManifest(locale as Locale));
}
