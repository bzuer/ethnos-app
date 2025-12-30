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
