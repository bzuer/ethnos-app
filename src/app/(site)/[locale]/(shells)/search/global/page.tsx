import { NON_INDEXABLE_ROBOTS, buildPageMetadata } from '@/i18n/metadata';
import { localizedPath } from '@/i18n/paths';
import type { Locale } from '@/i18n/config';
import SearchGlobalClient from './SearchGlobalClient';

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return buildPageMetadata(props.params, 'metadata.searchGlobal', '/search/global', { robots: NON_INDEXABLE_ROBOTS });
}

export const dynamic = 'force-static';
export const revalidate = false;

export default async function SearchGlobalPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  const formAction = localizedPath(locale as Locale, '/search/global');
  return <SearchGlobalClient formAction={formAction} />;
}
