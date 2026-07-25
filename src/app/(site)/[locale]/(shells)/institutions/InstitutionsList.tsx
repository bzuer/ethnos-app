'use client';

import LocaleLink from '@/components/common/LocaleLink';
import { useSearchParams } from 'next/navigation';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { actGetInstitutionsPage, type InstitutionsPageActionOptions } from '@/lib/actions';
import { formatNumber } from '@/lib/format';
import { extractVenueListState, type VenueListState } from '@/lib/venues';
import { usePathname } from '@/i18n/routing';

interface Props {
  initialData: any;
  initialPage?: number;
  initialLimit?: number;
  paginated?: boolean;
  sortBy?: string;
  sortOrder?: string;
}

type MetaSegment = { className: string; text: string };

export default function InstitutionsList({
  initialData,
  initialPage = 1,
  initialLimit = 25,
  paginated = true,
  sortBy,
  sortOrder
}: Props) {
  const ti = useTranslations('institutions.detail');
  const tc = useTranslations('common');
  const baseState = useMemo(() => extractVenueListState(initialData, { page: initialPage, limit: initialLimit }), [initialData, initialPage, initialLimit]);
  const [state, setState] = useState<VenueListState>(baseState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const pageParam = searchParams?.get('page');
  const limitParam = searchParams?.get('limit');
  const page = paginated ? Math.max(1, pageParam ? Number(pageParam) || initialPage : initialPage) : initialPage;
  const limit = Math.max(1, limitParam ? Number(limitParam) || initialLimit : initialLimit);

  useEffect(() => {
    setState(baseState);
  }, [baseState]);

  useEffect(() => {
    if (!paginated) return;
    const hasDataForRequest = state.page === page && state.limit === limit && state.items.length > 0;
    if (hasDataForRequest) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const opts: InstitutionsPageActionOptions = {};
    if (sortBy) opts.sortBy = sortBy as InstitutionsPageActionOptions['sortBy'];
    if (sortOrder) opts.sortOrder = sortOrder as InstitutionsPageActionOptions['sortOrder'];
    actGetInstitutionsPage(page, limit, opts)
      .then((json) => {
        if (cancelled) return;
        setState(extractVenueListState(json, { page, limit }));
      })
      .catch(() => {
        if (cancelled) return;
        setError(tc('states.unableToLoadInstitutions'));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, limit, state.page, state.limit, state.items.length, tc, paginated, sortBy, sortOrder]);

  const items = Array.isArray(state.items) ? state.items : [];
  const buildHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (targetPage > 1) params.set('page', String(targetPage));
    if (limit !== initialLimit) params.set('limit', String(limit));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  return (
    <div>
      {error ? <p className="temporary-message temporary-message-error">{error}</p> : null}
      {loading ? (
        <p className="temporary-message temporary-message-info" role="status" aria-live="polite">
          <span className="sr-only">{tc('states.loadingInstitutions')}</span>
          <span aria-hidden="true">{tc('states.loadingInstitutions')}</span>
        </p>
      ) : null}
      <ul className="results-list">
        {items.length > 0 ? (
          items.map((v: any) => {
            const type = String(v.openalex_type || v.type || '').toUpperCase();
            const country = String(v.country_code || '').toUpperCase();
            const city = v.city || '';
            const location = [city, country].filter(Boolean).join(', ');
            const works = typeof v.works_count === 'number' ? formatNumber(v.works_count) : '';
            const researchers = typeof v.researchers_count === 'number' ? formatNumber(v.researchers_count) : '';
            const cited = typeof v.total_citations === 'number' ? formatNumber(v.total_citations) : '';
            const hIndex = typeof v.h_index === 'number' ? v.h_index : null;
            const acronym = Array.isArray(v.acronyms) && v.acronyms.length ? v.acronyms[0] : '';
            const metaSegments: MetaSegment[] = [];
            if (type) metaSegments.push({ className: 'result-type', text: type });
            if (location) metaSegments.push({ className: 'result-country', text: location });
            if (works) metaSegments.push({ className: 'result-total', text: `${ti('works')}: ${works}` });
            if (researchers) metaSegments.push({ className: 'result-researchers', text: `${ti('researchers')}: ${researchers}` });
            if (cited) metaSegments.push({ className: 'result-cited', text: `${tc('meta.citedBy')}: ${cited}` });
            if (typeof hIndex === 'number' && hIndex > 0) metaSegments.push({ className: 'result-hindex', text: `${ti('hIndex')}: ${hIndex}` });
            return (
              <li className="result-item" key={v.id}>
                <h3 className="result-title">
                  <LocaleLink className="result-link" href={`/institutions/${v.id}`}>{v.name || tc('entities.nameUnavailable')}</LocaleLink>
                  {acronym ? <span className="result-acronym"> ({acronym})</span> : null}
                </h3>
                {metaSegments.length > 0 ? (
                  <p className="result-meta">
                    {metaSegments.map((segment, index) => (
                      <Fragment key={`${v.id}-${segment.className}-${index}`}>
                        {index > 0 ? <span className="meta-separator" aria-hidden="true"> • </span> : null}
                        <span className={segment.className}>{segment.text}</span>
                      </Fragment>
                    ))}
                  </p>
                ) : null}
              </li>
            );
          })
        ) : (
          <li className="result-item">
            <p className="result-meta">{tc('states.noInstitutions')}</p>
          </li>
        )}
      </ul>
      {paginated ? (
        <nav className="pagination-nav" aria-label={tc('labels.pagination')}>
          {state.hasPrev ? (
            <LocaleLink className="pagination-btn btn-negative" href={buildHref(Math.max(1, page - 1))}>{tc('actions.previous')}</LocaleLink>
          ) : (
            <button type="button" className="pagination-btn btn-negative" disabled>{tc('actions.previous')}</button>
          )}
          {state.hasNext ? (
            <LocaleLink className="pagination-btn btn-positive" href={buildHref(page + 1)}>{tc('actions.next')}</LocaleLink>
          ) : (
            <button type="button" className="pagination-btn btn-positive" disabled>{tc('actions.next')}</button>
          )}
        </nav>
      ) : null}
    </div>
  );
}
