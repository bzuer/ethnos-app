'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import LocaleLink from '@/components/common/LocaleLink';
import { WorkResultItem, type WorkResultLabels } from '@/components/common/WorkResultItem';
import { actSearchGlobal, type GlobalSearchResult } from '@/lib/actions';
import { formatNumber } from '@/lib/format';

type Props = {
  formAction: string;
};

const EMPTY: GlobalSearchResult = {
  works: { total: 0, results: [] },
  persons: { total: 0, results: [] },
  institutions: { total: 0, results: [] }
};

export default function SearchGlobalClient({ formAction }: Props) {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<GlobalSearchResult>(EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const query = mounted ? String(searchParams?.get('q') || '').trim() : '';

  useEffect(() => {
    if (!query || query.length < 2) {
      setData(EMPTY);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    actSearchGlobal(query, 10)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setData(EMPTY); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query]);

  const resultLabels: WorkResultLabels = useMemo(() => ({
    titleUnavailable: t('common.entities.titleUnavailable'),
    authorUnknown: t('common.entities.authorUnknown'),
    openAccess: t('common.meta.openAccess'),
    addToList: t('common.actions.addToList'),
    inList: t('common.actions.inList'),
    removeFromList: t('common.actions.removeFromList'),
    added: t('common.messages.added'),
    itemRemoved: t('common.messages.itemRemoved'),
    citedBy: t('common.meta.citedBy'),
    references: t('common.meta.references')
  }), [t]);

  const works = data.works.results;
  const persons = data.persons.results;
  const institutions = data.institutions.results;
  const hasQuery = Boolean(query && query.length >= 2);
  const showNoResults = mounted && hasQuery && !loading && works.length === 0;
  const showStartPrompt = mounted && !hasQuery;

  return (
    <div className="page-header" aria-labelledby="page-title">
      <h1 className="page-title" id="page-title">{t('searchGlobal.title')}</h1>
      <p className="description">{t('searchGlobal.intro')}</p>

      <form action={formAction} method="get" role="search" aria-label={t('searchGlobal.title')} className="search-form">
        <div className="search-input-container">
          <label className="sr-only" htmlFor="global-q">{t('common.labels.term')}</label>
          <input
            key={query || 'q-empty'}
            className="form-input"
            type="text"
            id="global-q"
            name="q"
            defaultValue={query}
            placeholder={t('common.placeholders.quickTerm')}
            aria-label={t('common.aria.searchInput')}
          />
        </div>
        <button className="search-btn btn-positive" type="submit">{t('searchGlobal.submit')}</button>
      </form>

      {loading ? (
        <p className="temporary-message temporary-message-info" role="status" aria-live="polite">{t('common.states.loadingWorks')}</p>
      ) : null}

      {showStartPrompt ? (
        <p className="temporary-message temporary-message-info">{t('searchGlobal.startPrompt')}</p>
      ) : null}

      {showNoResults ? (
        <p className="temporary-message temporary-message-info">{t('searchGlobal.noResults')}</p>
      ) : null}

      {hasQuery && works.length > 0 ? (
        <section aria-labelledby="global-works-heading">
          <h2 className="title-section" id="global-works-heading">{t('searchGlobal.worksHeading')}</h2>
          <ul className="results-list">
            {works.map((it: any) => (
              <WorkResultItem key={it.id ?? it.work_id} item={it} labels={resultLabels} showRelevance />
            ))}
          </ul>
          {data.works.total > works.length ? (
            <div className="action-links">
              <LocaleLink className="action-btn btn-positive" href={`/search/results?q=${encodeURIComponent(query)}`}>
                {t('searchGlobal.seeAllWorks', { count: data.works.total })}
              </LocaleLink>
            </div>
          ) : null}
        </section>
      ) : null}

      {hasQuery && persons.length > 0 ? (
        <section aria-labelledby="global-authors-heading">
          <h2 className="title-section" id="global-authors-heading">{t('searchGlobal.authorsHeading')}</h2>
          <ul className="results-list">
            {persons.map((p: any, idx: number) => {
              const pid = p?.id;
              const name = p?.preferred_name || [p?.given_names, p?.family_name].filter(Boolean).join(' ') || t('common.entities.authorUnknown');
              const worksCount = Number(p?.metrics?.works_count) || 0;
              return (
                <li className="result-item" key={pid || idx}>
                  <h3 className="result-title">
                    {pid ? (
                      <LocaleLink className="result-link" href={`/persons/${pid}`}>{name}</LocaleLink>
                    ) : (
                      <span className="field-value">{name}</span>
                    )}
                  </h3>
                  {worksCount > 0 ? (
                    <p className="result-meta"><span className="result-total">{t('common.meta.worksCount', { count: worksCount })}</span></p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {hasQuery && institutions.length > 0 ? (
        <section aria-labelledby="global-institutions-heading">
          <h2 className="title-section" id="global-institutions-heading">{t('searchGlobal.institutionsHeading')}</h2>
          <ul className="results-list">
            {institutions.map((inst: any, idx: number) => {
              const iid = inst?.id;
              const name = inst?.name || t('common.entities.nameUnavailable');
              const worksCount = Number(inst?.works_count) || 0;
              return (
                <li className="result-item" key={iid || idx}>
                  <h3 className="result-title">
                    {iid ? (
                      <LocaleLink className="result-link" href={`/institutions/${iid}`}>{name}</LocaleLink>
                    ) : (
                      <span className="field-value">{name}</span>
                    )}
                  </h3>
                  {worksCount > 0 ? (
                    <p className="result-meta"><span className="result-total">{formatNumber(worksCount)}</span></p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
