import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/i18n/metadata';
import { localizedPath } from '@/i18n/paths';
import type { Locale } from '@/i18n/config';

export const dynamic = 'force-static';
export const revalidate = false;

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return buildPageMetadata(props.params, 'metadata.search');
}

export default async function SearchPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  const searchAction = localizedPath(locale as Locale, '/search/results');
  const t = await getTranslations({ locale });
  return (
    <div className="page-header" aria-labelledby="page-title">
      <h1 className="page-title" id="page-title">{t('search.title')}</h1>
      <section aria-labelledby="search-form-section">
        <h2 className="title-section" id="search-form-section">{t('search.quick')}</h2>
        <form action={searchAction} method="get" role="search" aria-label={t('common.meta.ariaSearchForm')}>
          <fieldset className="figure-plate">
            <legend className="form-label">{t('search.queryLegend')}</legend>
            <div>
              <label className="form-label" htmlFor="q">{t('common.labels.term')}</label>
              <div className="search-input-wrapper">
                <input className="form-input" type="text" id="q" name="q" placeholder={t('common.placeholders.quickTerm')} autoComplete="off" />
              </div>
              <label className="form-label" htmlFor="scope">{t('common.labels.scope')}</label>
              <select className="form-input" id="scope" name="scope" defaultValue="works">
                <option value="works">{t('common.options.works')}</option>
                <option value="venues">{t('common.options.venues')}</option>
                <option value="persons">{t('common.options.persons')}</option>
              </select>
              <label className="form-label" htmlFor="limit">{t('common.labels.itemsPerPage')}</label>
              <select className="form-input" id="limit" name="limit" defaultValue="20">
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </div>
          </fieldset>
          <div className="search-controls">
            <button className="action-btn btn-negative" type="reset">{t('common.actions.clear')}</button>
            <button className="action-btn btn-positive" type="submit">{t('common.actions.runSearch')}</button>
          </div>
        </form>
      </section>

      <section aria-labelledby="advanced-search-section">
        <h2 className="title-section" id="advanced-search-section">{t('search.advanced')}</h2>
        <form action={searchAction} method="get" role="search" aria-label={t('common.meta.ariaAdvancedSearchForm')}>
          <fieldset className="figure-plate">
            <legend className="form-label">{t('search.parametersLegend')}</legend>
            <div>
              <label className="form-label" htmlFor="q-adv">{t('common.labels.term')}</label>
              <div className="search-input-wrapper">
                <input className="form-input" type="text" id="q-adv" name="q" placeholder={t('common.placeholders.advancedTerm')} autoComplete="off" />
              </div>

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

              <label className="form-label" htmlFor="author">{t('common.labels.author')}</label>
              <input className="form-input" type="text" id="author" name="author" placeholder={t('common.placeholders.person')} />

              <label className="form-label" htmlFor="venue">{t('common.labels.venue')}</label>
              <input className="form-input" type="text" id="venue" name="venue" placeholder={t('common.placeholders.venue')} />

              <label className="form-label" htmlFor="subject">{t('common.labels.subject')}</label>
              <input className="form-input" type="text" id="subject" name="subject" placeholder={t('common.placeholders.subject')} />

              <label className="form-label" htmlFor="year">{t('common.labels.year')}</label>
              <input className="form-input" type="number" id="year" name="year" placeholder={t('common.placeholders.year')} />

              <label className="form-label" htmlFor="language">{t('common.labels.language')}</label>
              <input className="form-input" type="text" id="language" name="language" placeholder={t('common.placeholders.language')} />

              <label className="form-label" htmlFor="limit-adv">{t('common.labels.itemsPerPage')}</label>
              <select className="form-input" id="limit-adv" name="limit" defaultValue="20">
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </div>
          </fieldset>
          <div className="search-controls">
            <button className="action-btn btn-negative" type="reset">{t('common.actions.clear')}</button>
            <button className="action-btn btn-positive" type="submit">{t('common.actions.runSearch')}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
