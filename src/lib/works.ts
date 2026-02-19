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
  return false;
}

export function getWorkDoi(item: any) {
  const raw = pickDoiRaw(item);
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
  const fromFormatted = item?.formatted_authors || item?.author_string || '';
  return normalizeText(fromAuthors || fromPreview || fromFormatted);
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
    item?.venue_abbreviated_name
    || item?.venue_abbreviation
    || item?.journal_abbreviated_name
    || item?.journal_abbreviation
    || pickVenueDisplayName(item?.venue)
    || pickVenueDisplayName(item?.publication?.venue)
    || pickVenueDisplayName(item?.publication?.journal)
    || publication?.journal_abbreviated_name
    || publication?.journal_abbreviation
    || item?.venue_name
    || item?.journal
    || item?.journal_name
    || item?.journal_title
    || item?.source
    || publication?.journal
    || publication?.source
    || item?.venue?.name
    || item?.publication?.venue?.name
    || item?.publication?.journal?.name
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
