export function normalizeInstitution(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  const { url, ...identifiers } = raw.identifiers || {};
  return {
    ...raw,
    ...raw.location,
    ...identifiers,
    ...raw.metrics,
    homepage_url: url ?? null
  };
}

export function normalizeInstitutionWorkItem(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  return {
    ...raw,
    authors_preview: raw.authors?.authors_preview ?? [],
    author_string: raw.authors?.author_string ?? null,
    author_count: raw.authors?.total_count ?? null,
    venue_name: raw.venue?.name ?? null
  };
}
