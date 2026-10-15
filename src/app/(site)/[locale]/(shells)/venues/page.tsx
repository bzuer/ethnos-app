import { getTranslations } from 'next-intl/server';
import VenuesList from './VenuesList';
import SectionTabs, { type SectionTabDescriptor } from '@/components/common/SectionTabs';
import { getVenuesPage, type VenuesListFilters } from '@/lib/endpoints';
import { buildPageMetadata } from '@/i18n/metadata';
import { toVenueListPage, type VenueListPage } from '@/lib/venues';

export const dynamic = 'force-static';
export const revalidate = false;

const EMPTY: VenueListPage = { items: [], page: 1, hasNext: false };

const loadPage = (filters?: VenuesListFilters) =>
  getVenuesPage(1, filters).then(toVenueListPage).catch(() => EMPTY);

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return buildPageMetadata(props.params, 'metadata.venues', '/venues');
}

export default async function VenuesPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  const [best, prominent, recent, first] = await Promise.all([
    loadPage(),
    loadPage({ sortBy: 'cited_by_count' }),
    loadPage({ sortBy: 'newest', type: 'JOURNAL' }),
    loadPage({ sortBy: 'oldest', type: 'JOURNAL' })
  ]);
  const t = await getTranslations({ locale });

  const tabs: SectionTabDescriptor[] = [
    {
      key: 'best',
      label: t('venues.listSections.best'),
      content: <VenuesList initial={best} paginated />
    },
    {
      key: 'prominent',
      label: t('venues.listSections.prominent'),
      content: <VenuesList initial={prominent} />
    },
    {
      key: 'recent',
      label: t('venues.listSections.recent'),
      content: <VenuesList initial={recent} />
    },
    {
      key: 'first',
      label: t('venues.listSections.first'),
      content: <VenuesList initial={first} />
    }
  ];

  return (
    <div className="page-header" aria-labelledby="page-title">
      <h1 className="page-title" id="page-title">{t('venues.title')}</h1>
      <SectionTabs ariaLabel={t('venues.listSections.navLabel')} tabs={tabs} />
    </div>
  );
}
