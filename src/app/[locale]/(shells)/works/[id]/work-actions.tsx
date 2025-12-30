'use client';
import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { showNotification } from '@/lib/notify';

type Props = { work: any };

const STORAGE_KEY = 'ethnos_app_personal_list';

function readList(): any[] { try { const v = localStorage.getItem(STORAGE_KEY); return v ? normalizeList(JSON.parse(v)) : []; } catch { return []; } }
function writeList(items: any[]) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); return true; } catch { return false; } }

function updateHeaderCounter() { const el = document.getElementById('reading-list-counter'); if (el) el.textContent = String(readList().length); }

function toSavedItem(work: any) {
  return {
    id: work?.id,
    title: work?.title || null,
    authors: work?.authors || work?.authors_preview || work?.author_string || null,
    publication_year: work?.publication?.year || work?.publication_year || work?.year || null,
    venue_name: work?.venue?.name || work?.venue_name || null,
    type: work?.work_type || work?.type || null,
    added_at: new Date().toISOString()
  };
}

function normAuthor(a: any) {
  if (!a) return null;
  if (typeof a === 'string') {
    const parts = a.trim().split(/\s+/);
    const family = parts.length ? parts[parts.length - 1] : '';
    const given = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
    return { family_name: family || null, given_names: given || null, preferred_name: a, identifiers: {}, affiliation: null };
  }
  const aff = a.affiliation && typeof a.affiliation === 'object' ? a.affiliation.name : a.affiliation || null;
  return { family_name: a.family_name || null, given_names: a.given_names || null, preferred_name: a.preferred_name || a.full_name || a.name || null, identifiers: a.identifiers || (a.orcid ? { orcid: a.orcid } : {}), affiliation: aff || null };
}

function normWork(raw: any) {
  if (!raw) return null;
  const authors = Array.isArray(raw.authors) ? raw.authors.map(normAuthor).filter(Boolean) : [];
  const publication = raw.publication || {};
  const venue = raw.venue || {};
  const publisher = raw.publisher || {};
  return {
    id: raw.id,
    work_type: raw.work_type || raw.type || null,
    title: raw.title || null,
    subtitle: raw.subtitle || null,
    abstract: raw.abstract || null,
    language: raw.language || null,
    doi: raw.doi || null,
    publication: {
      year: publication.year || raw.publication_year || raw.year || null,
      volume: publication.volume || raw.volume || null,
      issue: publication.issue || raw.issue || null,
      pages: publication.pages || raw.pages || null
    },
    venue: { id: venue.id || null, name: venue.name || raw.venue_name || null, issn: venue.issn || venue.eissn || null },
    publisher: { name: publisher.name || raw.publisher_name || null },
    authors
  };
}

function formatEid(id: string | number | null | undefined) {
  if (id === null || id === undefined) return '';
  const value = String(id).trim();
  return value ? `e-id ${value}` : '';
}

function attachEid<T extends Record<string, any>>(item: T, overrideId?: string | number | null) {
  const eid = formatEid(overrideId ?? item?.id ?? null);
  if (!eid) return item;
  return { ...item, 'e-id': eid };
}

