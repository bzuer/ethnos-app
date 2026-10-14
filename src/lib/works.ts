export function normalizeDoi(value: any) {
  return String(value ?? '').trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '');
}

const stripAbstractNoise = (text: string) => {
  const cleaned = text
    .replace(/<[^>]*>/g, ' ')
    .replace(/click to (increase|decrease) image size/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\s*abstract\s*[:.-]\s*/i, '')
    .trim();
  if (!cleaned) return '';
  if (/^(notes|acknowledg(e)?ments?)\b/i.test(cleaned)) return '';
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  const dropPatterns = [
    /click to (increase|enlarge|zoom|view)/i,
    /view full size/i,
    /open in new window/i,
    /supplementary material/i,
    /acknowledg(e)?ments?/i,
    /funding:/i
  ];
  const filtered = sentences.filter((sentence) => !dropPatterns.some((re) => re.test(sentence)));
  return (filtered.length ? filtered : sentences).join(' ').trim();
};

export function sanitizeWorkAbstract(raw: any) {
  if (!raw) return '';
  const text = String(raw).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return stripAbstractNoise(text);
}

export function getWorkAbstractSnippet(item: any, limit = 450) {
  const text = sanitizeWorkAbstract(item?.abstract);
  if (!text || !limit || text.length <= limit) return text;
  return `${text.slice(0, limit)}…`;
}

export function isWorkOpenAccess(item: any) {
  return item?.open_access === true;
}

export function getWorkOpenAccessDoiUrl(item: any) {
  const doi = normalizeDoi(item?.doi);
  return doi ? `https://oadoi.org/${encodeURIComponent(doi)}` : '';
}

export const METADATA_TEXT_LIMITS = {
  authors: 80,
  venue: 80,
  type: 32,
  default: 80
} as const;

function normalizeText(value: any) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

export function truncateMetadataText(value: any, maxChars: number = METADATA_TEXT_LIMITS.default) {
  const text = normalizeText(value);
  if (!text) return '';
  if (!Number.isFinite(maxChars) || maxChars <= 0 || text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars).trimEnd();
  const boundary = slice.lastIndexOf(' ');
  if (boundary > Math.floor(maxChars * 0.6)) return `${slice.slice(0, boundary)}…`;
  return `${slice}…`;
}

export const CONTRIBUTOR_ROLES = ['AUTHOR', 'EDITOR', 'TRANSLATOR', 'REVIEWER', 'OTHER'] as const;

export type ContributorRole = typeof CONTRIBUTOR_ROLES[number];

export type ContributorGroup = { role: ContributorRole; contributors: any[] };

export type ContributorRoleSetGroup = { roles: ContributorRole[]; contributors: any[] };

export function formatContributorName(entry: any) {
  if (!entry) return '';
  if (typeof entry === 'string') return normalizeText(entry);
  return normalizeText(entry?.preferred_name || entry?.name || [entry?.given_names, entry?.family_name].filter(Boolean).join(' '));
}

export function normalizeContributorRole(raw: any): ContributorRole {
  const value = normalizeText(raw).toUpperCase();
  if (!value) return 'AUTHOR';
  return (CONTRIBUTOR_ROLES as readonly string[]).includes(value) ? (value as ContributorRole) : 'OTHER';
}

export function normalizeContributorRoles(entry: any): ContributorRole[] {
  if (!entry || typeof entry !== 'object') return ['AUTHOR'];
  const list = Array.isArray(entry.roles) ? entry.roles : null;
  if (list && list.length) {
    const normalized = list.map(normalizeContributorRole);
    const ordered = CONTRIBUTOR_ROLES.filter((role) => normalized.includes(role));
    return ordered.length ? [...ordered] : ['AUTHOR'];
  }
  return [normalizeContributorRole(entry.role)];
}

export function pickContributorEntries(item: any) {
  if (Array.isArray(item?.contributors) && item.contributors.length) return item.contributors;
  if (Array.isArray(item?.authors) && item.authors.length) return item.authors;
  if (Array.isArray(item?.contributors_preview) && item.contributors_preview.length) return item.contributors_preview;
  return [];
}

