import ListPageClient from './ListPageClient';
import { NON_INDEXABLE_ROBOTS, buildPageMetadata } from '@/i18n/metadata';

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return buildPageMetadata(props.params, 'metadata.lists', '/lists', { robots: NON_INDEXABLE_ROBOTS });
}

export default function ListsPage() {
  return <ListPageClient />;
}
