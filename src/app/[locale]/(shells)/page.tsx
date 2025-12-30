import { getTranslations } from 'next-intl/server';
import LocaleLink from '@/components/common/LocaleLink';
import { getHomeRecentWorks, getHomeTopVenues } from '@/lib/endpoints';
import { buildPageMetadata } from '@/i18n/metadata';
import { localizedPath } from '@/i18n/paths';
import type { Locale } from '@/i18n/config';

export const dynamic = 'force-static';
export const revalidate = false;

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return buildPageMetadata(props.params, 'metadata.home');
}

export default async function HomePage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  const searchAction = localizedPath(locale as Locale, '/search/results');
  const [recent, venues] = await loadHomeData();
  const t = await getTranslations({ locale });
  return (
    <div className="page-header" aria-labelledby="page-title">
      <h1 className="page-title" id="page-title">{t('home.title')}</h1>
      <section aria-labelledby="search-section">
        <h2 className="title-section" id="search-section">{t('home.searchSection')}</h2>
        <form className="search-form" role="search" action={searchAction} method="get" id="search-form">
          <div className="search-input-container">
            <div className="search-input-wrapper">
              <input className="form-input" type="search" id="search-input" name="q" placeholder={t('common.placeholders.homeSearch')} aria-label={t('common.aria.searchInput')} autoComplete="off" />
            </div>
          </div>
          <button className="search-btn btn-positive" type="submit" aria-label={t('common.aria.searchButton')}>{t('common.actions.search')}</button>
        </form>
      </section>

      <section aria-labelledby="recent-updates" id="recent-items-section">
        <h2 className="title-section" id="recent-updates">{t('home.updatesSection')}</h2>
        <div className="recent-items-container">
          <table className="data-table recent-items-table" aria-describedby="recent-updates">
            <caption className="sr-only">{t('home.updatesCaption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('common.table.title')}</th>
                <th scope="col">{t('common.table.authors')}</th>
                <th scope="col">{t('common.table.year')}</th>
              </tr>
            </thead>
            <tbody>
              {recent.slice(0, 10).map((w: any) => {
                const authorsArr = Array.isArray(w.authors_preview) ? w.authors_preview : [];
                const authors = authorsArr.slice(0, 2).join(', ') + (w.author_count && w.author_count > 2 ? ' et al.' : '');
                const year = w.publication_year || (w.publication && w.publication.year) || w.year || '';
                return (
                  <tr key={w.id}>
                    <td className="field-value"><LocaleLink className="action-link table-link" href={`/works/${w.id}`}>{w.title || t('common.entities.titleUnavailable')}</LocaleLink></td>
                    <td className="field-value">{authors || t('common.entities.authorUnknown')}</td>
                    <td className="field-value">{year}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="action-links">
            <LocaleLink href="/search/results" className="action-btn btn-positive">{t('common.actions.browseWorks')}</LocaleLink>
          </div>
        </div>
      </section>

      <section aria-labelledby="venues-list" id="venues-section">
        <h2 className="title-section" id="venues-list">{t('home.venuesSection')}</h2>
        <div className="venues-container">
          <table className="data-table homepage-venues-table" aria-describedby="venues-list">
            <caption className="sr-only">{t('home.venuesCaption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('common.table.journal')}</th>
                <th scope="col">{t('common.table.publisher')}</th>
                <th scope="col">{t('common.table.coverage')}</th>
              </tr>
            </thead>
            <tbody>
              {venues.slice(0, 25).map((v: any) => (
                <tr key={v.id}>
                  <td className="field-value"><LocaleLink className="action-link table-link" href={`/venues/${v.id}`}>{v.name || t('common.entities.nameUnavailable')}</LocaleLink></td>
                  <td className="field-value">{(v.publisher && v.publisher.name) || t('common.entities.publisherUnknown')}</td>
                  <td className="field-value">{v.coverage_start_year && v.coverage_end_year ? `${v.coverage_start_year}-${v.coverage_end_year}` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="action-links">
            <LocaleLink href="/venues" className="action-btn btn-positive">{t('common.actions.seeJournals')}</LocaleLink>
          </div>
        </div>
      </section>
    </div>
  );
}

async function loadHomeData(): Promise<[any[], any[]]> {
  const [recent, venues] = await Promise.all([
    getHomeRecentWorks(20).catch(() => []),
    getHomeTopVenues(15, 1).catch(() => [])
  ]);
  return [
    Array.isArray(recent) ? recent : [],
    Array.isArray(venues) ? venues : []
  ];
}
