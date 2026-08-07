const firstDefined = (...values: any[]) => {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return null;
};

export function normalizeVenue(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  const identifiers = raw.identifiers && typeof raw.identifiers === 'object' ? raw.identifiers : {};
  const indexing = raw.indexing && typeof raw.indexing === 'object' ? raw.indexing : {};
  const metrics = raw.metrics && typeof raw.metrics === 'object' ? raw.metrics : {};
  const ranking = raw.ranking && typeof raw.ranking === 'object' ? raw.ranking : {};
  const location = raw.location && typeof raw.location === 'object' ? raw.location : {};
  return {
    ...raw,
    country_code: firstDefined(raw.country_code, location.country_code),
    homepage_url: firstDefined(raw.homepage_url, raw.homepage, raw.url),
    issn: firstDefined(identifiers.issn, raw.issn),
    eissn: firstDefined(identifiers.eissn, raw.eissn),
    isbn13: firstDefined(identifiers.isbn13, raw.isbn13),
    scopus_id: firstDefined(identifiers.scopus_id, raw.scopus_id),
    wikidata_id: firstDefined(identifiers.wikidata_id, raw.wikidata_id),
    openalex_id: firstDefined(identifiers.openalex_id, raw.openalex_id),
    scielo_id: firstDefined(identifiers.scielo_id, raw.scielo_id),
    mag_id: firstDefined(identifiers.mag_id, raw.mag_id),
    openlibrary_work: firstDefined(identifiers.openlibrary_work, raw.openlibrary_work),
    impact_factor: firstDefined(metrics.impact_factor, raw.impact_factor),
    citescore: firstDefined(metrics.citescore, raw.citescore),
    sjr: firstDefined(metrics.sjr, raw.sjr),
    sjr_best_quartile: firstDefined(metrics.sjr_best_quartile, raw.sjr_best_quartile),
    snip: firstDefined(metrics.snip, raw.snip),
    h_index: firstDefined(metrics.h_index, raw.h_index),
    i10_index: firstDefined(metrics.i10_index, raw.i10_index),
    two_yr_mean_citedness: firstDefined(metrics.two_yr_mean_citedness, raw.two_yr_mean_citedness),
    overton: firstDefined(metrics.overton, raw.overton),
    female_share: firstDefined(metrics.female_share, raw.female_share),
    is_in_doaj: firstDefined(indexing.is_in_doaj, raw.is_in_doaj),
    is_in_scielo: firstDefined(indexing.is_in_scielo, raw.is_in_scielo),
    is_indexed_in_scopus: firstDefined(indexing.is_indexed_in_scopus, raw.is_indexed_in_scopus),
    is_oa_diamond: firstDefined(indexing.is_oa_diamond, raw.is_oa_diamond),
    validation_status: firstDefined(indexing.validation_status, raw.validation_status),
    ranking_score: firstDefined(ranking.score, raw.ranking_score),
    description: firstDefined(raw.description, raw.summary),
    subjects: Array.isArray(raw.subjects) ? raw.subjects : (raw.subjects ? [raw.subjects] : [])
  };
}

export interface VenueListState {
  items: any[];
  page: number;
  limit: number;
  hasPrev: boolean;
  hasNext: boolean;
  totalPages?: number;
}

const DEFAULT_LIMIT = 25;

const pickNumber = (value: any, fallback?: number) => {
  const n = Number(value);
  if (Number.isFinite(n) && !Number.isNaN(n)) return n;
  return fallback !== undefined ? fallback : 0;
};

export function extractVenueListState(payload: any, fallback?: { page?: number; limit?: number }): VenueListState {
  const items = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.results)
      ? payload.results
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload)
          ? payload
          : [];

  const rawPagination = payload?.pagination || payload?.meta?.pagination || payload?.meta || {};
  const page = Math.max(1, pickNumber(rawPagination.page ?? rawPagination.current_page ?? fallback?.page ?? 1, 1));
  const limit = Math.max(1, pickNumber(rawPagination.limit ?? rawPagination.per_page ?? fallback?.limit ?? DEFAULT_LIMIT, DEFAULT_LIMIT));
  const totalPagesValue = rawPagination.totalPages ?? rawPagination.total_pages ?? rawPagination.page_count;
  const totalPages = totalPagesValue !== undefined ? Math.max(1, pickNumber(totalPagesValue, 1)) : undefined;
  const hasPrev =
    typeof rawPagination.hasPrev === 'boolean'
      ? rawPagination.hasPrev
      : typeof rawPagination.has_previous_page === 'boolean'
        ? rawPagination.has_previous_page
        : page > 1;
  const hasNext =
    typeof rawPagination.hasNext === 'boolean'
      ? rawPagination.hasNext
      : typeof rawPagination.has_next_page === 'boolean'
        ? rawPagination.has_next_page
        : totalPages
          ? page < totalPages
          : items.length >= limit;

  return { items, page, limit, hasPrev, hasNext, totalPages };
}
