import { buildPageMetadata } from '@/i18n/metadata';
import SearchResultsClient from './SearchResultsClient';

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return buildPageMetadata(props.params, 'metadata.searchResults');
}

export const dynamic = 'force-static';
export const revalidate = false;

export default async function SearchResultsPage(props: { params: Promise<{ locale: string }>; searchParams?: Promise<Record<string, string>> }) {
  const { locale } = await props.params;
  return (
    <SearchResultsClient locale={locale} />
  );
}
