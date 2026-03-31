import { buildPageMetadata } from '@/i18n/metadata';
import SearchResultsClient from './SearchResultsClient';

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return buildPageMetadata(props.params, 'metadata.searchResults', '/search/results');
}

export const dynamic = 'force-static';
export const revalidate = false;

export default async function SearchResultsPage() {
  return (
    <SearchResultsClient />
  );
}
