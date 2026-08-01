import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/i18n/metadata';
import { localizedPath } from '@/i18n/paths';
import type { Locale } from '@/i18n/config';
import SearchForm from '@/components/common/SearchForm';
import LocaleLink from '@/components/common/LocaleLink';

export const dynamic = 'force-static';
export const revalidate = false;

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return buildPageMetadata(props.params, 'metadata.search', '/search');
}

export default async function SearchPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  const searchAction = localizedPath(locale as Locale, '/search/results');
  const t = await getTranslations({ locale });
  return (
    <div className="page-header" aria-labelledby="page-title">
      <h1 className="page-title" id="page-title">{t('search.title')}</h1>
      <SearchForm action={searchAction} />

      <div className="action-links">
        <LocaleLink className="action-btn" href="/search/global">{t('searchGlobal.title')}</LocaleLink>
      </div>

      <section aria-labelledby="search-tips-section">
        <h2 className="title-section" id="search-tips-section">{t('search.tipsHeading')}</h2>
        <div className="search-tips">
          <p><strong>{t('search.tipPhrase')}</strong></p>
          <p><strong>{t('search.tipMultiple')}</strong></p>
          <p><strong>{t('search.tipExclude')}</strong></p>
          <p><strong>{t('search.tipAuthor')}</strong></p>
          <p><strong>{t('search.tipEmpty')}</strong></p>
        </div>
      </section>
    </div>
  );
}
