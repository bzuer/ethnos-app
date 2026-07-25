const firstDefined = (...values: any[]) => {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return null;
};

export function normalizeInstitution(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  const identifiers = raw.identifiers && typeof raw.identifiers === 'object' ? raw.identifiers : {};
  const metrics = raw.metrics && typeof raw.metrics === 'object' ? raw.metrics : {};
  const location = raw.location && typeof raw.location === 'object' ? raw.location : {};
  return {
    ...raw,
    country_code: firstDefined(location.country_code, raw.country_code),
    city: firstDefined(location.city, raw.city),
    ror_id: firstDefined(identifiers.ror_id, raw.ror_id),
    grid_id: firstDefined(identifiers.grid_id, raw.grid_id),
    wikidata_id: firstDefined(identifiers.wikidata_id, raw.wikidata_id),
    openalex_id: firstDefined(identifiers.openalex_id, raw.openalex_id),
    homepage_url: firstDefined(identifiers.url, raw.homepage_url, raw.url),
    works_count: firstDefined(metrics.works_count, raw.works_count),
    researchers_count: firstDefined(metrics.researchers_count, raw.researchers_count),
    total_citations: firstDefined(metrics.total_citations, raw.total_citations),
    h_index: firstDefined(metrics.h_index, raw.h_index),
    i10_index: firstDefined(metrics.i10_index, raw.i10_index),
    two_yr_mean_citedness: firstDefined(metrics.two_yr_mean_citedness, raw.two_yr_mean_citedness),
    first_publication_year: firstDefined(metrics.first_publication_year, raw.first_publication_year),
    latest_publication_year: firstDefined(metrics.latest_publication_year, raw.latest_publication_year)
  };
}

export function normalizeInstitutionWorkItem(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  const authors = raw.authors && typeof raw.authors === 'object' && !Array.isArray(raw.authors) ? raw.authors : null;
  return {
    ...raw,
    authors_preview: Array.isArray(raw.authors_preview) ? raw.authors_preview : (authors?.authors_preview || []),
    author_string: authors?.author_string ?? raw.author_string ?? null,
    author_count: authors?.total_count ?? raw.author_count ?? null,
    venue_name: raw.venue?.name ?? raw.venue_name ?? null
  };
}