function contributorIdentity(entry: any) {
  const name = formatContributorName(entry);
  const personId = entry && typeof entry === 'object' ? (entry.person_id ?? entry.id ?? null) : null;
  if (!name && (personId === null || personId === undefined)) return null;
  const position = Number(entry && typeof entry === 'object' ? entry.position : NaN);
  return {
    key: personId !== null && personId !== undefined ? `id:${personId}` : `name:${name.toLowerCase()}`,
    position: Number.isFinite(position) ? position : Number.MAX_SAFE_INTEGER
  };
}

export function groupContributorsByRole(raw: any): ContributorGroup[] {
  const list = Array.isArray(raw) ? raw : [];
  const buckets = new Map<ContributorRole, any[]>();
  const seen = new Map<ContributorRole, Set<string>>();
  list.forEach((entry: any, index: number) => {
    const identity = contributorIdentity(entry);
    if (!identity) return;
    normalizeContributorRoles(entry).forEach((role) => {
      const roleSeen = seen.get(role) || new Set<string>();
      if (roleSeen.has(identity.key)) return;
      roleSeen.add(identity.key);
      seen.set(role, roleSeen);
      const bucket = buckets.get(role) || [];
      bucket.push({ entry, index, position: identity.position });
      buckets.set(role, bucket);
    });
  });
  return CONTRIBUTOR_ROLES
    .map((role) => ({
      role,
      contributors: (buckets.get(role) || [])
        .sort((a, b) => (a.position - b.position) || (a.index - b.index))
        .map((item) => item.entry)
    }))
    .filter((group) => group.contributors.length > 0);
}

export function groupContributorsByRoleSet(raw: any): ContributorRoleSetGroup[] {
  const list = Array.isArray(raw) ? raw : [];
  const people = new Map<string, { entry: any; index: number; position: number; roles: Set<ContributorRole> }>();
  list.forEach((entry: any, index: number) => {
    const identity = contributorIdentity(entry);
    if (!identity) return;
    const roles = normalizeContributorRoles(entry);
    const existing = people.get(identity.key);
    if (existing) {
      roles.forEach((role) => existing.roles.add(role));
      if (identity.position < existing.position) existing.position = identity.position;
      return;
    }
    people.set(identity.key, { entry, index, position: identity.position, roles: new Set(roles) });
  });
  const groups = new Map<string, { roles: ContributorRole[]; rank: number; order: number; items: any[] }>();
  people.forEach((person) => {
    const roles = CONTRIBUTOR_ROLES.filter((role) => person.roles.has(role));
    const key = roles.join('+');
    const group = groups.get(key)
      || { roles: [...roles], rank: CONTRIBUTOR_ROLES.indexOf(roles[0]), order: person.index, items: [] };
    group.items.push(person);
    groups.set(key, group);
  });
  return [...groups.values()]
    .sort((a, b) => (a.rank - b.rank) || (a.roles.length - b.roles.length) || (a.order - b.order))
    .map((group) => ({
      roles: group.roles,
      contributors: group.items
        .sort((a, b) => (a.position - b.position) || (a.index - b.index))
        .map((item) => item.entry)
    }));
}

export function pickContributorsByRole(raw: any, role: ContributorRole) {
  return groupContributorsByRole(raw).find((group) => group.role === role)?.contributors || [];
}

export function pickPrimaryContributors(raw: any) {
  const groups = groupContributorsByRole(raw);
  if (!groups.length) return [];
  const preferred = groups.find((group) => group.role === 'AUTHOR')
    || groups.find((group) => group.role === 'EDITOR')
    || groups[0];
  return preferred.contributors;
}

function pickAuthorList(item: any) {
  const entries = pickContributorEntries(item);
  if (entries.length) return pickPrimaryContributors(entries);
  if (Array.isArray(item?.authors_preview) && item.authors_preview.length) return item.authors_preview;
  return [];
}

function pickContributorTotal(item: any) {
  const roles = item?.contributor_roles;
  if (roles && typeof roles === 'object' && !Array.isArray(roles)) {
    const authorCount = Number(roles.AUTHOR);
    if (Number.isFinite(authorCount) && authorCount > 0) return { total: authorCount, exact: true };
  }
  const raw = Number(item?.authors_count ?? item?.author_count);
  if (!Number.isFinite(raw) || raw <= 0) return { total: null as number | null, exact: false };
  const entries = pickContributorEntries(item);
  return { total: raw, exact: entries.length > 0 && entries.length >= raw };
}

function pickAuthorString(item: any) {
  if (typeof item?.authors === 'string') return normalizeText(item.authors);
  return normalizeText(item?.author_string || item?.authors?.author_string || '');
}

