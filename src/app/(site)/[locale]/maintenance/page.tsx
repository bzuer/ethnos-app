import { getTranslations } from 'next-intl/server';
import { NON_INDEXABLE_ROBOTS, buildPageMetadata } from '@/i18n/metadata';

export const dynamic = 'force-static';
export const revalidate = false;

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return buildPageMetadata(props.params, 'metadata.maintenance', '/maintenance', { robots: NON_INDEXABLE_ROBOTS });
}

export default async function MaintenancePage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'maintenance' });
  const email = t('contactEmail');
  return (
    <div className="page-header" aria-labelledby="page-title">
      <h1 className="page-title" id="page-title">{t('heading')}</h1>
      <section aria-labelledby="maintenance-info">
        <h2 className="title-section" id="maintenance-info">{t('info')}</h2>
        <div className="info-box">
          <p className="description">{t('description')}</p>
          <p className="description">{t('tryAgain')}</p>
          <p className="description">
            {t('contact')} <a href={`mailto:${email}`}>{email}</a>
          </p>
        </div>
      </section>
    </div>
  );
}
