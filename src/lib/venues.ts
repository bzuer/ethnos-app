export function normalizeVenue(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  return {
    ...raw,
    ...raw.identifiers,
    ...raw.indexing,
    ...raw.metrics,
    subjects: Array.isArray(raw.subjects) ? raw.subjects : []
  };
}

export function venueSubjectTerms(venue: any): string[] {
  const terms = (Array.isArray(venue?.subjects) ? venue.subjects : [])
    .map((subject: any) => String(subject?.term || '').trim())
    .filter(Boolean);
  return Array.from(new Set<string>(terms));
}

export type VenueListItem = {
  id: string;
  name: string;
  type: string;
  publisher: string;
  coverage: string;
  issn: string;
  eissn: string;
  isbn13: string;
  worksCount: number | null;
  citedByCount: number | null;
  hIndex: number | null;
  impactFactor: number | null;
  quartile: string;
  country: string;
  openAccess: boolean;
  diamond: boolean;
  doaj: boolean;
  scielo: boolean;
  scopus: boolean;
  summary: string;
};

export type VenueListPage = {
  items: VenueListItem[];
  page: number;
  hasPrev: boolean;
  hasNext: boolean;
};

const SUMMARY_LIMIT = 420;

function text(value: unknown) {
  return value === null || value === undefined ? '' : String(value).replace(/\s+/g, ' ').trim();
}

function numberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clip(value: string) {
  return value.length > SUMMARY_LIMIT ? `${value.slice(0, SUMMARY_LIMIT)}…` : value;
}

export function toVenueListItem(venue: any): VenueListItem {
  const start = venue?.coverage_start_year;
  const end = venue?.coverage_end_year;
  return {
    id: String(venue?.id ?? ''),
    name: text(venue?.name),
    type: text(venue?.type).toUpperCase(),
    publisher: text(venue?.publisher?.name),
    coverage: start && end ? `${start}-${end}` : '',
    issn: text(venue?.issn),
    eissn: text(venue?.eissn),
    isbn13: text(venue?.isbn13),
    worksCount: numberOrNull(venue?.works_count),
    citedByCount: numberOrNull(venue?.cited_by_count),
    hIndex: numberOrNull(venue?.h_index),
    impactFactor: numberOrNull(venue?.impact_factor),
    quartile: text(venue?.sjr_best_quartile).toUpperCase(),
    country: text(venue?.country_code || venue?.publisher?.country_code).toUpperCase(),
    openAccess: venue?.open_access === true,
    diamond: venue?.is_oa_diamond === true,
    doaj: venue?.is_in_doaj === true,
    scielo: venue?.is_in_scielo === true,
    scopus: venue?.is_indexed_in_scopus === true,
    summary: clip(text(venue?.summary) || venueSubjectTerms(venue).join(', '))
  };
}

export function toVenueListPage(envelope: any): VenueListPage {
  const pagination = envelope?.pagination || {};
  const page = Number(pagination.page) || 1;
  return {
    items: (Array.isArray(envelope?.data) ? envelope.data : []).map(toVenueListItem),
    page,
    hasPrev: page > 1,
    hasNext: pagination.hasNext === true
  };
}
