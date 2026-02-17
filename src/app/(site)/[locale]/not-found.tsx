import { useTranslations } from 'next-intl';
import LocaleLink from '@/components/common/LocaleLink';

export default function NotFound() {
  const t = useTranslations();
  return (
    <div className="page-header" aria-labelledby="page-title">
      <h1 className="page-title" id="page-title">{t('notFound.title')}</h1>
      <section aria-labelledby="not-found-info">
        <h2 className="title-section" id="not-found-info">{t('notFound.info')}</h2>
        <p className="description">{t('notFound.description')}</p>
        <div className="action-links">
          <LocaleLink href="/" className="action-btn btn-positive">{t('notFound.goHome')}</LocaleLink>
        </div>
      </section>
    </div>
  );
}
