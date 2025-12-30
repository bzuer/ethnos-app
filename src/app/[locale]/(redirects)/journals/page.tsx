import { redirect } from '@/i18n/routing';
import { buildPageMetadata } from '@/i18n/metadata';

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return buildPageMetadata(props.params, 'metadata.venues');
}

export default async function JournalsRedirect(props: { params: Promise<{ locale: string }>, searchParams?: Promise<Record<string, string>> }) {
  const { locale } = await props.params;
  const sp = (await props.searchParams) || {};
  const qs = new URLSearchParams(sp).toString();
  redirect({ href: qs ? `/venues?${qs}` : '/venues', locale });
}
