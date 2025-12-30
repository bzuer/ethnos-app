import ListPageClient from './ListPageClient';
import { buildPageMetadata } from '@/i18n/metadata';

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return buildPageMetadata(props.params, 'metadata.lists');
}

export default function ListsPage() {
  return <ListPageClient />;
}
