import { getTranslations } from 'next-intl/server';
import VenuesList from './VenuesList';
import { getVenuesPage } from '@/lib/endpoints';
import { buildPageMetadata } from '@/i18n/metadata';

export const dynamic = 'force-static';
export const revalidate = false;

const DEFAULT_LIMIT = 25;

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return buildPageMetadata(props.params, 'metadata.venues');
}

export default async function VenuesPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  let initialData: any = null;
  try {
    initialData = await getVenuesPage(1, DEFAULT_LIMIT);
  } catch {}
  const t = await getTranslations({ locale });
  return (
    <div className="page-header" aria-labelledby="page-title">
      <h1 className="page-title" id="page-title">{t('venues.title')}</h1>
      <section aria-labelledby="journals-list">
        <h2 className="title-section" id="journals-list">{t('venues.listHeading')}</h2>
        <VenuesList initialData={initialData} initialPage={1} initialLimit={DEFAULT_LIMIT} />
      </section>
    </div>
  );
}
