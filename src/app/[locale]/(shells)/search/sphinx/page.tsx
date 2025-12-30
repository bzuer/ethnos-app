import { buildPageMetadata } from '@/i18n/metadata';
import SearchSphinxClient from './SearchSphinxClient';

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return buildPageMetadata(props.params, 'metadata.searchSphinx');
}

export const dynamic = 'force-static';
export const revalidate = false;

export default async function SearchSphinxPage(props: { params: Promise<{ locale: string }>, searchParams?: Promise<Record<string, string>> }) {
  const { locale } = await props.params;
  return (
    <SearchSphinxClient locale={locale} />
  );
}
