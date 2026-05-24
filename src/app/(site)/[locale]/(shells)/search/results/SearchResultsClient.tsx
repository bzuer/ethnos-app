'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import LocaleLink from '@/components/common/LocaleLink';
import SearchForm from '@/components/common/SearchForm';
import WorkMetaBadges from '@/components/common/WorkMetaBadges';
import { usePathname } from '@/i18n/routing';
import { actSearchWorks } from '@/lib/actions';
import { formatMetadataAuthors, formatMetadataType, formatMetadataVenue, getWorkAbstractSnippet, isWorkOpenAccess } from '@/lib/works';

type SearchState = {
  items: any[];
  pageNum: number;
  totalPages?: number;
  hasPrev: boolean;
  hasNext: boolean;
  totalCount: number;
};

type Props = {
  formAction: string;
};

const FILTER_KEYS = ['work_type', 'type', 'author', 'venue', 'subject', 'year_from', 'year_to', 'language', 'peer_reviewed', 'open_access'] as const;
type FilterKey = typeof FILTER_KEYS[number];
const FILTER_LABEL_KEYS: Record<FilterKey, string> = {
  work_type: 'common.labels.type',
  type: 'common.labels.type',
  author: 'common.labels.author',
  venue: 'common.labels.venue',
  subject: 'common.labels.subject',
  year_from: 'common.labels.yearFrom',
  year_to: 'common.labels.yearTo',
  language: 'common.labels.language',
  peer_reviewed: 'common.labels.peerReviewed',
  open_access: 'common.labels.openAccess'
};

