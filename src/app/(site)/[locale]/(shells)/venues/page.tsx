import { getTranslations } from 'next-intl/server';
import VenuesList from './VenuesList';
import SectionTabs, { type SectionTabDescriptor } from '@/components/common/SectionTabs';
import { getVenuesPage } from '@/lib/endpoints';
import { buildPageMetadata } from '@/i18n/metadata';
import VenuesNotice from './VenuesNotice';

export const dynamic = 'force-static';
export const revalidate = false;

const DEFAULT_LIMIT = 25;

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return buildPageMetadata(props.params, 'metadata.venues', '/venues');
}

export default async function VenuesPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  const [bestData, prominentData, recentData, firstData] = await Promise.all([
    getVenuesPage(1, DEFAULT_LIMIT, { sortBy: 'score', sortOrder: 'DESC' }).catch(() => null),
    getVenuesPage(1, DEFAULT_LIMIT, { sortBy: 'cited_by_count', sortOrder: 'DESC' }).catch(() => null),
    getVenuesPage(1, DEFAULT_LIMIT, { sortBy: 'newest', type: 'JOURNAL' }).catch(() => null),
    getVenuesPage(1, DEFAULT_LIMIT, { sortBy: 'oldest', type: 'JOURNAL' }).catch(() => null)
  ]);
  const t = await getTranslations({ locale });

  const tabs: SectionTabDescriptor[] = [
    {
      key: 'best',
      label: t('venues.listSections.best'),
      content: <VenuesList initialData={bestData} initialPage={1} initialLimit={DEFAULT_LIMIT} sortBy="score" sortOrder="DESC" />
    },
    {
      key: 'prominent',
      label: t('venues.listSections.prominent'),
      content: <VenuesList initialData={prominentData} initialPage={1} initialLimit={DEFAULT_LIMIT} paginated={false} />
    },
    {
      key: 'recent',
      label: t('venues.listSections.recent'),
      content: <VenuesList initialData={recentData} initialPage={1} initialLimit={DEFAULT_LIMIT} paginated={false} />
    },
    {
      key: 'first',
      label: t('venues.listSections.first'),
      content: <VenuesList initialData={firstData} initialPage={1} initialLimit={DEFAULT_LIMIT} paginated={false} />
    }
  ];

  return (
    <div className="page-header" aria-labelledby="page-title">
      <h1 className="page-title" id="page-title">{t('venues.title')}</h1>
      <VenuesNotice />
      <SectionTabs ariaLabel={t('venues.listSections.navLabel')} tabs={tabs} />
    </div>
  );
}
