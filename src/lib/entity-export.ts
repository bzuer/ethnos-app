import { normalizeWorkDetail } from './works';
import {
  SITE_ORIGIN,
  buildDoiUrl,
  buildFileOpenAccessUrl,
  getFilesList,
  pickOpenAccessFile
} from './work-export';

export type ExportKind = 'work' | 'person' | 'venue' | 'institution' | 'subject';
export type EntityKind = Exclude<ExportKind, 'work'>;

const ENTITY_SEGMENTS: Record<ExportKind, string> = {
  work: 'works',
  person: 'persons',
  venue: 'venues',
  institution: 'institutions',
  subject: 'subjects'
};

const SLUG_MAX_LENGTH = 60;

export function buildEntityUrl(kind: ExportKind, id: any) {
  if (id === null || id === undefined) return '';
  const value = String(id).trim();
  return value ? `${SITE_ORIGIN}/${ENTITY_SEGMENTS[kind]}/${encodeURIComponent(value)}` : '';
}

export function entityLabel(entity: any): string {
  if (!entity || typeof entity !== 'object') return '';
  const candidate = entity.preferred_name
    || entity.name
    || entity.term
    || entity.title
    || [entity.given_names, entity.family_name].filter(Boolean).join(' ');
  return candidate ? String(candidate).trim() : '';
}

export function exportSlug(value: any): string {
  const slug = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  if (slug.length <= SLUG_MAX_LENGTH) return slug;
  const cut = slug.slice(0, SLUG_MAX_LENGTH);
  const boundary = cut.lastIndexOf('-');
  return (boundary > 0 ? cut.slice(0, boundary) : cut).replace(/-+$/g, '');
}

export function exportFilename(kind: ExportKind, entity: any): string {
  const rawId = entity?.id ?? entity?.work_id ?? null;
  const id = rawId === null || rawId === undefined ? '' : String(rawId).trim();
  const slug = exportSlug(entityLabel(entity));
  if (slug && id) return `${slug}-${id}`;
  if (slug) return slug;
  return id ? `${kind}-${id}` : kind;
}

function pruneLinks(links: Record<string, any>) {
  const out: Record<string, string> = {};
  Object.entries(links).forEach(([key, value]) => {
    const text = value ? String(value).trim() : '';
    if (text) out[key] = text;
  });
  return out;
}

function withLinks(record: any, links: Record<string, any>) {
  const extra = pruneLinks(links);
  const current = record?._links && typeof record._links === 'object' ? record._links : {};
  return { ...record, _links: { ...current, ...extra } };
}

function isEmptyValue(value: any) {
  if (value === undefined || value === null || value === '') return true;
  return Array.isArray(value) && value.length === 0;
}

function fillMissing(base: any, extra: any) {
  const merged = { ...base };
  Object.entries(extra).forEach(([key, value]) => {
    if (isEmptyValue(merged[key]) && !isEmptyValue(value)) merged[key] = value;
  });
  return merged;
}

export function buildWorkRecord(source: any) {
  if (!source || typeof source !== 'object') return null;
  const work = normalizeWorkDetail(source);
  const id = work?.id ?? work?.work_id ?? null;
  const openAccessFile = pickOpenAccessFile(getFilesList(work));
  return withLinks(work, {
    html: buildEntityUrl('work', id),
    doi: buildDoiUrl(work?.doi ?? work?.publication?.doi),
    open_access: openAccessFile ? buildFileOpenAccessUrl(openAccessFile) : ''
  });
}

export function buildEntityRecord(kind: EntityKind, entity: any) {
  if (!entity || typeof entity !== 'object') return null;
  return withLinks(entity, { html: buildEntityUrl(kind, entity?.id) });
}

export function mergeWorkLists(...lists: any[][]) {
  const order: string[] = [];
  const byId = new Map<string, any>();
  const unidentified: any[] = [];
  lists.forEach((list) => {
    (Array.isArray(list) ? list : []).forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const rawId = item.id ?? item.work_id ?? null;
      if (rawId === null || rawId === undefined || rawId === '') {
        unidentified.push(item);
        return;
      }
      const key = String(rawId);
      const current = byId.get(key);
      if (current) {
        byId.set(key, fillMissing(current, item));
        return;
      }
      byId.set(key, item);
      order.push(key);
    });
  });
  return [...order.map((key) => byId.get(key)), ...unidentified];
}

export function buildWorkExport(work: any) {
  const record = buildWorkRecord(work);
  return {
    exported_at: new Date().toISOString(),
    source: record?._links?.html || null,
    work: record
  };
}

export function buildEntityExport(kind: EntityKind, entity: any) {
  const record = buildEntityRecord(kind, entity);
  return {
    exported_at: new Date().toISOString(),
    source: record?._links?.html || null,
    [kind]: record
  };
}

export function buildWorksExport(works: any[], context?: { kind: EntityKind; entity: any }) {
  const records = (Array.isArray(works) ? works : []).map(buildWorkRecord).filter(Boolean);
  const envelope: Record<string, any> = { exported_at: new Date().toISOString() };
  if (context) {
    envelope.source = buildEntityUrl(context.kind, context.entity?.id) || null;
    envelope[`${context.kind}_id`] = context.entity?.id ?? null;
  }
  envelope.count = records.length;
  envelope.works = records;
  return envelope;
}
