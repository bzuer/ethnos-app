'use client';

import LocaleLink from '@/components/common/LocaleLink';
import { useSearchParams } from 'next/navigation';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatNumber } from '@/lib/format';
import { extractVenueListState, VenueListState } from '@/lib/venues';
import { usePathname } from '@/i18n/routing';

interface Props {
  initialData: any;
  initialPage?: number;
  initialLimit?: number;
}

const isTrue = (value: any) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y';
  }
  return false;
};

const normalizeText = (value: any, limit = 420) => {
  if (!value) return '';
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}…`;
};

const pickIdentifier = (item: any, key: 'issn' | 'eissn') => {
  const fromSummary = item?.summary_snapshot && item.summary_snapshot[key];
  const direct = item?.[key];
  const nested = item?.identifiers && item.identifiers[key];
  return fromSummary || direct || nested || '';
};

type MetaSegment = {
  className: string;
  text: string;
};

export default function VenuesList({ initialData, initialPage = 1, initialLimit = 25 }: Props) {
  const tv = useTranslations('venues.detail');
  const tc = useTranslations('common');
  const baseState = useMemo(() => extractVenueListState(initialData, { page: initialPage, limit: initialLimit }), [initialData, initialPage, initialLimit]);
  const [state, setState] = useState<VenueListState>(baseState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const pageParam = searchParams?.get('page');
  const limitParam = searchParams?.get('limit');
  const page = Math.max(1, pageParam ? Number(pageParam) || initialPage : initialPage);
  const limit = Math.max(1, limitParam ? Number(limitParam) || initialLimit : initialLimit);

  useEffect(() => {
    setState(baseState);
  }, [baseState]);

  useEffect(() => {
    const hasDataForRequest = state.page === page && state.limit === limit && state.items.length > 0;
    if (hasDataForRequest) return;
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    fetch(`/api/venues?${params.toString()}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('Request failed');
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        setState(extractVenueListState(json, { page, limit }));
      })
      .catch(() => {
        if (cancelled) return;
        setError(tc('states.unableToLoadJournals'));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [page, limit, state.page, state.limit, state.items.length, tc]);

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
          <span className="sr-only">{tc('states.loadingJournals')}</span>
          <span aria-hidden="true">Loading...</span>
        </p>
      ) : null}
      <ul className="results-list">
        {items.length > 0 ? (
          items.map((v: any) => {
            const coverage = v.coverage_start_year && v.coverage_end_year ? `${v.coverage_start_year}-${v.coverage_end_year}` : '';
            const publisher = (v.publisher && v.publisher.name) || '';
            const works = typeof v.works_count === 'number' ? formatNumber(v.works_count) : (typeof v.summary_snapshot?.works_count === 'number' ? formatNumber(v.summary_snapshot.works_count) : '');
            const cited = typeof v.cited_by_count === 'number' ? formatNumber(v.cited_by_count) : (typeof v.summary_snapshot?.cited_by_count === 'number' ? formatNumber(v.summary_snapshot.cited_by_count) : '');
            const issn = pickIdentifier(v, 'issn');
            const eissn = pickIdentifier(v, 'eissn');
            const country = (v.summary_snapshot?.country_code || v.country_code || v.publisher?.country_code || '').toString().toUpperCase();
            const type = (v.summary_snapshot?.type || v.type || '').toString().toUpperCase();
            const isOpenAccess = isTrue(v.open_access) || isTrue(v.summary_snapshot?.open_access_percentage && Number(v.summary_snapshot.open_access_percentage) >= 90);
            const inDoaj = isTrue(v.is_in_doaj);
            const summaryRaw = v.summary_snapshot?.subjects_string || v.subjects_string || (Array.isArray(v.subjects) ? v.subjects.join(', ') : '');
            const summary = normalizeText(summaryRaw);
            const metaSegments: MetaSegment[] = [];
            const publisherValue = publisher || tc('entities.publisherUnknown');
            if (type) metaSegments.push({ className: 'result-type', text: type });
            if (publisherValue) metaSegments.push({ className: 'result-publisher', text: publisherValue });
            if (coverage) metaSegments.push({ className: 'result-coverage', text: coverage });
            if (issn) metaSegments.push({ className: 'result-issn', text: `${tv('issn')} ${issn}` });
            if (eissn && eissn !== issn) metaSegments.push({ className: 'result-eissn', text: `${tv('eissn')} ${eissn}` });
            if (works) metaSegments.push({ className: 'result-total', text: tc('meta.worksCount', { count: works }) });
            if (country) metaSegments.push({ className: 'result-country', text: country });
            return (
              <li className="result-item" key={v.id}>
                <h3 className="result-title">
                  <LocaleLink className="result-link" href={`/venues/${v.id}`}>{v.name || tc('entities.nameUnavailable')}</LocaleLink>
                </h3>
                {metaSegments.length > 0 ? (
                  <p className="result-meta">
                    {metaSegments.map((segment, index) => (
                      <Fragment key={`${v.id}-${segment.className}-${index}`}>
                        {index > 0 ? ' • ' : null}
                        <span className={segment.className}>{segment.text}</span>
                      </Fragment>
                    ))}
                  </p>
                ) : null}
                {summary ? (<p className="result-abstract">{summary}</p>) : null}
              </li>
            );
          })
        ) : (
          <li className="result-item">
            <p className="result-meta">{tc('states.noJournals')}</p>
          </li>
        )}
      </ul>
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
    </div>
  );
}
