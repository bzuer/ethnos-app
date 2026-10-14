'use client';

import LocaleLink from '@/components/common/LocaleLink';
import { useSearchParams } from 'next/navigation';
import { Fragment, useEffect, useState, useSyncExternalStore } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { actGetVenuesPage } from '@/lib/actions';
import type { VenuesListSort, VenuesListSortOrder } from '@/lib/endpoints';
import { formatNumber } from '@/lib/format';
import type { VenueListItem, VenueListPage } from '@/lib/venues';
import { usePathname } from '@/i18n/routing';

type Props = {
  initial: VenueListPage;
  limit: number;
  sortBy?: VenuesListSort;
  sortOrder?: VenuesListSortOrder;
  paginated?: boolean;
};

const subscribeNever = () => () => {};

export default function VenuesList({ initial, limit, sortBy, sortOrder, paginated = false }: Props) {
  const tv = useTranslations('venues.detail');
  const tc = useTranslations('common');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  const page = paginated && mounted ? Math.max(1, Math.floor(Number(searchParams?.get('page')) || 1)) : 1;
  const [loaded, setLoaded] = useState<VenueListPage | null>(null);
  const [failedPage, setFailedPage] = useState<number | null>(null);
  const error = failedPage === page;
  const state = page === initial.page ? initial : (loaded?.page === page ? loaded : null);
  const loading = !state && !error;

  useEffect(() => {
    if (page === initial.page) return undefined;
    let cancelled = false;
    actGetVenuesPage(page, limit, sortBy, sortOrder)
      .then((result) => { if (!cancelled) setLoaded({ ...result, page }); })
      .catch(() => { if (!cancelled) setFailedPage(page); });
    return () => { cancelled = true; };
  }, [page, initial.page, limit, sortBy, sortOrder]);

  const items = state?.items ?? [];
  const pageHref = (target: number) => (target > 1 ? `${pathname}?page=${target}` : pathname);

  const segments = (v: VenueListItem) => [
    { className: 'result-type', text: v.type },
    { className: 'result-publisher', text: v.publisher || tc('entities.publisherUnknown') },
    { className: 'result-coverage', text: v.coverage },
    { className: 'result-issn', text: v.issn ? `${tv('issn')} ${v.issn}` : '' },
    { className: 'result-eissn', text: v.eissn && v.eissn !== v.issn ? `${tv('eissn')} ${v.eissn}` : '' },
    { className: 'result-isbn', text: !v.issn && !v.eissn && v.isbn13 ? `${tv('isbn13')} ${v.isbn13}` : '' },
    { className: 'result-total', text: v.worksCount !== null ? tc('meta.worksCount', { count: v.worksCount }) : '' },
    { className: 'result-cited', text: v.citedByCount !== null ? `${tc('meta.citedBy')}: ${formatNumber(v.citedByCount, locale)}` : '' },
    { className: 'result-hindex', text: v.hIndex ? `${tv('hIndexLabel')}: ${v.hIndex}` : '' },
    { className: 'result-impact', text: v.impactFactor ? `${tv('impact')}: ${v.impactFactor.toFixed(2)}` : '' },
    { className: 'result-quartile', text: v.quartile ? `${tv('sjr')} ${v.quartile}` : '' },
    { className: 'result-country', text: v.country }
  ].filter((segment) => segment.text);

  return (
    <div>
      {error ? <p className="temporary-message temporary-message-error">{tc('states.unableToLoadJournals')}</p> : null}
      {loading ? (
        <p className="temporary-message temporary-message-info" role="status" aria-live="polite">
          <span className="sr-only">{tc('states.loadingJournals')}</span>
          <span aria-hidden="true">{tc('states.loadingJournals')}</span>
        </p>
      ) : null}
      <ul className="results-list">
        {items.length > 0 ? (
          items.map((v) => {
            const meta = segments(v);
            return (
              <li className="result-item" key={v.id}>
                <h3 className="result-title">
                  <LocaleLink className="result-link" href={`/venues/${v.id}`}>{v.name || tc('entities.nameUnavailable')}</LocaleLink>
                </h3>
                {meta.length > 0 ? (
                  <p className="result-meta">
                    {meta.map((segment, index) => (
                      <Fragment key={segment.className}>
                        {index > 0 ? <span className="meta-separator" aria-hidden="true"> • </span> : null}
                        <span className={segment.className}>{segment.text}</span>
                      </Fragment>
                    ))}
                  </p>
                ) : null}
                {v.openAccess || v.diamond || v.doaj || v.scielo || v.scopus ? (
                  <p className="result-meta result-badges">
                    {v.openAccess ? <span className="badge open-acess">{tc('meta.openAccess')}</span> : null}
                    {v.diamond ? <span className="badge diamond">{tv('oaDiamond')}</span> : null}
                    {v.doaj ? <span className="badge doaj">{tv('doaj')}</span> : null}
                    {v.scielo ? <span className="badge scielo">SciELO</span> : null}
                    {v.scopus ? <span className="badge scopus">{tv('indexedScopus')}</span> : null}
                  </p>
                ) : null}
                {v.summary ? <p className="result-abstract">{v.summary}</p> : null}
              </li>
            );
          })
        ) : (
          loading ? null : (
            <li className="result-item">
              <p className="result-meta">{tc('states.noJournals')}</p>
            </li>
          )
        )}
      </ul>
      {paginated ? (
        <nav className="pagination-nav" aria-label={tc('labels.pagination')}>
          {page > 1 ? (
            <LocaleLink className="pagination-btn btn-negative" href={pageHref(page - 1)}>{tc('actions.previous')}</LocaleLink>
          ) : (
            <button type="button" className="pagination-btn btn-negative" disabled>{tc('actions.previous')}</button>
          )}
          {state?.hasNext ? (
            <LocaleLink className="pagination-btn btn-positive" href={pageHref(page + 1)}>{tc('actions.next')}</LocaleLink>
          ) : (
            <button type="button" className="pagination-btn btn-positive" disabled>{tc('actions.next')}</button>
          )}
        </nav>
      ) : null}
    </div>
  );
}
