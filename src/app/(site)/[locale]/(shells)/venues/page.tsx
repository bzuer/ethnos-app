import { getTranslations } from 'next-intl/server';
import VenuesList from './VenuesList';
import SectionTabs, { type SectionTabDescriptor } from '@/components/common/SectionTabs';
import { getVenuesPage, type VenuesListFilters } from '@/lib/endpoints';
import { buildPageMetadata } from '@/i18n/metadata';
import { toVenueListPage, type VenueListPage } from '@/lib/venues';

export const dynamic = 'force-static';
export const revalidate = false;

const LIMIT = 25;
const EMPTY: VenueListPage = { items: [], page: 1, hasPrev: false, hasNext: false };

const loadPage = (filters: VenuesListFilters) =>
  getVenuesPage(1, LIMIT, filters).then(toVenueListPage).catch(() => EMPTY);

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return buildPageMetadata(props.params, 'metadata.venues', '/venues');
}

export default async function VenuesPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  const [best, prominent, recent, first] = await Promise.all([
    loadPage({ sortBy: 'score', sortOrder: 'DESC' }),
    loadPage({ sortBy: 'cited_by_count', sortOrder: 'DESC' }),
    loadPage({ sortBy: 'newest', type: 'JOURNAL' }),
    loadPage({ sortBy: 'oldest', type: 'JOURNAL' })
  ]);
  const t = await getTranslations({ locale });

  const tabs: SectionTabDescriptor[] = [
    {
      key: 'best',
      label: t('venues.listSections.best'),
      content: <VenuesList initial={best} limit={LIMIT} sortBy="score" sortOrder="DESC" paginated />
    },
    {
      key: 'prominent',
      label: t('venues.listSections.prominent'),
      content: <VenuesList initial={prominent} limit={LIMIT} />
    },
    {
      key: 'recent',
      label: t('venues.listSections.recent'),
      content: <VenuesList initial={recent} limit={LIMIT} />
    },
    {
      key: 'first',
      label: t('venues.listSections.first'),
      content: <VenuesList initial={first} limit={LIMIT} />
    }
  ];

  return (
    <div className="page-header" aria-labelledby="page-title">
      <h1 className="page-title" id="page-title">{t('venues.title')}</h1>
      <SectionTabs ariaLabel={t('venues.listSections.navLabel')} tabs={tabs} />
    </div>
  );
}