function splitAuthorString(value: string) {
  if (!value) return [];
  if (value.includes(';')) return value.split(';').map((part) => normalizeText(part)).filter(Boolean);
  if (value.includes('|')) return value.split('|').map((part) => normalizeText(part)).filter(Boolean);
  return [value];
}

export function pickAuthorNames(item: any): string[] {
  const names = pickAuthorList(item).map(formatContributorName).filter(Boolean);
  return names.length ? names : splitAuthorString(pickAuthorString(item));
}

export function formatMetadataAuthors(item: any, fallback = '', maxChars: number = METADATA_TEXT_LIMITS.authors) {
  const names = pickAuthorNames(item);
  if (!names.length) {
    const fb = normalizeText(fallback);
    return fb ? truncateMetadataText(fb, maxChars) : '';
  }
  const two = names.slice(0, 2).join(', ');
  const { total, exact } = pickContributorTotal(item);
  const hasMore = !exact && total !== null && total > 2 ? true : names.length > 2;
  return truncateMetadataText(hasMore ? `${two} et al.` : two, maxChars);
}

export function pickWorkVenue(item: any) {
  return normalizeText(item?.venue_name || item?.venue?.name || item?.venue?.abbreviated_name || '');
}

export function formatMetadataVenue(item: any, maxChars: number = METADATA_TEXT_LIMITS.venue) {
  return truncateMetadataText(pickWorkVenue(item), maxChars);
}

export function formatMetadataType(value: any, maxChars: number = METADATA_TEXT_LIMITS.type) {
  const normalized = normalizeText(value).toUpperCase();
  return truncateMetadataText(normalized, maxChars);
}

const IDENTIFIER_KEYS = [
  'doi', 'pmid', 'pmcid', 'arxiv', 'wos_id', 'handle',
  'wikidata_id', 'openalex_id', 'isbn', 'openlibrary_id',
  'scielo_pid', 'google_book_id', 'mag_id'
] as const;

type IdKey = typeof IDENTIFIER_KEYS[number];
type FlatIds = Record<IdKey, string>;

function fileIsMain(file: any) {
  if (!file) return false;
  const role = String(file?.role || '').toUpperCase();
  return role === 'MAIN' || Boolean(file?.best_oa_url || file?.scimag_id || file?.libgen_id);
}

function publicationHasMainFile(pub: any) {
  const files = Array.isArray(pub?.files) ? pub.files : [];
  return files.some(fileIsMain);
}

export function pickPrimaryPublication(raw: any): any {
  const list = Array.isArray(raw?.publications) ? raw.publications : [];
  if (!list.length) return null;
  const oaMain = list.find((pub: any) => pub?.open_access === true && publicationHasMainFile(pub));
  if (oaMain) return oaMain;
  const hasMainFile = list.find((pub: any) => pub?.has_files === true && publicationHasMainFile(pub));
  if (hasMainFile) return hasMainFile;
  const openAccess = list.find((pub: any) => pub?.open_access === true);
  if (openAccess) return openAccess;
  const anyFiles = list.find((pub: any) => pub?.has_files === true || (Array.isArray(pub?.files) && pub.files.length));
  if (anyFiles) return anyFiles;
  const dated = [...list]
    .filter((pub: any) => pub?.publication_date)
    .sort((a: any, b: any) => String(b.publication_date).localeCompare(String(a.publication_date)));
  if (dated.length) return dated[0];
  return list[0];
}

function pickFirstIdentifier(raw: any): string {
  if (raw === null || raw === undefined) return '';
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const value = pickFirstIdentifier(entry);
      if (value) return value;
    }
    return '';
  }
  if (typeof raw === 'object') {
    return pickFirstIdentifier(raw?.id ?? raw?.value ?? raw?.identifier ?? '');
  }
  const text = String(raw).trim();
  return text;
}

export function flattenIdentifierArrays(input: any): FlatIds {
  const source = input && typeof input === 'object' ? input : {};
  const flat = {} as FlatIds;
  IDENTIFIER_KEYS.forEach((key) => {
    flat[key] = pickFirstIdentifier(source[key]);
  });
  return flat;
}

function mergeIdentifierSources(primary: any, fallback: any) {
  const merged: Record<string, any> = { ...(fallback && typeof fallback === 'object' ? fallback : {}) };
  if (primary && typeof primary === 'object') {
    Object.entries(primary).forEach(([key, value]) => {
      const candidate = pickFirstIdentifier(value);
      if (candidate) merged[key] = value;
    });
  }
  return merged;
}

