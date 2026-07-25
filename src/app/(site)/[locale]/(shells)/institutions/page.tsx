import { getTranslations } from 'next-intl/server';
import InstitutionsList from './InstitutionsList';
import SectionTabs, { type SectionTabDescriptor } from '@/components/common/SectionTabs';
import { getInstitutionsPage } from '@/lib/endpoints';
import { buildPageMetadata } from '@/i18n/metadata';

export const dynamic = 'force-static';
export const revalidate = false;

const DEFAULT_LIMIT = 25;

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return buildPageMetadata(props.params, 'metadata.institutions', '/institutions');
}

export default async function InstitutionsPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  const [prominentData, citedData, hIndexData] = await Promise.all([
    getInstitutionsPage(1, DEFAULT_LIMIT, { sortBy: 'works_count', sortOrder: 'DESC' }).catch(() => null),
    getInstitutionsPage(1, DEFAULT_LIMIT, { sortBy: 'citations', sortOrder: 'DESC' }).catch(() => null),
    getInstitutionsPage(1, DEFAULT_LIMIT, { sortBy: 'h_index', sortOrder: 'DESC' }).catch(() => null)
  ]);
  const t = await getTranslations({ locale });

  const tabs: SectionTabDescriptor[] = [
    {
      key: 'prominent',
      label: t('institutions.listSections.prominent'),
      content: <InstitutionsList initialData={prominentData} initialPage={1} initialLimit={DEFAULT_LIMIT} sortBy="works_count" sortOrder="DESC" />
    },
    {
      key: 'cited',
      label: t('institutions.listSections.cited'),
      content: <InstitutionsList initialData={citedData} initialPage={1} initialLimit={DEFAULT_LIMIT} paginated={false} />
    },
    {
      key: 'hindex',
      label: t('institutions.listSections.hindex'),
      content: <InstitutionsList initialData={hIndexData} initialPage={1} initialLimit={DEFAULT_LIMIT} paginated={false} />
    }
  ];

  return (
    <div className="page-header" aria-labelledby="page-title">
      <h1 className="page-title" id="page-title">{t('institutions.title')}</h1>
      <SectionTabs ariaLabel={t('institutions.listSections.navLabel')} tabs={tabs} />
    </div>
  );
}
