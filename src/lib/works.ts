function resolveBoolean(value: any) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    if (['true', '1', 'yes', 'y', 'open', 'oa', 'available', 'gratis', 'libre', 'gold', 'green', 'bronze', 'hybrid', 'diamond', 'platinum'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'closed', 'none', 'unknown', 'restricted', 'subscription', 'paywalled'].includes(normalized)) return false;
  }
  return undefined;
}

function pickDoiRaw(item: any) {
  if (!item) return '';
  const direct = item?.doi ?? item?.DOI;
  if (direct) return direct;
  const publication = item?.publication?.doi;
  if (publication) return publication;
  const identifiers = item?.identifiers?.doi ?? item?.ids?.doi;
  if (identifiers) return identifiers;
  return '';
}

function pickDoiValue(raw: any): string {
  if (!raw) return '';
  if (Array.isArray(raw)) {
    const first = raw.find((entry) => entry !== null && entry !== undefined && String(entry).trim() !== '');
    return pickDoiValue(first);
  }
  if (typeof raw === 'object') {
    return pickDoiValue(raw?.doi ?? raw?.id ?? raw?.value ?? raw?.identifier ?? '');
  }
  return String(raw).trim();
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
  const raw = item?.abstract || item?.abstract_text || item?.summary || item?.description || '';
  const text = sanitizeWorkAbstract(raw);
  if (!text) return '';
  if (!limit || limit <= 0) return text;
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}…`;
}

export function isWorkOpenAccess(item: any) {
  const direct = resolveBoolean(
    item?.is_open_access ??
    item?.open_access ??
    item?.openaccess ??
    item?.openacess ??
    item?.open_acess ??
    item?.openAcess ??
    item?.oa ??
    item?.oa_status ??
    item?.open_access_status ??
    item?.openAccess
  );
  if (typeof direct === 'boolean') return direct;
  const nested = item?.open_access;
  if (nested && typeof nested === 'object') {
    const nestedFlag = resolveBoolean(nested?.is_open_access ?? nested?.available ?? nested?.status);
    if (typeof nestedFlag === 'boolean') return nestedFlag;
    if (nested?.oa_url || nested?.url || nested?.link) return true;
  }
  const best = item?.best_oa_location || item?.open_access_location || item?.oa_location;
  if (best && (best.url || best.oa_url || best.host_type)) return true;
  if (item?.open_access_url || item?.oa_url || item?.free_pdf_url) return true;
  const license = item?.license || item?.primary_location?.license;
  if (typeof license === 'string') {
    const normalized = license.trim().toLowerCase();
    if (normalized && !['', 'closed', 'all-rights-reserved', 'unknown'].includes(normalized)) return true;
  }
  if (Array.isArray(item?.publications) && item.publications.some((pub: any) => pub?.open_access === true)) return true;
  return false;
}

export function getWorkDoi(item: any) {
  let raw = pickDoiRaw(item);
  if (!raw && Array.isArray(item?.publications)) {
    for (const pub of item.publications) {
      const candidate = pub?.identifiers?.doi ?? pub?.doi;
      if (candidate) { raw = candidate; break; }
    }
  }
  const doi = pickDoiValue(raw);
  if (!doi) return '';
  return doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').trim();
}

export function getWorkOpenAccessDoiUrl(item: any) {
  const doi = getWorkDoi(item);
  if (!doi) return '';
  return `https://oadoi.org/${encodeURIComponent(doi)}`;
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