function download(filename: string, content: string, type?: string) {
  const blob = new Blob([content], { type: type || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

export default function ClientActions({ work }: Props) {
  const t = useTranslations();
  const files = Array.isArray(work?.files) ? work.files : [];
  const onAdd = useCallback(() => {
    const list = readList();
    const item = toSavedItem(work);
    if (!item.id) return;
    if (list.some((x) => String(x.id) === String(item.id))) { showNotification(t('common.messages.itemExists'), 'info'); return; }
    list.push(item);
    writeList(list);
    updateHeaderCounter();
    showNotification(t('common.messages.added'), 'success');
  }, [work, t]);

  const onExportBib = useCallback(() => {
    const content = toBibTeX(work);
    download(`work-${work?.id || 'data'}.bib`, content || ' ', 'application/x-bibtex');
    showNotification(t('common.messages.bibExported'), 'success');
  }, [work, t]);

  const onExportJson = useCallback(() => {
    const normalizedSource = [normWork(work)];
    const normalized = normalizedSource.filter(Boolean).map((entry) => attachEid(entry as Record<string, any>));
    const exportedItems = [attachEid(work)];
    const payload = JSON.stringify({ items: exportedItems, normalized }, null, 2);
    download(`work-${work?.id || 'data'}.json`, payload, 'application/json');
    showNotification(t('common.messages.jsonExported'), 'success');
  }, [work, t]);

  const onExportApa = useCallback(() => {
    const content = toApaText(work);
    download(`work-${work?.id || 'data'}-apa.txt`, content || ' ', 'text/plain;charset=utf-8');
    showNotification(t('common.messages.apaExported'), 'success');
  }, [work, t]);

  const doi = work?.doi || work?.publication?.doi;
  const scimagFile = files.find((file: any) => file?.scimag_id);
  const openAccessFile = files.find((file: any) => file?.openacess_id || file?.openaccess_id);
  const libgenFile = files.find((file: any) => file?.md5 && file?.libgen_id);
  const doiHref = doi ? `https://doi.org/${encodeURIComponent(String(doi))}` : undefined;
  const scihubTarget = scimagFile ? (scimagFile?.doi || doi) : null;
  const scihubHref = scimagFile && scihubTarget ? `https://sci-hub.se/${encodeURIComponent(String(scihubTarget))}` : undefined;
  const openAccessHref = openAccessFile?.best_oa_url || openAccessFile?.best_oa?.url || openAccessFile?.url;
  const libgenHref = libgenFile?.md5 ? `https://annas-archive.org/md5/${encodeURIComponent(String(libgenFile.md5))}` : undefined;
  const onOpenDoi = useCallback(() => {
    if (!doiHref) return;
    const w = window.open(doiHref, '_blank', 'noopener,noreferrer');
    if (w) w.opener = null;
  }, [doiHref]);
  const onOpenSciHub = useCallback(() => {
    if (!scihubHref) return;
    const w = window.open(scihubHref, '_blank', 'noopener,noreferrer');
    if (w) w.opener = null;
  }, [scihubHref]);
  const onOpenBestOa = useCallback(() => {
    if (!openAccessHref) return;
    const w = window.open(openAccessHref, '_blank', 'noopener,noreferrer');
    if (w) w.opener = null;
  }, [openAccessHref]);
  const onOpenLibgen = useCallback(() => {
    if (!libgenHref) return;
    const w = window.open(libgenHref, '_blank', 'noopener,noreferrer');
    if (w) w.opener = null;
  }, [libgenHref]);

  return (
    <>
      {doiHref ? (
        <button type="button" className="action-btn btn-positive" onClick={onOpenDoi}>{t('common.actions.openDoi')}</button>
      ) : null}
      <button type="button" className="action-btn btn-positive" onClick={onAdd}>{t('common.actions.addToList')}</button>
      {scihubHref ? (
        <button type="button" className="action-btn btn-positive" onClick={onOpenSciHub}>{t('common.actions.openSciHub')}</button>
      ) : null}
      {libgenHref ? (
        <button type="button" className="action-btn btn-positive" onClick={onOpenLibgen}>{t('common.actions.openLibgen')}</button>
      ) : null}
      {openAccessHref ? (
        <button type="button" className="action-btn btn-positive" onClick={onOpenBestOa}>{t('common.actions.openBestOa')}</button>
      ) : null}
      <button type="button" className="action-btn btn-positive" onClick={onExportJson}>{t('common.actions.exportJson')}</button>
      <button type="button" className="action-btn btn-positive" onClick={onExportBib}>{t('common.actions.exportBib')}</button>
      <button type="button" className="action-btn btn-positive" onClick={onExportApa}>{t('common.actions.exportApa')}</button>
    </>
  );
}

function getAuthorTokens(work: any) {
  const raw = work?.authors || work?.authors_preview || work?.author_string || [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') return raw.split(';').map((part) => part.trim()).filter(Boolean);
  return [];
}

function toBibTeX(work: any) {
  const id = work?.id ? String(work.id) : 'entry';
  const typeRaw = (work?.work_type || work?.type || '').toString().toLowerCase();
  const type = typeRaw === 'book' ? 'book' : typeRaw === 'chapter' ? 'incollection' : typeRaw === 'conference' ? 'inproceedings' : 'article';
  const title = work?.title || '';
  const year = work?.publication?.year || work?.publication_year || work?.year || '';
  const venue = work?.venue?.name || work?.venue_name || '';
  const doi = work?.doi || work?.publication?.doi || '';
  const authors = getAuthorTokens(work).map((item: any) => {
    if (typeof item === 'string') return item;
    const family = item?.family_name || '';
    const given = item?.given_names || '';
    const name = item?.preferred_name || item?.name || '';
    if (family || given) return [family, given].filter(Boolean).join(', ');
    return name;
  }).filter(Boolean).join(' and ');
  const fields = [
    ['title', title],
    ['author', authors],
    ['year', year ? String(year) : ''],
    ['journal', venue],
    ['doi', doi]
  ].filter(([, value]) => value);
  const lines = fields.map(([key, value]) => `  ${key} = {${String(value)}}`);
  return `@${type}{${id},\n${lines.join(',\n')}\n}`;
}

function toApaText(work: any) {
  const authors = getAuthorTokens(work).map((item: any) => {
    if (typeof item === 'string') return item;
    const family = item?.family_name || item?.name || '';
    const given = item?.given_names || '';
    const initials = given
      ? given.split(/\s+/).filter(Boolean).map((part: string) => part.charAt(0).toUpperCase() + '.').join(' ')
      : '';
    const name = family ? `${family}${initials ? `, ${initials}` : ''}` : (item?.preferred_name || '');
    return name;
  }).filter(Boolean);
  let authorText = '';
  if (authors.length === 1) authorText = authors[0];
  else if (authors.length === 2) authorText = `${authors[0]} & ${authors[1]}`;
  else if (authors.length > 2) authorText = `${authors.slice(0, -1).join(', ')}, & ${authors[authors.length - 1]}`;
  const year = work?.publication?.year || work?.publication_year || work?.year || '';
  const title = work?.title || '';
  const venue = work?.venue?.name || work?.venue_name || '';
  const doi = work?.doi || work?.publication?.doi || '';
  const parts = [
    authorText || '',
    year ? `(${year}).` : '',
    title ? `${title}.` : '',
    venue ? `${venue}.` : '',
    doi ? `https://doi.org/${doi}` : ''
  ].filter(Boolean);
  return parts.join(' ').trim();
}

function normalizeList(value: any) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object' && 'id' in item);
}
