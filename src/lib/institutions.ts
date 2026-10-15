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
