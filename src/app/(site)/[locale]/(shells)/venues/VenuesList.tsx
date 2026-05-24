'use client';

import LocaleLink from '@/components/common/LocaleLink';
import { useSearchParams } from 'next/navigation';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { actGetVenuesPage, type VenuesPageActionOptions } from '@/lib/actions';
import { formatNumber } from '@/lib/format';
import { extractVenueListState, VenueListState } from '@/lib/venues';
import { usePathname } from '@/i18n/routing';

interface Props {
  initialData: any;
  initialPage?: number;
  initialLimit?: number;
  paginated?: boolean;
  sortBy?: string;
  sortOrder?: string;
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

const subjectsToText = (raw: any): string => {
  if (!raw) return '';
  const list = Array.isArray(raw) ? raw : [raw];
  const labels = list
    .map((entry: any) => {
      if (!entry) return '';
      if (typeof entry === 'string') return entry;
      if (typeof entry === 'object') return String(entry.term || entry.display_name || entry.name || entry.label || entry.value || '').trim();
      return String(entry).trim();
    })
    .filter(Boolean);
  return Array.from(new Set(labels)).join(', ');
};

const pickSubjectsText = (v: any): string => {
  const summary = v?.summary_snapshot?.subjects_string || v?.subjects_string;
  if (summary && typeof summary === 'string' && summary.trim()) return summary.trim();
  const joined = subjectsToText(v?.summary_snapshot?.subjects || v?.subjects);
  return joined;
};

type MetaSegment = {
  className: string;
  text: string;
};

export default function VenuesList({
  initialData,
  initialPage = 1,
  initialLimit = 25,
  paginated = true,
  sortBy,
  sortOrder
}: Props) {
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
    const opts: VenuesPageActionOptions = {};
    if (sortBy) opts.sortBy = sortBy as VenuesPageActionOptions['sortBy'];
    if (sortOrder) opts.sortOrder = sortOrder as VenuesPageActionOptions['sortOrder'];
    actGetVenuesPage(page, limit, opts)
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
          <span className="sr-only">{tc('states.loadingJournals')}</span>
          <span aria-hidden="true">{tc('states.loadingJournals')}</span>
        </p>
      ) : null}
      <ul className="results-list">
        {items.length > 0 ? (
          items.map((v: any) => {
            const coverage = v.coverage_start_year && v.coverage_end_year ? `${v.coverage_start_year}-${v.coverage_end_year}` : '';
            const publisher = (v.publisher && v.publisher.name) || '';
            const works = typeof v.works_count === 'number' ? formatNumber(v.works_count) : (typeof v.summary_snapshot?.works_count === 'number' ? formatNumber(v.summary_snapshot.works_count) : '');
            const citedRaw = typeof v.cited_by_count === 'number' ? v.cited_by_count : (typeof v.summary_snapshot?.cited_by_count === 'number' ? v.summary_snapshot.cited_by_count : null);
            const cited = citedRaw !== null ? formatNumber(citedRaw) : '';
            const hIndex = typeof v.h_index === 'number' ? v.h_index : (typeof v.summary_snapshot?.h_index === 'number' ? v.summary_snapshot.h_index : null);
            const impactFactor = typeof v.impact_factor === 'number' ? v.impact_factor : (typeof v.summary_snapshot?.impact_factor === 'number' ? v.summary_snapshot.impact_factor : null);
            const issn = pickIdentifier(v, 'issn');
            const eissn = pickIdentifier(v, 'eissn');
            const country = (v.summary_snapshot?.country_code || v.country_code || v.publisher?.country_code || '').toString().toUpperCase();
            const type = (v.summary_snapshot?.type || v.type || '').toString().toUpperCase();
            const isOpenAccess = isTrue(v.open_access) || Number(v.summary_snapshot?.open_access_percentage ?? v.open_access_percentage ?? 0) >= 90;
            const inDoaj = isTrue(v.is_in_doaj) || isTrue(v.summary_snapshot?.is_in_doaj);
            const inScielo = isTrue(v.is_in_scielo) || isTrue(v.summary_snapshot?.is_in_scielo);
            const inScopus = isTrue(v.is_indexed_in_scopus) || isTrue(v.summary_snapshot?.is_indexed_in_scopus);
            const summary = normalizeText(pickSubjectsText(v));
            const metaSegments: MetaSegment[] = [];
            const publisherValue = publisher || tc('entities.publisherUnknown');
            if (type) metaSegments.push({ className: 'result-type', text: type });
            if (publisherValue) metaSegments.push({ className: 'result-publisher', text: publisherValue });
            if (coverage) metaSegments.push({ className: 'result-coverage', text: coverage });
            if (issn) metaSegments.push({ className: 'result-issn', text: `${tv('issn')} ${issn}` });
            if (eissn && eissn !== issn) metaSegments.push({ className: 'result-eissn', text: `${tv('eissn')} ${eissn}` });
            if (works) metaSegments.push({ className: 'result-total', text: tc('meta.worksCount', { count: works }) });
            if (cited) metaSegments.push({ className: 'result-cited', text: `${tc('meta.citedBy')}: ${cited}` });
            if (typeof hIndex === 'number' && hIndex > 0) metaSegments.push({ className: 'result-hindex', text: `${tv('hIndexLabel')}: ${hIndex}` });
            if (typeof impactFactor === 'number' && impactFactor > 0) metaSegments.push({ className: 'result-impact', text: `${tv('impact')}: ${impactFactor.toFixed(2)}` });
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
                        {index > 0 ? <span className="meta-separator" aria-hidden="true"> • </span> : null}
                        <span className={segment.className}>{segment.text}</span>
                      </Fragment>
                    ))}
                  </p>
                ) : null}
                {(isOpenAccess || inDoaj || inScielo || inScopus) ? (
                  <p className="result-meta result-badges">
                    {isOpenAccess ? <span className="badge open-acess">{tc('meta.openAccess')}</span> : null}
                    {inDoaj ? <span className="badge doaj">{tv('doaj')}</span> : null}
                    {inScielo ? <span className="badge scielo">SciELO</span> : null}
                    {inScopus ? <span className="badge scopus">{tv('indexedScopus')}</span> : null}
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
