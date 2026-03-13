'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import LocaleLink from '@/components/common/LocaleLink';
import WorkMetaBadges from '@/components/common/WorkMetaBadges';
import { usePathname, useRouter } from '@/i18n/routing';
import { formatMetadataAuthors, formatMetadataType, getWorkAbstractSnippet, isWorkOpenAccess, truncateMetadataText } from '@/lib/works';

type Props = { locale: string };

type SearchState = {
  items: any[];
  pageNum: number;
  totalPages?: number;
  hasPrev: boolean;
  hasNext: boolean;
  totalCount: number;
};

export default function SearchSphinxClient({ locale }: Props) {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const router = useRouter();
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
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    if (!query || query === '*') router.replace('/search', { locale });
  }, [query, router, locale]);

  useEffect(() => {
    if (!query || query === '*') return;
    let cancelled = false;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const response = await fetchResults(params, page, limit, controller.signal);
        if (cancelled) return;
        const nextState = parseSearchState(response, page, limit);
        setState(nextState);
      } catch {
        if (cancelled) return;
        setLoadError(true);
        setState((prev) => ({ ...prev, items: [] }));
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
  }, [params, page, limit, query]);

  const prevHref = state.hasPrev
    ? `${pathname}?${new URLSearchParams({ ...params, page: String(Math.max(1, state.pageNum - 1)) }).toString()}`
    : undefined;
  const nextHref = state.hasNext
    ? `${pathname}?${new URLSearchParams({ ...params, page: String(state.pageNum + 1) }).toString()}`
    : undefined;

  const showNoResults = !loading && !loadError && state.items.length === 0 && query && query !== '*';

  return (
    <div className="page-header" aria-labelledby="page-title">
      <h1 className="page-title" id="page-title">{t('sphinx.title')}</h1>
      {query ? (<p className="search-summary">{t('results.summary', { query })}</p>) : null}
      {!loading && state.totalCount > 0 ? (<p className="search-stats">{t('results.totalCount', { count: state.totalCount })}{state.totalPages && state.totalPages > 1 ? ` · ${t('results.pageInfo', { page: state.pageNum })}` : ''}</p>) : null}
      <section aria-labelledby="results-list">
        <h2 className="title-section" id="results-list">{t('sphinx.itemsHeading')}</h2>
        {loadError ? (<p className="temporary-message temporary-message-error" role="status">{t('common.states.unableToLoadWorks')}</p>) : null}
        {loading ? (
          <p className="temporary-message temporary-message-info" role="status" aria-live="polite">
            <span className="sr-only">{t('common.states.loadingWorks')}</span>
            <span aria-hidden="true">{t('common.states.loadingWorks')}</span>
          </p>
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
            const abstractShort = getWorkAbstractSnippet(it);
            const openAccess = isWorkOpenAccess(it);
            const doi = it.doi || (it.publication && it.publication.doi) || '';
            const doiText = truncateMetadataText(doi, 96);
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
                  {year ? <><span className="meta-separator" aria-hidden="true">•</span><span className="result-year">{year}</span></> : null}
                  {type ? <><span className="meta-separator" aria-hidden="true">•</span><span className="result-type">{type}</span></> : null}
                  {rel ? <><span className="meta-separator" aria-hidden="true">•</span><span className="relevance-score">{rel}</span></> : null}
                  {doi ? <><span className="meta-separator" aria-hidden="true">•</span><span className="result-doi"><a href={`https://doi.org/${encodeURIComponent(String(doi))}`} target="_blank" rel="noopener noreferrer">{doiText}</a></span></> : null}
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
          {prevHref ? (<LocaleLink className="pagination-btn btn-negative" href={prevHref}>{t('common.actions.previous')}</LocaleLink>) : (<button type="button" className="pagination-btn btn-negative" disabled>{t('common.actions.previous')}</button>)}
          {nextHref ? (<LocaleLink className="pagination-btn btn-positive" href={nextHref}>{t('common.actions.next')}</LocaleLink>) : (<button type="button" className="pagination-btn btn-positive" disabled>{t('common.actions.next')}</button>)}
        </nav>
      </section>
    </div>
  );
}

async function fetchResults(params: Record<string, string>, page: string, limit: string, signal: AbortSignal) {
  const base = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && String(v) !== '') base.set(k, String(v)); });
  const qv = base.get('q') || '';
  const tryPaths: string[] = [];
  const sphinx = new URLSearchParams(base as any);
  const offset = base.has('offset') ? Number(base.get('offset') || '0') : Math.max(0, (Number(page) - 1) * Number(limit));
  sphinx.set('limit', String(limit));
  sphinx.delete('page');
  if (!sphinx.has('offset')) sphinx.set('offset', String(offset));
  tryPaths.push(`/api/search/advanced?${sphinx.toString()}`);
  const qs = new URLSearchParams(base as any);
  if (qs.has('work_type') && !qs.has('type')) {
    qs.set('type', String(qs.get('work_type')));
    qs.delete('work_type');
  }
  tryPaths.push(`/api/search/works?${qs.toString()}`);
  tryPaths.push(`/api/works?q=${encodeURIComponent(qv)}&page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`);
  let lastError: unknown;
  for (const path of tryPaths) {
    try {
      const res = await fetch(path, { signal, headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastError = err;
      continue;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Search failed');
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
  const totalCount = Number(data?.total ?? data?.data?.total ?? data?.meta?.total ?? 0) || 0;
  const psrc: any = data?.pagination || data?.meta?.pagination || data?.data?.pagination || data?.results?.pagination || {};
  const pageNum = Number((psrc?.page ?? psrc?.current_page ?? page) || 1);
  const totalPages = Number(psrc?.totalPages ?? psrc?.total_pages ?? (totalCount && limit ? Math.ceil(Number(totalCount) / Number(limit)) : 0)) || undefined;
  const hasPrev = Boolean(psrc?.hasPrev) || pageNum > 1;
  const hasNext = Boolean(psrc?.hasNext) || (totalPages ? pageNum < totalPages : (totalCount ? pageNum * Number(limit) < totalCount : uniqueItems.length === Number(limit)));
  return { items: uniqueItems, pageNum, totalPages, hasPrev, hasNext, totalCount };
}
