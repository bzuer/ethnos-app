import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/i18n/metadata';
import { localizedPath } from '@/i18n/paths';
import type { Locale } from '@/i18n/config';
import SearchNotice from './SearchNotice';
import SearchFormClient from './SearchFormClient';

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
      <SearchNotice />
      <form action={searchAction} method="get" role="search" aria-label={t('common.meta.ariaSearchForm')}>
        <fieldset className="figure-plate">
          <legend className="form-label">{t('search.textLegend')}</legend>
          <div>
            <label className="form-label" htmlFor="q">{t('common.labels.term')}</label>
            <SearchFormClient inputId="q" inputName="q" placeholder={t('common.placeholders.quickTerm')} />
          </div>
          <div className="search-filters">
            <div className="filter-label">
              <label className="form-label" htmlFor="author">{t('common.labels.author')}</label>
              <input className="form-input" type="text" id="author" name="author" placeholder={t('common.placeholders.person')} />
            </div>
            <div className="filter-label">
              <label className="form-label" htmlFor="venue">{t('common.labels.venue')}</label>
              <input className="form-input" type="text" id="venue" name="venue" placeholder={t('common.placeholders.venue')} />
            </div>
            <div className="filter-label">
              <label className="form-label" htmlFor="subject">{t('common.labels.subject')}</label>
              <input className="form-input" type="text" id="subject" name="subject" placeholder={t('common.placeholders.subject')} />
            </div>
          </div>
        </fieldset>

        <fieldset className="figure-plate">
          <legend className="form-label">{t('search.filtersLegend')}</legend>
          <div className="search-filters">
            <div className="filter-label">
              <label className="form-label" htmlFor="work_type">{t('common.labels.type')}</label>
              <select className="form-input" id="work_type" name="work_type" defaultValue="">
                <option value="">{t('common.options.any')}</option>
                <option value="ARTICLE">ARTICLE</option>
                <option value="BOOK">BOOK</option>
                <option value="CHAPTER">CHAPTER</option>
                <option value="CONFERENCE">CONFERENCE</option>
                <option value="REPORT">REPORT</option>
                <option value="THESIS">THESIS</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>
            <div className="filter-label">
              <label className="form-label" htmlFor="language">{t('common.labels.language')}</label>
              <input className="form-input" type="text" id="language" name="language" placeholder={t('common.placeholders.language')} />
            </div>
            <div className="filter-label">
              <label className="form-label" htmlFor="year_from">{t('common.labels.yearFrom')}</label>
              <input className="form-input" type="number" id="year_from" name="year_from" placeholder={t('common.placeholders.yearFrom')} />
            </div>
            <div className="filter-label">
              <label className="form-label" htmlFor="year_to">{t('common.labels.yearTo')}</label>
              <input className="form-input" type="number" id="year_to" name="year_to" placeholder={t('common.placeholders.yearTo')} />
            </div>
            <div className="filter-label">
              <label className="form-label" htmlFor="peer_reviewed">{t('common.labels.peerReviewed')}</label>
              <select className="form-input" id="peer_reviewed" name="peer_reviewed" defaultValue="">
                <option value="">{t('common.options.any')}</option>
                <option value="true">{t('common.values.yes')}</option>
                <option value="false">{t('common.values.no')}</option>
              </select>
            </div>
            <div className="filter-label">
              <label className="form-label" htmlFor="open_access">{t('common.labels.openAccess')}</label>
              <select className="form-input" id="open_access" name="open_access" defaultValue="">
                <option value="">{t('common.options.any')}</option>
                <option value="true">{t('common.values.yes')}</option>
                <option value="false">{t('common.values.no')}</option>
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset className="figure-plate">
          <legend className="form-label">{t('search.parametersLegend')}</legend>
          <div className="search-filters">
            <div className="filter-label">
              <label className="form-label" htmlFor="limit">{t('common.labels.itemsPerPage')}</label>
              <select className="form-input" id="limit" name="limit" defaultValue="20">
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </div>
          </div>
        </fieldset>

        <div className="search-controls">
          <button className="action-btn btn-negative" type="reset">{t('common.actions.clear')}</button>
          <button className="action-btn btn-positive" type="submit">{t('common.actions.runSearch')}</button>
        </div>
      </form>

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
