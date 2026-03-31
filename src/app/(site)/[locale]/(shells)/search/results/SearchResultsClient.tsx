'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import LocaleLink from '@/components/common/LocaleLink';
import WorkMetaBadges from '@/components/common/WorkMetaBadges';
import { usePathname } from '@/i18n/routing';
import { formatMetadataAuthors, formatMetadataType, formatMetadataVenue, getWorkAbstractSnippet, isWorkOpenAccess } from '@/lib/works';

type SearchState = {
  items: any[];
  pageNum: number;
  totalPages?: number;
  hasPrev: boolean;
  hasNext: boolean;
  totalCount: number;
};

export default function SearchResultsClient() {
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
  const scope = params.scope || 'works';

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const response = await fetchResults(params, page, limit, scope, controller.signal);
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
  }, [params, page, limit, query, scope]);

  const prevHref = state.hasPrev
    ? `${pathname}?${new URLSearchParams({ ...params, page: String(Math.max(1, state.pageNum - 1)) }).toString()}`
    : undefined;
  const nextHref = state.hasNext
    ? `${pathname}?${new URLSearchParams({ ...params, page: String(state.pageNum + 1) }).toString()}`
    : undefined;

  const showNoResults = !loading && !loadError && state.items.length === 0 && (query || hasFilters(params) || Object.keys(params).length > 1);

  return (
    <div className="page-header" aria-labelledby="page-title">
      <h1 className="page-title" id="page-title">{t('results.title')}</h1>
      <section aria-labelledby="results-list">
        <h2 className="title-section" id="results-list">{t('results.itemsHeading')}</h2>
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
          {scope === 'venues' ? state.items.map((it: any) => (
            <li className="result-item" key={it.id}>
              <h3 className="result-title">
                <LocaleLink className="result-link" href={`/venues/${it.id}`}>{it.name || t('common.entities.titleUnavailable')}</LocaleLink>
              </h3>
              <p className="result-meta">
                {it.type ? <span className="result-type">{it.type}</span> : null}
                {it.issn ? <><span className="meta-separator" aria-hidden="true">•</span><span>ISSN {it.issn}</span></> : null}
                {(it.works_count || it.work_count) ? <><span className="meta-separator" aria-hidden="true">•</span><span>{t('common.meta.worksCount', { count: it.works_count || it.work_count })}</span></> : null}
              </p>
            </li>
          )) : scope === 'persons' ? state.items.map((it: any) => (
            <li className="result-item" key={it.id}>
              <h3 className="result-title">
                <LocaleLink className="result-link" href={`/persons/${it.id}`}>{it.preferred_name || (it.given_names && it.family_name ? `${it.given_names} ${it.family_name}` : t('common.entities.nameUnavailable'))}</LocaleLink>
              </h3>
              <p className="result-meta">
                {it.orcid ? <span>ORCID {it.orcid}</span> : null}
                {it.metrics?.works_count ? <><span className="meta-separator" aria-hidden="true">•</span><span>{t('common.meta.worksCount', { count: it.metrics.works_count })}</span></> : null}
              </p>
            </li>
          )) : state.items.map((it: any) => {
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
          {prevHref ? (<LocaleLink className="pagination-btn btn-negative" href={prevHref}>{t('common.actions.previous')}</LocaleLink>) : (<button type="button" className="pagination-btn btn-negative" disabled>{t('common.actions.previous')}</button>)}
          {nextHref ? (<LocaleLink className="pagination-btn btn-positive" href={nextHref}>{t('common.actions.next')}</LocaleLink>) : (<button type="button" className="pagination-btn btn-positive" disabled>{t('common.actions.next')}</button>)}
        </nav>
      </section>
    </div>
  );
}

const FILTER_KEYS = ['work_type', 'type', 'author', 'venue', 'subject', 'year_from', 'year_to', 'language', 'peer_reviewed', 'open_access'];

function hasFilters(params: Record<string, string>) {
  return FILTER_KEYS.some(k => params[k] && params[k] !== '');
}

async function fetchResults(params: Record<string, string>, page: string, limit: string, scope: string, signal: AbortSignal) {
  const base = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && String(v) !== '') base.set(k, String(v)); });
  const qv = base.get('q') || '';

  if (scope === 'venues') {
    const offset = String(Math.max(0, (Number(page) - 1) * Number(limit)));
    const qs = qv && qv !== '*'
      ? new URLSearchParams({ q: qv, limit, offset })
      : new URLSearchParams({ limit, page });
    const endpoint = qv && qv !== '*' ? '/api/venues/search' : '/api/venues';
    const res = await fetch(`${endpoint}?${qs.toString()}`, { signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  if (scope === 'persons') {
    if (!qv || qv === '*') {
      const qs = new URLSearchParams({ page, limit });
      const res = await fetch(`/api/search/persons?${qs.toString()}`, { signal, headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    }
    const qs = new URLSearchParams({ q: qv, page, limit });
    const res = await fetch(`/api/search/persons?${qs.toString()}`, { signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  const qs = new URLSearchParams(base as any);
  qs.delete('scope');
  if (qs.has('work_type') && !qs.has('type')) {
    qs.set('type', String(qs.get('work_type')));
    qs.delete('work_type');
  }

  const fetchOpts = { signal, headers: { accept: 'application/json' } };

  if (!qv || qv === '*') {
    qs.delete('q');
    const vitrineParams = new URLSearchParams();
    vitrineParams.set('page', page);
    vitrineParams.set('limit', limit);
    FILTER_KEYS.forEach(k => {
      const v = qs.get(k === 'work_type' ? 'type' : k);
      if (v) {
        const paramName = k === 'venue' ? 'venue_name' : (k === 'work_type' ? 'type' : k);
        vitrineParams.set(paramName, v);
      }
    });
    const hasFiltersSet = FILTER_KEYS.some(k => qs.get(k === 'work_type' ? 'type' : k));
    const primaryPath = hasFiltersSet
      ? `/api/search/works?${qs.toString()}`
      : `/api/works/showcase?${vitrineParams.toString()}`;
    const res = await fetch(primaryPath, fetchOpts);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  const res = await fetch(`/api/search/works?${qs.toString()}`, fetchOpts);
  if (!res.ok) {
    const fallbackRes = await fetch(`/api/works?q=${encodeURIComponent(qv)}&page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`, fetchOpts);
    if (!fallbackRes.ok) throw new Error(`HTTP ${fallbackRes.status}`);
    return await fallbackRes.json();
  }
  return await res.json();
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