export function normalizeWorkDetail(raw: any) {
  if (!raw || typeof raw !== 'object') return raw;
  const hasPrimaryField = raw?.primary_publication && typeof raw.primary_publication === 'object';
  const publications = Array.isArray(raw?.publications) ? raw.publications : [];
  if (!hasPrimaryField && !publications.length) return raw;
  const primary = hasPrimaryField ? raw.primary_publication : pickPrimaryPublication(raw);
  const mergedIds = mergeIdentifierSources(primary?.identifiers, raw?.identifiers);
  const flat = flattenIdentifierArrays(mergedIds);
  const primaryDoi = pickFirstIdentifier(primary?.identifiers?.doi)
    || pickFirstIdentifier(primary?.doi)
    || flat.doi;
  const workType = raw?.type || raw?.work_type || null;
  const rootFiles = Array.isArray(raw?.files) ? raw.files : null;
  const primaryFiles = Array.isArray(primary?.files) ? primary.files : null;
  const files = rootFiles && rootFiles.length ? rootFiles : (primaryFiles || rootFiles || []);
  const openAccess = raw?.open_access === true
    || primary?.open_access === true
    || publications.some((pub: any) => pub?.open_access === true);
  const peerReviewedTrue = raw?.peer_reviewed === true
    || primary?.peer_reviewed === true
    || publications.some((pub: any) => pub?.peer_reviewed === true);
  const peerReviewedKnown = typeof raw?.peer_reviewed === 'boolean'
    || typeof primary?.peer_reviewed === 'boolean'
    || publications.some((pub: any) => typeof pub?.peer_reviewed === 'boolean');
  const peerReviewed = peerReviewedTrue ? true : (peerReviewedKnown ? false : null);
  return {
    ...raw,
    work_type: workType,
    type: raw?.type || workType,
    publication_year: primary?.publication_year ?? raw?.publication_year ?? null,
    publication: primary ? {
      id: primary?.id ?? null,
      year: primary?.publication_year ?? null,
      publication_date: primary?.publication_date ?? null,
      volume: primary?.volume ?? null,
      issue: primary?.issue ?? null,
      pages: primary?.pages ?? null,
      doi: primaryDoi || null,
      peer_reviewed: typeof primary?.peer_reviewed === 'boolean' ? primary.peer_reviewed : null,
      open_access: typeof primary?.open_access === 'boolean' ? primary.open_access : null,
      license_url: primary?.license_url ?? null,
      license_version: primary?.license_version ?? null
    } : null,
    venue: primary?.venue ?? raw?.venue ?? null,
    publisher: primary?.publisher ?? raw?.publisher ?? null,
    files,
    doi: flat.doi || null,
    pmid: flat.pmid || null,
    pmcid: flat.pmcid || null,
    arxiv: flat.arxiv || null,
    wos_id: flat.wos_id || null,
    handle: flat.handle || null,
    wikidata_id: flat.wikidata_id || null,
    openalex_id: flat.openalex_id || null,
    isbn: flat.isbn || null,
    openlibrary_id: flat.openlibrary_id || null,
    open_access: openAccess,
    peer_reviewed: peerReviewed,
    identifiers: mergedIds
  };
}

export function normalizePersonDetail(raw: any) {
  if (!raw || typeof raw !== 'object') return raw;
  const hasAffiliations = Array.isArray(raw?.affiliations) && raw.affiliations.length > 0;
  if (hasAffiliations) return raw;
  const primary = raw?.primary_affiliation;
  if (!primary) return raw;
  return { ...raw, affiliations: [primary] };
}

export function normalizePersonWorkItem(raw: any) {
  if (!raw || typeof raw !== 'object') return raw;
  const publication = raw.publication || {};
  const authorString = raw.authors?.author_string ?? null;
  return {
    ...raw,
    publication_year: raw.publication_year ?? publication.year ?? null,
    venue: publication.journal ? { name: publication.journal } : (raw.venue ?? null),
    venue_name: publication.journal ?? raw.venue_name ?? null,
    author_string: authorString,
    author_count: raw.authors?.total_count ?? raw.author_count ?? null,
    authors_preview: authorString ? splitAuthorString(String(authorString)).slice(0, 3) : []
  };
}