export default function SearchResultsClient({ formAction }: Props) {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [state, setState] = useState<SearchState>({
    items: [],
    pageNum: 1,
    totalPages: undefined,
    hasPrev: false,
    hasNext: false,
    totalCount: 0
  });
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refineOpen, setRefineOpen] = useState(false);

  const params = useMemo(() => {
    const result: Record<string, string> = {};
    if (searchParams) {
      searchParams.forEach((value, key) => {
        if (value !== undefined && value !== null && String(value) !== '') result[key] = String(value);
      });
    }
    return result;
  }, [searchParams]);

  const query = params.q || '';
  const page = params.page || '1';
  const limit = params.limit || '20';
  const activeFilters = useMemo(() => readActiveFilters(params), [params]);
  const noParams = !query && activeFilters.length === 0;
  const hasUserInput = Boolean(query) || activeFilters.length > 0;

  useEffect(() => {
    setRefineOpen(!hasUserInput);
  }, [hasUserInput]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const response = await fetchResults(params, page, limit);
        if (controller.signal.aborted || cancelled) return;
        setState(parseSearchState(response, page, limit));
      } catch {
        if (cancelled) return;
        setLoadError(true);
        setState((prev) => ({ ...prev, items: [], totalCount: 0, hasNext: false, hasPrev: false, totalPages: undefined }));
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [params, page, limit]);

  const buildPagedHref = (nextPage: number) => {
    const next = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => next.set(k, String(v)));
    next.set('page', String(Math.max(1, nextPage)));
    return `${pathname}?${next.toString()}`;
  };
  const buildFilteredHref = (omitKey: string) => {
    const next = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (k !== omitKey && k !== 'page') next.set(k, String(v)); });
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const clearAllHref = pathname;

  const prevHref = state.hasPrev ? buildPagedHref(state.pageNum - 1) : undefined;
  const nextHref = state.hasNext ? buildPagedHref(state.pageNum + 1) : undefined;

  const totalLabel = formatTotal(state.totalCount, t);
  const pagePositionLabel = state.totalPages && state.totalPages > 0
    ? t('results.pagePosition', { page: state.pageNum, totalPages: state.totalPages })
    : '';

  const showNoResults = !loading && !loadError && state.items.length === 0 && hasUserInput;
  const showStartPrompt = !loading && !loadError && noParams && state.items.length === 0;

  return (
    <div className="page-header" aria-labelledby="page-title">
      <h1 className="page-title" id="page-title">{t('results.title')}</h1>

      <section aria-labelledby="results-summary-heading">
        <h2 className="sr-only" id="results-summary-heading">{t('results.summaryHeading')}</h2>
        <div className="results-summary" role="region" aria-live="polite">
          {query ? (
            <p className="results-summary-query">
              {t.rich('results.queryEcho', { query, strong: (chunks) => <strong>{chunks}</strong> })}
            </p>
          ) : null}
          {!loading && !loadError && state.totalCount > 0 ? (
            <p className="results-summary-stats">
              <span className="results-summary-total">{totalLabel}</span>
              {pagePositionLabel ? (
                <>
                  <span className="meta-separator" aria-hidden="true">•</span>
                  <span className="results-summary-page">{pagePositionLabel}</span>
                </>
              ) : null}
            </p>
          ) : null}
          {activeFilters.length > 0 ? (
            <div className="active-filters" aria-labelledby="active-filters-heading">
              <h3 className="sr-only" id="active-filters-heading">{t('results.activeFiltersHeading')}</h3>
              <ul className="filter-chips" role="list">
                {activeFilters.map(({ key, value }) => {
                  const display = formatFilterValue(key, value, t);
                  return (
                    <li key={`${key}-${value}`} className="filter-chip">
                      <span className="filter-chip-label">{t(FILTER_LABEL_KEYS[key])}</span>
                      <span className="filter-chip-value">{display}</span>
                      <LocaleLink
                        className="filter-chip-remove"
                        href={buildFilteredHref(key)}
                        aria-label={t('results.removeFilter', { label: `${t(FILTER_LABEL_KEYS[key])} ${display}` })}
                      >
                        ×
                      </LocaleLink>
                    </li>
                  );
                })}
                <li className="filter-chip-clear-all">
                  <LocaleLink className="action-link" href={clearAllHref}>
                    {t('results.clearAllFilters')}
                  </LocaleLink>
                </li>
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="refine-heading">
        <h2 className="title-section title-section-toggle" id="refine-heading">
          <button
            type="button"
            className="section-toggle"
            aria-expanded={refineOpen}
            aria-controls="refine-panel"
            onClick={() => setRefineOpen((o) => !o)}
          >
            <span aria-hidden="true">{refineOpen ? '▾' : '▸'}</span> {t('results.refineHeading')}
          </button>
        </h2>
        <div id="refine-panel" className="refine-panel" hidden={!refineOpen}>
          <SearchForm key={searchParams ? searchParams.toString() : ''} action={formAction} autocompleteId="refine-q" embedded />
        </div>
      </section>

      <section aria-labelledby="results-list-heading">
        <h2 className="sr-only" id="results-list-heading">{t('results.itemsHeading')}</h2>
        {loadError ? (
          <p className="temporary-message temporary-message-error" role="status">{t('common.states.unableToLoadWorks')}</p>
        ) : null}
        {loading ? (
          <p className="temporary-message temporary-message-info" role="status" aria-live="polite">
            <span className="sr-only">{t('common.states.loadingWorks')}</span>
            <span aria-hidden="true">{t('common.states.loadingWorks')}</span>
          </p>
        ) : null}
        {showStartPrompt ? (
          <div className="temporary-message temporary-message-info">
            <p>{t('results.startPrompt')}</p>
            <p>{t('results.startPromptTip')}</p>
          </div>
        ) : null}
        {showNoResults ? (
          <div className="temporary-message temporary-message-info">
            <p>{t('results.noResults')}</p>
            <p>{t('results.noResultsTip')}</p>
          </div>
        ) : null}
        <ul className="results-list">
          {state.items.map((it: any) => {
            const authors = formatMetadataAuthors(it, t('common.entities.authorUnknown'));
            const year = it.publication_year || it.year || (it.publication && it.publication.year) || '';
            const type = formatMetadataType(it.work_type || it.type || '');
            const venue = formatMetadataVenue(it, 35);
            const abstractShort = getWorkAbstractSnippet(it);
            const openAccess = isWorkOpenAccess(it);
            const relRaw = (it.relevance ?? it.score ?? it._score ?? it.rank);
            const relNum = typeof relRaw === 'number' ? relRaw : (relRaw ? Number(relRaw) : undefined);
            const rel = relNum && isFinite(relNum) ? relNum.toFixed(2) : '';
            const hasListAction = Boolean(it?.id ?? it?.work_id);
            return (
              <li className="result-item" key={it.id}>
                <h3 className="result-title">
                  <LocaleLink className="result-link" href={`/works/${it.id}`}>{it.title || t('common.entities.titleUnavailable')}</LocaleLink>
                </h3>
                <p className="result-meta">
                  {openAccess ? (
                    <>
                      <WorkMetaBadges
                        work={it}
                        openAccess={openAccess}
                        openAccessLabel={t('common.meta.openAccess')}
                        addToListLabel={t('common.actions.addToList')}
                        inListLabel={t('common.actions.inList')}
                        removeFromListLabel={t('common.actions.removeFromList')}
                        addedMessage={t('common.messages.added')}
                        removedMessage={t('common.messages.itemRemoved')}
                        showListBadge={false}
                      />
                      <span className="meta-separator" aria-hidden="true">•</span>
                    </>
                  ) : null}
                  <span className="result-authors">{authors}</span>
                  {type ? <><span className="meta-separator" aria-hidden="true">•</span><span className="result-type">{type}</span></> : null}
                  {venue ? <><span className="meta-separator" aria-hidden="true">•</span><span className="result-venue">{venue}</span></> : null}
                  {year ? <><span className="meta-separator" aria-hidden="true">•</span><span className="result-year">{year}</span></> : null}
                  {rel ? <><span className="meta-separator" aria-hidden="true">•</span><span className="relevance-score">{rel}</span></> : null}
                </p>
                {hasListAction ? (
                  <p className="result-meta result-badges">
                    <WorkMetaBadges
                      work={it}
                      openAccess={openAccess}
                      openAccessLabel={t('common.meta.openAccess')}
                      addToListLabel={t('common.actions.addToList')}
                      inListLabel={t('common.actions.inList')}
                      removeFromListLabel={t('common.actions.removeFromList')}
                      addedMessage={t('common.messages.added')}
                      removedMessage={t('common.messages.itemRemoved')}
                      showOpenAccessBadge={false}
                    />
                  </p>
                ) : null}
                {abstractShort ? (<p className="result-abstract">{abstractShort}</p>) : null}
              </li>
            );
          })}
        </ul>
        <nav className="pagination-nav" aria-label={t('common.labels.pagination')}>
          {prevHref ? (
            <LocaleLink className="pagination-btn btn-negative" href={prevHref} rel="prev">{t('common.actions.previous')}</LocaleLink>
          ) : (
            <button type="button" className="pagination-btn btn-negative" disabled>{t('common.actions.previous')}</button>
          )}
          <span className="pagination-info" aria-live="polite">
            {pagePositionLabel || (state.totalCount > 0 ? totalLabel : '')}
          </span>
          {nextHref ? (
            <LocaleLink className="pagination-btn btn-positive" href={nextHref} rel="next">{t('common.actions.next')}</LocaleLink>
          ) : (
            <button type="button" className="pagination-btn btn-positive" disabled>{t('common.actions.next')}</button>
          )}
        </nav>
      </section>
    </div>
  );
}

function readActiveFilters(params: Record<string, string>) {
  const seen = new Set<FilterKey>();
  const list: Array<{ key: FilterKey; value: string }> = [];
  for (const key of FILTER_KEYS) {
    const value = params[key];
    if (!value) continue;
    const canonical: FilterKey = key === 'work_type' ? 'work_type' : (key === 'type' ? 'work_type' : key);
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    list.push({ key: canonical, value });
  }
  return list;
}

function formatTotal(total: number, t: ReturnType<typeof useTranslations>) {
  if (!total) return '';
  return total === 1 ? t('results.totalSingular') : t('results.total', { count: total });
}

function formatFilterValue(key: FilterKey, value: string, t: ReturnType<typeof useTranslations>) {
  if (key === 'peer_reviewed' || key === 'open_access') {
    return value === 'true' ? t('common.values.yes') : value === 'false' ? t('common.values.no') : value;
  }
  return value;
}

async function fetchResults(params: Record<string, string>, page: string, limit: string) {
  const payload: Record<string, string> = { ...params };
  payload.page = payload.page || page;
  payload.limit = payload.limit || limit;
  delete payload.scope;
  return await actSearchWorks(payload);
}

function parseSearchState(data: any, page: string, limit: string): SearchState {
  let items: any[] = [];
  if (Array.isArray(data)) items = data as any[];
  else if (Array.isArray(data?.results)) items = data.results as any[];
  else if (Array.isArray(data?.data?.results)) items = data.data.results as any[];
  else if (Array.isArray(data?.data)) items = data.data as any[];
  else if (Array.isArray(data?.items)) items = data.items as any[];
  else if (Array.isArray(data?.results?.items)) items = data.results.items as any[];
  const uniqueItems: any[] = [];
  const seen = new Set<string>();
  items.forEach((item) => {
    const keySource = item?.id ?? item?.work_id;
    const key = keySource === null || keySource === undefined ? null : String(keySource);
    if (key) {
      if (seen.has(key)) return;
      seen.add(key);
    }
    uniqueItems.push(item);
  });
  const psrc: any = data?.pagination || data?.meta?.pagination || data?.data?.pagination || data?.results?.pagination || {};
  const totalCount = Number(data?.total ?? data?.data?.total ?? data?.meta?.total ?? psrc?.total ?? 0) || 0;
  const pageNum = Number((psrc?.page ?? psrc?.current_page ?? page) || 1);
  const totalPages = Number(psrc?.totalPages ?? psrc?.total_pages ?? (totalCount && limit ? Math.ceil(Number(totalCount) / Number(limit)) : 0)) || undefined;
  const hasPrev = Boolean(psrc?.hasPrev) || pageNum > 1;
  const hasNext = Boolean(psrc?.hasNext) || (totalPages ? pageNum < totalPages : (totalCount ? pageNum * Number(limit) < totalCount : uniqueItems.length === Number(limit)));
  return { items: uniqueItems, pageNum, totalPages, hasPrev, hasNext, totalCount };
}