export function pickVenueDisplayName(item: any) {
  if (!item) return '';
  return normalizeText(
    item?.abbreviated_name
    || item?.abbreviatedName
    || item?.summary_snapshot?.abbreviated_name
    || item?.journal_abbreviated_name
    || item?.journal_abbreviation
    || item?.short_name
    || item?.name
    || item?.summary_snapshot?.name
    || ''
  );
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

function pickAuthorName(entry: any) {
  if (!entry) return '';
  if (typeof entry === 'string') return normalizeText(entry);
  return normalizeText(entry?.preferred_name || entry?.name || [entry?.given_names, entry?.family_name].filter(Boolean).join(' '));
}

function pickAuthorList(item: any) {
  if (Array.isArray(item?.authors) && item.authors.length) return item.authors;
  if (Array.isArray(item?.authors_preview) && item.authors_preview.length) return item.authors_preview;
  return [];
}

function pickAuthorString(item: any) {
  const fromAuthors = typeof item?.authors === 'string' ? item.authors : '';
  const fromPreview = typeof item?.authors_preview === 'string' ? item.authors_preview : '';
  const fromObjectAuthors = (item?.authors && typeof item.authors === 'object' && !Array.isArray(item.authors))
    ? (item.authors.author_string || '')
    : '';
  const fromFormatted = item?.formatted_authors || item?.author_string || '';
  return normalizeText(fromAuthors || fromPreview || fromObjectAuthors || fromFormatted);
}

function splitAuthorString(value: string) {
  if (!value) return [];
  if (value.includes(';')) return value.split(';').map((part) => normalizeText(part)).filter(Boolean);
  if (value.includes('|')) return value.split('|').map((part) => normalizeText(part)).filter(Boolean);
  return [value];
}

export function formatMetadataAuthors(item: any, fallback = '', maxChars: number = METADATA_TEXT_LIMITS.authors) {
  const arr = pickAuthorList(item);
  let names: string[] = [];
  if (arr.length) names = arr.map((entry: any) => pickAuthorName(entry)).filter(Boolean);
  if (!names.length) names = splitAuthorString(pickAuthorString(item));
  if (!names.length) {
    const fb = normalizeText(fallback);
    return fb ? truncateMetadataText(fb, maxChars) : '';
  }
  const two = names.slice(0, 2).join(', ');
  const countRaw = Number(item?.author_count);
  const hasMore = Number.isFinite(countRaw) && countRaw > 2 ? true : names.length > 2;
  const text = hasMore ? `${two} et al.` : two;
  return truncateMetadataText(text, maxChars);
}

export function pickWorkVenue(item: any) {
  const publication = item?.publication || {};
  return normalizeText(
    item?.venue_name
    || item?.journal
    || item?.journal_name
    || item?.journal_title
    || item?.source
    || publication?.journal
    || publication?.source
    || item?.venue?.name
    || item?.publication?.venue?.name
    || item?.publication?.journal?.name
    || item?.venue_abbreviated_name
    || item?.venue_abbreviation
    || item?.journal_abbreviated_name
    || item?.journal_abbreviation
    || pickVenueDisplayName(item?.venue)
    || pickVenueDisplayName(item?.publication?.venue)
    || pickVenueDisplayName(item?.publication?.journal)
    || publication?.journal_abbreviated_name
    || publication?.journal_abbreviation
    || ''
  );
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
  const openAccess = typeof primary?.open_access === 'boolean'
    ? primary.open_access
    : (typeof raw?.open_access === 'boolean'
      ? raw.open_access
      : publications.some((pub: any) => pub?.open_access === true));
  const peerReviewed = typeof primary?.peer_reviewed === 'boolean'
    ? primary.peer_reviewed
    : (typeof raw?.peer_reviewed === 'boolean' ? raw.peer_reviewed : null);
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
  const publication = raw?.publication && typeof raw.publication === 'object' ? raw.publication : {};
  const authorsObj = raw?.authors && typeof raw.authors === 'object' && !Array.isArray(raw.authors) ? raw.authors : null;
  const authorString = authorsObj?.author_string ?? raw?.author_string ?? null;
  const authorsPreview = Array.isArray(raw?.authors_preview) && raw.authors_preview.length
    ? raw.authors_preview
    : (authorString
      ? String(authorString).split(/[;|]/).map((part: string) => part.trim()).filter(Boolean).slice(0, 3)
      : []);
  return {
    ...raw,
    publication_year: publication?.year ?? null,
    year: publication?.year ?? null,
    venue: publication?.journal ? { name: publication.journal } : (raw?.venue ?? null),
    venue_name: publication?.journal ?? raw?.venue_name ?? null,
    author_string: authorString,
    author_count: authorsObj?.total_count ?? raw?.author_count ?? null,
    authors_preview: authorsPreview
  };
}
