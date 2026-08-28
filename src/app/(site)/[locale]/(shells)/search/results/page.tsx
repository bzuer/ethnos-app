import { NON_INDEXABLE_ROBOTS, buildPageMetadata } from '@/i18n/metadata';
import { localizedPath } from '@/i18n/paths';
import type { Locale } from '@/i18n/config';
import SearchResultsClient from './SearchResultsClient';

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return buildPageMetadata(props.params, 'metadata.searchResults', '/search/results', { robots: NON_INDEXABLE_ROBOTS });
}

export const dynamic = 'force-static';
export const revalidate = false;

export default async function SearchResultsPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  const formAction = localizedPath(locale as Locale, '/search/results');
  return (
    <SearchResultsClient formAction={formAction} />
  );
}
